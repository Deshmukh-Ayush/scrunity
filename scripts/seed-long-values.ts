import { db } from "@/utils/db";
import { organization, gtmAiCreditPeriod, gtmAiCreditTransaction } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

async function main() {
  const orgId = "86snq4dK6csMTuqNM4ly6EdZxRLiOVaW";
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

  // 1. Update org with long name and Scale plan
  await db
    .update(organization)
    .set({
      name: "International Enterprise Logistics & Advanced Technology Solutions Corporation of North America",
      plan: "scale",
      subscriptionStatus: "active",
      currentPeriodEnd: periodEnd,
      extraSeats: 12,
    })
    .where(eq(organization.id, orgId));

  // 2. Update credit period with 5-digit credit counts
  let [period] = await db
    .select()
    .from(gtmAiCreditPeriod)
    .where(eq(gtmAiCreditPeriod.organizationId, orgId));

  if (period) {
    await db
      .update(gtmAiCreditPeriod)
      .set({
        plan: "scale",
        planAllotment: 15000,
        creditsUsed: 4500,
        creditsRemaining: 10500,
        periodStart: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        periodEnd: periodEnd,
      })
      .where(eq(gtmAiCreditPeriod.id, period.id));
  }

  // 3. Clear and insert transactions with deliberately long descriptions
  await db
    .delete(gtmAiCreditTransaction)
    .where(eq(gtmAiCreditTransaction.organizationId, orgId));

  const longTxs = [
    {
      type: "debit",
      amount: 1,
      description: "Debited 1 AI credit for customized multi-touch outreach sequence dispatched to Executive Vice President & Chief Information Officer at Global FinTech Enterprises Consortium LLC",
      daysAgo: 0,
    },
    {
      type: "debit",
      amount: 150,
      description: "Batch multi-channel prospect outreach campaign delivered to Series B+ B2B Software Engineering Decision Makers in Healthcare & Biotechnology",
      daysAgo: 1,
    },
    {
      type: "topup",
      amount: 5000,
      description: "Enterprise high-volume top-up package: 50x 100 AI prospect credits pack ($600 one-time invoice billed via Dodo Payments)",
      daysAgo: 2,
    },
    {
      type: "period_reset",
      amount: 10000,
      description: "Scale tier monthly recurring credit refresh: 10,000 base credits + enterprise campaign quota allocation for October billing cycle",
      daysAgo: 5,
    },
  ];

  for (const tx of longTxs) {
    const txDate = new Date(now.getTime() - tx.daysAgo * 24 * 60 * 60 * 1000);
    await db.insert(gtmAiCreditTransaction).values({
      id: nanoid(),
      organizationId: orgId,
      periodId: period?.id || nanoid(),
      type: tx.type as "debit" | "topup" | "period_reset",
      amount: tx.amount,
      description: tx.description,
      createdAt: txDate,
    });
  }

  console.log("Seeded deliberately long test values successfully");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
