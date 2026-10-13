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
