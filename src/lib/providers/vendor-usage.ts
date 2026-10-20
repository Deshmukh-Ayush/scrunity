import crypto from "crypto"
import { and, eq, gte, like, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmVendorUsage } from "@/db/schema"
import { VendorCreditCapError, type VendorSpendContext } from "./types"

/** Start of the current calendar month in UTC; caps reset here. */
function startOfMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** Credits recorded for a vendor since the start of this month. */
export async function getMonthlyVendorCredits(vendor: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${gtmVendorUsage.creditsUsed}), 0)::int` })
    .from(gtmVendorUsage)
    .where(
      and(
        eq(gtmVendorUsage.vendor, vendor),
        gte(gtmVendorUsage.createdAt, startOfMonthUtc())
      )
    )
  return Number(row?.total ?? 0)
}

/**
 * Throws VendorCreditCapError when spending `credits` more would exceed `cap`.
 * Call this before the network request, never after.
 */
export async function assertVendorCreditsAvailable(
  vendor: string,
  credits: number,
  cap: number
): Promise<void> {
  const used = await getMonthlyVendorCredits(vendor)
  if (used + credits > cap) {
    throw new VendorCreditCapError(vendor, used, cap, credits)
  }
}

export async function recordVendorUsage({
  vendor,
  endpoint,
  creditsUsed,
  context,
}: {
  vendor: string
  endpoint: string
  creditsUsed: number
  context: VendorSpendContext
}): Promise<void> {
  await db.insert(gtmVendorUsage).values({
    vendor,
    endpoint,
    creditsUsed,
    organizationId: context.organizationId ?? null,
    researchRunId: context.researchRunId ?? null,
    campaignId: context.campaignId ?? null,
  })
}

/**
 * Reserves `credits` in the ledger before a vendor call, in one SQL statement:
 * the row is inserted only if this month's total stays within `cap` (and, when
 * `campaignCap` is given, this campaign's total within it), so two concurrent
 * calls cannot both slip under a cap. Returns the reservation id to settle with
 * the real cost once the vendor reports it.
 */
export async function reserveVendorCredits({
  vendor,
  endpoint,
  credits,
  cap,
  campaignCap,
  context,
}: {
  vendor: string
  endpoint: string
  credits: number
  /** Monthly cap for platform-paid vendors; null for a customer's own account. */
  cap: number | null
  campaignCap?: number | null
  context: VendorSpendContext
}): Promise<string> {
  const id = crypto.randomUUID()
  const campaignId = context.campaignId ?? null
  const runLimit = campaignCap != null && campaignId ? campaignCap : null
  const inserted = await db.execute(sql`
    INSERT INTO gtm_vendor_usage (id, vendor, endpoint, credits_used, organization_id, research_run_id, campaign_id)
    SELECT ${id}, ${vendor}, ${endpoint}, ${credits}, ${context.organizationId ?? null},
      ${context.researchRunId ?? null}, ${campaignId}
    WHERE (${cap}::int IS NULL OR (
      SELECT coalesce(sum(credits_used), 0) FROM gtm_vendor_usage
      WHERE vendor = ${vendor} AND created_at >= ${startOfMonthUtc().toISOString()}
    ) + ${credits} <= ${cap}::int)
    AND (${runLimit}::int IS NULL OR (
      SELECT coalesce(sum(credits_used), 0) FROM gtm_vendor_usage
      WHERE vendor = ${vendor} AND campaign_id = ${campaignId}
    ) + ${credits} <= ${runLimit}::int)
    RETURNING id`)
  if (inserted.rows.length === 0) {
    const monthUsed = cap === null ? 0 : await getMonthlyVendorCredits(vendor)
    if (cap !== null && (monthUsed + credits > cap || runLimit === null || !campaignId)) {
      throw new VendorCreditCapError(vendor, monthUsed, cap, credits)
    }
    if (runLimit === null || !campaignId) {
      // Unreachable without any cap; kept so the error below always has a campaign.
      throw new VendorCreditCapError(vendor, 0, 0, credits, "run")
    }
    const runUsed = await getCampaignVendorCredits(vendor, campaignId)
    throw new VendorCreditCapError(vendor, runUsed, runLimit, credits, "run")
  }
  return id
}

/** Replaces a reservation with the credits the vendor actually charged. */
export async function settleVendorCredits(reservationId: string, creditsUsed: number, endpoint?: string) {
  await db
    .update(gtmVendorUsage)
    .set(endpoint ? { creditsUsed, endpoint } : { creditsUsed })
    .where(eq(gtmVendorUsage.id, reservationId))
}

/**
 * Credits recorded for a vendor against one campaign (all months), optionally
 * only for endpoints starting with `endpointPrefix` (e.g. "contacts/work-email").
 */
export async function getCampaignVendorCredits(vendor: string, campaignId: string, endpointPrefix?: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${gtmVendorUsage.creditsUsed}), 0)::int` })
    .from(gtmVendorUsage)
    .where(
      and(
        eq(gtmVendorUsage.vendor, vendor),
        eq(gtmVendorUsage.campaignId, campaignId),
        endpointPrefix ? like(gtmVendorUsage.endpoint, `${endpointPrefix}%`) : undefined
      )
    )
  return Number(row?.total ?? 0)
}
