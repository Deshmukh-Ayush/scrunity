import crypto from "crypto"
import { and, eq, gte, sql } from "drizzle-orm"
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
 * the row is inserted only if this month's total stays within `cap`, so two
 * concurrent lookups cannot both slip under the cap. Returns the reservation id
 * to settle with the real cost once the vendor reports it.
 */
export async function reserveVendorCredits({
  vendor,
  endpoint,
  credits,
  cap,
  context,
}: {
  vendor: string
  endpoint: string
  credits: number
  cap: number
  context: VendorSpendContext
}): Promise<string> {
  const id = crypto.randomUUID()
  const inserted = await db.execute(sql`
    INSERT INTO gtm_vendor_usage (id, vendor, endpoint, credits_used, organization_id, research_run_id, campaign_id)
    SELECT ${id}, ${vendor}, ${endpoint}, ${credits}, ${context.organizationId ?? null},
      ${context.researchRunId ?? null}, ${context.campaignId ?? null}
    WHERE (
      SELECT coalesce(sum(credits_used), 0) FROM gtm_vendor_usage
      WHERE vendor = ${vendor} AND created_at >= ${startOfMonthUtc().toISOString()}
    ) + ${credits} <= ${cap}
    RETURNING id`)
  if (inserted.rows.length === 0) {
    throw new VendorCreditCapError(vendor, await getMonthlyVendorCredits(vendor), cap, credits)
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

/** Credits recorded for a vendor against one campaign (all months). */
export async function getCampaignVendorCredits(vendor: string, campaignId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${gtmVendorUsage.creditsUsed}), 0)::int` })
    .from(gtmVendorUsage)
    .where(and(eq(gtmVendorUsage.vendor, vendor), eq(gtmVendorUsage.campaignId, campaignId)))
  return Number(row?.total ?? 0)
}
