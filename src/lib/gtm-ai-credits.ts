import { db } from "@/utils/db";
import {
  gtmAiCreditPeriod,
  gtmAiCreditTransaction,
  organization,
  gtmOutreachCampaign,
} from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import {
  BILLING_CONFIG,
  getPlanLimits,
  isBillingBypassed,
  type PlanTier,
} from "@/config/billing";
import { nanoid } from "nanoid";

export class InsufficientAiCreditsError extends Error {
  constructor(message = "Insufficient AI credits remaining in your current billing period.") {
    super(message);
    this.name = "InsufficientAiCreditsError";
  }
}

/**
 * Retrieves the currently active AI credit period for the organization.
 * If no period exists or the latest period has expired, initializes a new period
 * based on the organization's current plan without rollover.
 */
export async function getCurrentCreditPeriod(organizationId: string) {
  const now = new Date();

  // 1. Look for active period covering now
  const [activePeriod] = await db
    .select()
    .from(gtmAiCreditPeriod)
    .where(
      and(
        eq(gtmAiCreditPeriod.organizationId, organizationId),
        lte(gtmAiCreditPeriod.periodStart, now),
        gte(gtmAiCreditPeriod.periodEnd, now)
      )
    )
    .orderBy(desc(gtmAiCreditPeriod.periodStart))
    .limit(1);

  if (activePeriod) {
    // Reconcile phantom enterprise allotment or stale plan periods
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId));

    const planKey = (org?.plan || "free") as PlanTier;
    const planLimits = getPlanLimits(planKey);

    if (
      activePeriod.plan === "enterprise" ||
      activePeriod.planAllotment > 5000 ||
      (planKey === "free" && activePeriod.planAllotment > 0)
    ) {
      const correctedAllotment = planLimits.aiCredits;
      const correctedRemaining = Math.max(0, correctedAllotment - activePeriod.creditsUsed);

      const [updatedPeriod] = await db
        .update(gtmAiCreditPeriod)
        .set({
          plan: planKey,
          planAllotment: correctedAllotment,
          creditsRemaining: correctedRemaining,
          updatedAt: new Date(),
        })
        .where(eq(gtmAiCreditPeriod.id, activePeriod.id))
        .returning();

      return updatedPeriod;
    }

    return activePeriod;
  }

  // 2. Fall back to the most recent period regardless of date
  const [latestPeriod] = await db
    .select()
    .from(gtmAiCreditPeriod)
    .where(eq(gtmAiCreditPeriod.organizationId, organizationId))
    .orderBy(desc(gtmAiCreditPeriod.periodStart))
    .limit(1);

  // If latest period is still in the future or valid, return it
  if (latestPeriod && latestPeriod.periodEnd > now) {
    return latestPeriod;
  }

  // 3. Otherwise initialize a fresh period for this billing cycle
  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId));

  const planKey = (org?.plan || "free") as PlanTier;
  const planLimits = getPlanLimits(planKey);
  const periodStart = now;
  const periodEnd = org?.currentPeriodEnd && org.currentPeriodEnd > now
    ? org.currentPeriodEnd
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const allotment = planLimits.aiCredits;

  const [newPeriod] = await db
    .insert(gtmAiCreditPeriod)
    .values({
      id: nanoid(),
      organizationId,
      periodStart,
      periodEnd,
      plan: planKey,
      planAllotment: allotment,
      creditsUsed: 0,
      creditsRemaining: allotment,
    })
    .returning();

  // Log period reset / initialization transaction
  await db.insert(gtmAiCreditTransaction).values({
    id: nanoid(),
    organizationId,
    periodId: newPeriod.id,
    type: "period_reset",
    amount: allotment,
    description: `Billing cycle initialized with ${allotment} credits (${planLimits.name} plan)`,
  });

  return newPeriod;
}

/**
 * Returns clean summary of credit balance, usage %, and days remaining.
 */
export async function getAiCreditBalance(organizationId: string) {
  const period = await getCurrentCreditPeriod(organizationId);

  const creditsRemaining = period.creditsRemaining;
  const creditsUsed = period.creditsUsed;
  const planAllotment = period.planAllotment;
  const totalPool = Math.max(planAllotment, creditsUsed + creditsRemaining);
  const percentUsed =
    totalPool > 0 ? Math.min(100, Math.round((creditsUsed / totalPool) * 100)) : 0;

  const now = new Date();
  const msRemaining = Math.max(0, period.periodEnd.getTime() - now.getTime());
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  return {
    period,
    periodId: period.id,
    plan: period.plan,
    planAllotment,
    creditsUsed,
    creditsRemaining,
    percentUsed,
    daysRemaining,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    isBypassed: false,
  };
}

