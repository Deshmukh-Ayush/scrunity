import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/utils/db";
import {
  gtmResearchRun,
  gtmOutreachCampaign,
  organizationCreditPeriod,
  usageEvent,
} from "@/db/schema";
import { getOrCreateActiveCreditPeriod } from "@/lib/ai/credits";
import { Resend } from "resend";
import crypto from "crypto";

/**
 * "attempt": this stage attempt used its call budget (Restart Stage gets a fresh one).
 * "lifetime": the run/campaign used its lifetime backstop across all attempts.
 */
export type FirecrawlCapScope = "attempt" | "lifetime";

export class FirecrawlCallCapExceededError extends Error {
  public readonly failureReason: string;
  public readonly scope: FirecrawlCapScope;
  public readonly count: number;
  public readonly cap: number;

  constructor(count: number, cap: number, scope: FirecrawlCapScope = "attempt") {
    super(
      scope === "attempt"
        ? `Firecrawl per-attempt call cap exceeded: ${count} calls made in this stage attempt (cap is ${cap}).`
        : `Firecrawl lifetime call cap exceeded: ${count} calls made across all attempts (cap is ${cap}).`
    );
    this.name = "FirecrawlCallCapExceededError";
    this.failureReason =
      scope === "attempt" ? "firecrawl_call_cap_exceeded" : "firecrawl_lifetime_cap_exceeded";
    this.scope = scope;
    this.count = count;
    this.cap = cap;
  }
}

export class FirecrawlSpendPausedError extends Error {
  public readonly failureReason = "paused_firecrawl_allotment_exhausted";
  public readonly used: number;
  public readonly allotment: number;

  constructor(used: number, allotment: number) {
    super(
      `paused — Firecrawl allotment nearly exhausted for this billing cycle (${used}/${allotment} credits used).`
    );
    this.name = "FirecrawlSpendPausedError";
    this.used = used;
    this.allotment = allotment;
  }
}

