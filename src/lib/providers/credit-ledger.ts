import { VendorCreditCapError } from "./types"

/**
 * Vendor-neutral credit reservation: reserve the most a call can cost before
 * it is made, then settle with what the vendor charged. Used by Firecrawl data
 * (platform-paid) and by customer-connected providers (Apollo), which differ
 * only in their caps: a platform vendor has a monthly cap, a customer's own
 * account has none of ours, only the per-run cap that protects their credits.
 */

export interface CreditLedger {
  /** Reserves `credits` or throws VendorCreditCapError (no call may follow). Returns the reservation id. */
  reserve(credits: number, endpoint: string): Promise<string>
  /** Replaces a reservation with the real charge. */
  settle(reservationId: string, credits: number, endpoint: string): Promise<void>
}

export interface CreditCaps {
  /** Platform-paid vendors only; null for a customer's own account. */
  monthlyCap: number | null
  /** Credits one campaign may spend across all its attempts; null for no run cap. */
  runCap: number | null
}

/** Which cap a reservation of `credits` would break, if any. Same rule as the SQL in vendor-usage.ts. */
export function exceededCap({
  monthUsed,
  runUsed,
  credits,
  monthlyCap,
  runCap,
}: {
  monthUsed: number
  runUsed: number
  credits: number
} & CreditCaps): "monthly" | "run" | null {
  if (monthlyCap !== null && monthUsed + credits > monthlyCap) return "monthly"
  if (runCap !== null && runUsed + credits > runCap) return "run"
  return null
}

/** True when an error says the request reached the vendor and may have been billed. */
function maybeCharged(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { charged?: unknown }).charged === "unknown"
}

/**
 * Reserves `estimate` (the most the call can cost), makes the call, then
 * settles with what the vendor charged. A call that failed before reaching the
 * vendor settles at 0; one that may have been billed keeps the estimate.
 */
export async function withReservedCredits<T>(
  ledger: CreditLedger,
  estimate: number,
  endpoint: string,
  call: () => Promise<{ value: T; creditsCost: number }>
): Promise<T> {
  const reservationId = await ledger.reserve(estimate, `${endpoint} (reserved)`)
  try {
    const { value, creditsCost } = await call()
    await ledger.settle(reservationId, creditsCost, endpoint)
    return value
  } catch (err) {
    await ledger.settle(reservationId, maybeCharged(err) ? estimate : 0, `${endpoint} (failed)`)
    throw err
  }
}

/** In-memory ledger with the same cap rule, for tests. */
export function memoryCreditLedger(caps: CreditCaps, used = { month: 0, run: 0 }, vendor = "memory") {
  const reservations = new Map<string, number>()
  let next = 0
  const ledger: CreditLedger & { used: typeof used; settled: Array<{ endpoint: string; credits: number }> } = {
    used,
    settled: [],
    async reserve(credits) {
      const over = exceededCap({ monthUsed: used.month, runUsed: used.run, credits, ...caps })
      if (over) {
        const cap = over === "monthly" ? (caps.monthlyCap ?? 0) : (caps.runCap ?? 0)
        throw new VendorCreditCapError(vendor, over === "monthly" ? used.month : used.run, cap, credits, over)
      }
      const id = `r${next++}`
      reservations.set(id, credits)
      used.month += credits
      used.run += credits
      return id
    },
    async settle(id, credits, endpoint) {
      const reserved = reservations.get(id) ?? 0
      used.month += credits - reserved
      used.run += credits - reserved
      reservations.set(id, credits)
      ledger.settled.push({ endpoint, credits })
    },
  }
  return ledger
}
