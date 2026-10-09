import { and, eq, sql } from "drizzle-orm";
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

export class FirecrawlCallCapExceededError extends Error {
  public readonly failureReason = "firecrawl_call_cap_exceeded";
  public readonly count: number;
  public readonly cap: number;

  constructor(count: number, cap: number) {
    super(
      `Firecrawl per-run call cap exceeded: ${count} calls made (cap is ${cap}).`
    );
    this.name = "FirecrawlCallCapExceededError";
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

/**
 * Hard per-run caps on Firecrawl calls.
 * Sized with ~3x headroom above expected count:
 * - Research Run (Stage 1-3): expected ~8 calls -> default cap = 25
 * - Campaign Pass (Stage 4-5): expected ~10-12 calls -> default cap = 35
 */
export function getResearchRunCap(): number {
  return process.env.FIRECRAWL_RESEARCH_RUN_CAP
    ? parseInt(process.env.FIRECRAWL_RESEARCH_RUN_CAP, 10)
    : 25;
}

export function getCampaignRunCap(): number {
  return process.env.FIRECRAWL_CAMPAIGN_RUN_CAP
    ? parseInt(process.env.FIRECRAWL_CAMPAIGN_RUN_CAP, 10)
    : 35;
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
 * Checks whether the requested Firecrawl call is allowed under both:
 * 1) Organization monthly billing cycle allotment (hard pause at 95%)
 * 2) Run-level call safety cap (3x expected headroom)
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

  // 2. Check per-run cap for research run (Stages 1-3)
  if (researchRunId) {
    const cap = getResearchRunCap();
    const [run] = await db
      .select({ firecrawlCallCount: gtmResearchRun.firecrawlCallCount })
      .from(gtmResearchRun)
      .where(eq(gtmResearchRun.id, researchRunId));

    const currentCount = run?.firecrawlCallCount ?? 0;
    if (currentCount >= cap) {
      console.warn(
        `[Firecrawl Cap Exceeded] Research run ${researchRunId} reached hard cap of ${cap} calls ` +
          `(${currentCount} already executed). Stopping execution.`
      );
      throw new FirecrawlCallCapExceededError(currentCount, cap);
    }
  }

  // 3. Check per-run cap for campaign pass (Stages 4-5)
  if (campaignId) {
    const cap = getCampaignRunCap();
    const [campaign] = await db
      .select({ firecrawlCallCount: gtmOutreachCampaign.firecrawlCallCount })
      .from(gtmOutreachCampaign)
      .where(eq(gtmOutreachCampaign.id, campaignId));

    const currentCount = campaign?.firecrawlCallCount ?? 0;
    if (currentCount >= cap) {
      console.warn(
        `[Firecrawl Cap Exceeded] Campaign ${campaignId} reached hard cap of ${cap} calls ` +
          `(${currentCount} already executed). Stopping execution.`
      );
      throw new FirecrawlCallCapExceededError(currentCount, cap);
    }
  }
}

/**
 * Records Firecrawl consumption:
 * 1) Increments per-run call counter
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

  // Increment research run counter
  if (researchRunId) {
    await db
      .update(gtmResearchRun)
      .set({
        firecrawlCallCount: sql`${gtmResearchRun.firecrawlCallCount} + ${units}`,
      })
      .where(eq(gtmResearchRun.id, researchRunId));
  }

  // Increment campaign counter
  if (campaignId) {
    await db
      .update(gtmOutreachCampaign)
      .set({
        firecrawlCallCount: sql`${gtmOutreachCampaign.firecrawlCallCount} + ${units}`,
      })
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