/**
 * Quick boolean check if the organization has at least 1 credit available to spend.
 * Never gates stages 1-3.
 */
export async function hasAvailableCredits(organizationId: string): Promise<boolean> {
  const balance = await getAiCreditBalance(organizationId);
  return balance.creditsRemaining > 0;
}

/**
 * Atomically debits exactly 1 AI credit for 1 sent prospect email.
 * Inserts debit transaction into gtm_ai_credit_transaction.
 */
export async function debitProspectCredit(
  organizationId: string,
  params: {
    campaignId?: string;
    prospectId?: string;
    description?: string;
  }
) {
  const period = await getCurrentCreditPeriod(organizationId);

  if (period.creditsRemaining <= 0) {
    throw new InsufficientAiCreditsError(
      `AI credits exhausted (0 remaining). Please top up or upgrade to send outreach.`
    );
  }

  // Atomic decrement in database
  const [updatedPeriod] = await db
    .update(gtmAiCreditPeriod)
    .set({
      creditsUsed: sql`${gtmAiCreditPeriod.creditsUsed} + 1`,
      creditsRemaining: sql`GREATEST(0, ${gtmAiCreditPeriod.creditsRemaining} - 1)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gtmAiCreditPeriod.id, period.id),
        sql`${gtmAiCreditPeriod.creditsRemaining} > 0`
      )
    )
    .returning();

  if (!updatedPeriod) {
    throw new InsufficientAiCreditsError(
      `AI credits exhausted (concurrent send reached 0 limit). Please top up.`
    );
  }

  // Insert transaction log
  const [transaction] = await db
    .insert(gtmAiCreditTransaction)
    .values({
      id: nanoid(),
      organizationId,
      periodId: period.id,
      type: "debit",
      amount: 1,
      relatedCampaignId: params.campaignId,
      relatedProspectId: params.prospectId,
      description: params.description || "Sent outreach email to prospect (Stage 7)",
    })
    .returning();

  return {
    success: true,
    creditsRemaining: updatedPeriod.creditsRemaining,
    creditsUsed: updatedPeriod.creditsUsed,
    transactionId: transaction.id,
  };
}

/**
 * Adds top-up credits immediately to the current period without shifting the renewal date.
 */
export async function addTopupCredits(
  organizationId: string,
  amount: number,
  description = `Purchased ${amount} AI credits top-up pack`
) {
  const period = await getCurrentCreditPeriod(organizationId);

  const [updatedPeriod] = await db
    .update(gtmAiCreditPeriod)
    .set({
      creditsRemaining: sql`${gtmAiCreditPeriod.creditsRemaining} + ${amount}`,
      planAllotment: sql`${gtmAiCreditPeriod.planAllotment} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(gtmAiCreditPeriod.id, period.id))
    .returning();

  const [transaction] = await db
    .insert(gtmAiCreditTransaction)
    .values({
      id: nanoid(),
      organizationId,
      periodId: period.id,
      type: "topup",
      amount,
      description,
    })
    .returning();

  return {
    updatedPeriod,
    transaction,
  };
}

/**
 * Resets billing period allotment on Dodo subscription renewal or plan change.
 * Strictly NO rollover: unspent credits do not carry over to the new period.
 */
export async function resetCreditPeriod(
  organizationId: string,
  planName: PlanTier | string,
  periodEnd?: Date
) {
  const planLimits = getPlanLimits(planName);
  const now = new Date();
  const nextEnd =
    periodEnd && periodEnd > now
      ? periodEnd
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const allotment = planLimits.aiCredits;

  const [newPeriod] = await db
    .insert(gtmAiCreditPeriod)
    .values({
      id: nanoid(),
      organizationId,
      periodStart: now,
      periodEnd: nextEnd,
      plan: planName,
      planAllotment: allotment,
      creditsUsed: 0,
      creditsRemaining: allotment,
    })
    .returning();

  await db.insert(gtmAiCreditTransaction).values({
    id: nanoid(),
    organizationId,
    periodId: newPeriod.id,
    type: "period_reset",
    amount: allotment,
    description: `Subscription renewal: reset to ${allotment} credits for ${planLimits.name} plan (no rollover)`,
  });

  return newPeriod;
}

/**
 * Aggregates usage data for the billing dashboard chart and returns recent transactions.
 * Step 4: Daily (last 14 days), Weekly (last 8 weeks), Monthly (last 6 months).
 */
export async function getCreditUsageAnalytics(
  organizationId: string,
  range: "daily" | "weekly" | "monthly" = "daily"
) {
  const now = new Date();
  let startDate: Date;

  if (range === "daily") {
    startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  } else if (range === "weekly") {
    startDate = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
  } else {
    // monthly: 6 months
    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  // 1. Fetch debit transactions in window
  const transactions = await db
    .select({
      id: gtmAiCreditTransaction.id,
      type: gtmAiCreditTransaction.type,
      amount: gtmAiCreditTransaction.amount,
      createdAt: gtmAiCreditTransaction.createdAt,
      description: gtmAiCreditTransaction.description,
      relatedCampaignId: gtmAiCreditTransaction.relatedCampaignId,
      campaignName: gtmOutreachCampaign.status, // or joined info
    })
    .from(gtmAiCreditTransaction)
    .leftJoin(
      gtmOutreachCampaign,
      eq(gtmAiCreditTransaction.relatedCampaignId, gtmOutreachCampaign.id)
    )
    .where(
      and(
        eq(gtmAiCreditTransaction.organizationId, organizationId),
        gte(gtmAiCreditTransaction.createdAt, startDate)
      )
    )
    .orderBy(desc(gtmAiCreditTransaction.createdAt));

  // 2. Bucket transactions based on selected range
  const buckets: Record<string, { label: string; date: string; creditsDebited: number; prospectsSent: number }> = {};

  if (range === "daily") {
    // 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      buckets[key] = { label, date: key, creditsDebited: 0, prospectsSent: 0 };
    }
    for (const tx of transactions) {
      if (tx.type === "debit") {
        const key = tx.createdAt.toISOString().slice(0, 10);
        if (buckets[key]) {
          buckets[key].creditsDebited += tx.amount;
          buckets[key].prospectsSent += tx.amount;
        }
      }
    }
  } else if (range === "weekly") {
    // 8 weeks
    for (let i = 7; i >= 0; i--) {
      const startOfWeek = new Date(now.getTime() - (i * 7 + now.getDay()) * 24 * 60 * 60 * 1000);
      const key = startOfWeek.toISOString().slice(0, 10);
      const label = `Wk ${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      buckets[key] = { label, date: key, creditsDebited: 0, prospectsSent: 0 };
    }
    for (const tx of transactions) {
      if (tx.type === "debit") {
        // Find matching week
        const txTime = tx.createdAt.getTime();
        for (const key of Object.keys(buckets)) {
          const bTime = new Date(key).getTime();
          if (txTime >= bTime && txTime < bTime + 7 * 24 * 60 * 60 * 1000) {
            buckets[key].creditsDebited += tx.amount;
            buckets[key].prospectsSent += tx.amount;
            break;
          }
        }
      }
    }
  } else {
    // 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      buckets[key] = { label, date: key, creditsDebited: 0, prospectsSent: 0 };
    }
    for (const tx of transactions) {
      if (tx.type === "debit") {
        const key = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, "0")}`;
        if (buckets[key]) {
          buckets[key].creditsDebited += tx.amount;
          buckets[key].prospectsSent += tx.amount;
        }
      }
    }
  }

  const chartData = Object.values(buckets);

  // 3. Fetch recent transactions for table (up to 20)
  const recentTransactions = await db
    .select({
      id: gtmAiCreditTransaction.id,
      type: gtmAiCreditTransaction.type,
      amount: gtmAiCreditTransaction.amount,
      description: gtmAiCreditTransaction.description,
      relatedCampaignId: gtmAiCreditTransaction.relatedCampaignId,
      createdAt: gtmAiCreditTransaction.createdAt,
    })
    .from(gtmAiCreditTransaction)
    .where(eq(gtmAiCreditTransaction.organizationId, organizationId))
    .orderBy(desc(gtmAiCreditTransaction.createdAt))
    .limit(20);

  return {
    range,
    chartData,
    recentTransactions,
  };
}