const intEnv = (name: string, fallback: number) => {
  const parsed = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Per-stage-attempt caps on Firecrawl calls. The attempt counter is reset each
 * time a stage is claimed (first run, Restart Stage, re-run), so earlier
 * attempts never eat into a fresh one. Worst case by design at defaults:
 * - Research stages 1-3: well under 25 calls per stage -> cap 25
 * - Legacy Stage 4: up to 5 searches + 2 LinkedIn lookups = 7; legacy Stage 5:
 *   up to 4 calls x 8 companies = 32 -> cap 35
 */
export function getResearchRunCap(): number {
  return intEnv("FIRECRAWL_RESEARCH_RUN_CAP", 25);
}

export function getCampaignRunCap(): number {
  return intEnv("FIRECRAWL_CAMPAIGN_RUN_CAP", 35);
}

/**
 * Lifetime backstops across every attempt of one research run / campaign, so
 * repeated restarts can never burn unbounded credits. A full legacy campaign
 * pass (stages 4+5) is at most 39 calls, so 120 allows about three passes.
 */
export function getResearchRunLifetimeCap(): number {
  return intEnv("FIRECRAWL_RESEARCH_RUN_LIFETIME_CAP", 75);
}

export function getCampaignLifetimeCap(): number {
  return intEnv("FIRECRAWL_CAMPAIGN_LIFETIME_CAP", 120);
}

/**
 * Real monthly Firecrawl credit allotment from active plan.
 * Default 1,500 credits per billing cycle.
 */
export function getMonthlyFirecrawlAllotment(): number {
  return process.env.FIRECRAWL_MONTHLY_ALLOTMENT
    ? parseInt(process.env.FIRECRAWL_MONTHLY_ALLOTMENT, 10)
    : 1500;
}

export const FIRECRAWL_ALERT_THRESHOLDS = [50, 75, 90] as const;
export const FIRECRAWL_HARD_PAUSE_PERCENTAGE = 95;

export interface FirecrawlRunContext {
  organizationId?: string;
  researchRunId?: string;
  campaignId?: string;
}

/**
 * Checks whether the requested Firecrawl call is allowed, and reserves it:
 * 1) Organization monthly billing cycle allotment (hard pause at 95%)
 * 2) Per-stage-attempt call cap plus the lifetime backstop for the run/campaign
 */
export async function checkFirecrawlCallAllowed(
  context: FirecrawlRunContext
): Promise<void> {
  const { organizationId, researchRunId, campaignId } = context;

  // 1. Check organization monthly billing cycle pause ceiling (95%)
  if (organizationId) {
    const period = await getOrCreateActiveCreditPeriod(organizationId);
    const allotment = getMonthlyFirecrawlAllotment();
    const used = period.firecrawlCreditsUsed || 0;
    const percentUsed = (used / allotment) * 100;

    if (percentUsed >= FIRECRAWL_HARD_PAUSE_PERCENTAGE) {
      console.warn(
        `[Firecrawl Spend Paused] Organization ${organizationId} reached ${percentUsed.toFixed(1)}% ` +
          `of Firecrawl allotment (${used}/${allotment} credits). New operations are paused.`
      );
      throw new FirecrawlSpendPausedError(used, allotment);
    }
  }

  // 2. Reserve one call from the stage-attempt budget and the lifetime
  //    backstop in a single conditional UPDATE, so the count and the check
  //    can never race. A reservation is spent whatever the call's outcome.
  if (researchRunId) {
    await reserveResearchRunCall(researchRunId);
  }
  if (campaignId) {
    await reserveCampaignCall(campaignId);
  }
}

function capError(
  label: string,
  attempt: { count: number; cap: number },
  lifetime: { count: number; cap: number }
): FirecrawlCallCapExceededError {
  const scope: FirecrawlCapScope = lifetime.count >= lifetime.cap ? "lifetime" : "attempt";
  const { count, cap } = scope === "lifetime" ? lifetime : attempt;
  console.warn(
    `[Firecrawl Cap Exceeded] ${label} reached its ${scope} cap of ${cap} calls ` +
      `(${count} already used). Stopping execution.`
  );
  return new FirecrawlCallCapExceededError(count, cap, scope);
}

async function reserveResearchRunCall(researchRunId: string) {
  const attemptCap = getResearchRunCap();
  const lifetimeCap = getResearchRunLifetimeCap();
  const reserved = await db
    .update(gtmResearchRun)
    .set({
      firecrawlAttemptCallCount: sql`${gtmResearchRun.firecrawlAttemptCallCount} + 1`,
      firecrawlCallCount: sql`${gtmResearchRun.firecrawlCallCount} + 1`,
      // Each call doubles as a pipeline heartbeat (see lib/pipeline/stage-state.ts)
      lastProgressAt: new Date(),
    })
    .where(
      and(
        eq(gtmResearchRun.id, researchRunId),
        lt(gtmResearchRun.firecrawlAttemptCallCount, attemptCap),
        lt(gtmResearchRun.firecrawlCallCount, lifetimeCap)
      )
    )
    .returning({ id: gtmResearchRun.id });
  if (reserved.length > 0) return;

  const [run] = await db
    .select({
      attempt: gtmResearchRun.firecrawlAttemptCallCount,
      lifetime: gtmResearchRun.firecrawlCallCount,
    })
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.id, researchRunId));
  throw capError(
    `Research run ${researchRunId}`,
    { count: run?.attempt ?? 0, cap: attemptCap },
    { count: run?.lifetime ?? 0, cap: lifetimeCap }
  );
}

async function reserveCampaignCall(campaignId: string) {
  const attemptCap = getCampaignRunCap();
  const lifetimeCap = getCampaignLifetimeCap();
  const reserved = await db
    .update(gtmOutreachCampaign)
    .set({
      firecrawlAttemptCallCount: sql`${gtmOutreachCampaign.firecrawlAttemptCallCount} + 1`,
      firecrawlCallCount: sql`${gtmOutreachCampaign.firecrawlCallCount} + 1`,
      lastProgressAt: new Date(),
    })
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        lt(gtmOutreachCampaign.firecrawlAttemptCallCount, attemptCap),
        lt(gtmOutreachCampaign.firecrawlCallCount, lifetimeCap)
      )
    )
    .returning({ id: gtmOutreachCampaign.id });
  if (reserved.length > 0) return;

  const [campaign] = await db
    .select({
      attempt: gtmOutreachCampaign.firecrawlAttemptCallCount,
      lifetime: gtmOutreachCampaign.firecrawlCallCount,
    })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId));
  throw capError(
    `Campaign ${campaignId}`,
    { count: campaign?.attempt ?? 0, cap: attemptCap },
    { count: campaign?.lifetime ?? 0, cap: lifetimeCap }
  );
}

/**
 * Records Firecrawl consumption once a call got a response:
 * 1) Heartbeats the run/campaign (the call was already counted against its
 *    caps by checkFirecrawlCallAllowed)
 * 2) Increments organization credit period consumption
 * 3) Logs usageEvent
 * 4) Triggers internal alerting at 50%, 75%, 90%
 */
export async function recordFirecrawlUsage({
  organizationId,
  researchRunId,
  campaignId,
  units = 1,
  metadata,
}: FirecrawlRunContext & {
  units?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const now = new Date();

  // Heartbeat after a (possibly long) call; see lib/pipeline/stage-state.ts
  if (researchRunId) {
    await db
      .update(gtmResearchRun)
      .set({ lastProgressAt: now })
      .where(eq(gtmResearchRun.id, researchRunId));
  }
  if (campaignId) {
    await db
      .update(gtmOutreachCampaign)
      .set({ lastProgressAt: now })
      .where(eq(gtmOutreachCampaign.id, campaignId));
  }

  // Org-level metering & alerting
  if (organizationId) {
    const period = await getOrCreateActiveCreditPeriod(organizationId);
    const updatedUsed = (period.firecrawlCreditsUsed || 0) + units;
    const allotment = getMonthlyFirecrawlAllotment();
    const percentUsed = (updatedUsed / allotment) * 100;

    const currentAlertsSent = (period.firecrawlAlertsSent as number[]) || [];
    const newAlertsToSend: number[] = [];

    for (const threshold of FIRECRAWL_ALERT_THRESHOLDS) {
      if (percentUsed >= threshold && !currentAlertsSent.includes(threshold)) {
        newAlertsToSend.push(threshold);
      }
    }

    const updatedAlerts = [...currentAlertsSent, ...newAlertsToSend];

    await db
      .update(organizationCreditPeriod)
      .set({
        firecrawlCreditsUsed: updatedUsed,
        firecrawlAlertsSent: updatedAlerts,
        searchCreditsUsed: sql`${organizationCreditPeriod.searchCreditsUsed} + ${units}`,
        updatedAt: now,
      })
      .where(eq(organizationCreditPeriod.id, period.id));

    await db.insert(usageEvent).values({
      id: crypto.randomUUID(),
      organizationId,
      type: "web_search",
      toolName: "firecrawl",
      metadata: (metadata as any) ?? null,
      createdAt: now,
    });

    for (const threshold of newAlertsToSend) {
      await sendFirecrawlSpendAlert({
        organizationId,
        threshold,
        used: updatedUsed,
        allotment,
        percent: percentUsed,
      });
    }
  }
}

/**
 * Fires internal server log + email alert to the founder at 50%, 75%, 90% thresholds.
 */
export async function sendFirecrawlSpendAlert({
  organizationId,
  threshold,
  used,
  allotment,
  percent,
}: {
  organizationId: string;
  threshold: number;
  used: number;
  allotment: number;
  percent: number;
}) {
  const alertMsg =
    `[FIRECRAWL SPEND ALERT] Organization ${organizationId} has reached ${threshold}% ` +
    `of monthly Firecrawl credit allotment (${used}/${allotment} credits, ${percent.toFixed(1)}%).`;

  console.warn(alertMsg);

  const founderEmail =
    process.env.FOUNDER_ALERT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "founder@scrunity.com";

  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "[Firecrawl Alert] RESEND_API_KEY is not set. Skipped alert email."
    );
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Scrunity Alerts <noreply@scrunity.com>",
      to: founderEmail,
      subject: `[Scrunity Alert] Firecrawl credit spend reached ${threshold}% (${used}/${allotment})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d97706; margin-top: 0;">Firecrawl Spend Threshold Alert</h2>
          <p>Your organization's Firecrawl credit usage has crossed the <strong>${threshold}%</strong> warning threshold for the current billing cycle.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Organization ID:</strong> ${organizationId}</p>
            <p style="margin: 0 0 8px 0;"><strong>Credits Consumed:</strong> ${used} / ${allotment} (${percent.toFixed(1)}%)</p>
            <p style="margin: 0;"><strong>Remaining Credits:</strong> ${Math.max(0, allotment - used)}</p>
          </div>
          <p style="font-size: 13px; color: #6b7280;">
            Note: New web research operations will be automatically paused when consumption reaches 95% (${Math.round(allotment * 0.95)} credits) to preserve your account balance.
          </p>
        </div>
      `,
    });
    console.log(`[Firecrawl Alert] Sent threshold email for ${threshold}% to ${founderEmail}`);
  } catch (err) {
    console.error("[Firecrawl Alert] Failed to send email alert:", err);
  }
}
