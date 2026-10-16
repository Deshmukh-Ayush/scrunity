import { VendorCreditCapError } from "@/lib/providers/types"
import { FirecrawlDataError } from "./errors"

/**
 * Firecrawl data credits: reserved before every call, settled with the
 * `creditsCost` Firecrawl returns. A call that would push this month's or this
 * campaign's spend past its cap is refused before any request is made.
 *
 * Data credits use their own ledger vendor ("firecrawl_data"), separate from the
 * "firecrawl" rows that count web calls for the per-organization daily call cap.
 */

export const FIRECRAWL_DATA_VENDOR = "firecrawl_data"

export interface CreditLedger {
  /** Reserves `credits` or throws VendorCreditCapError (no call may follow). Returns the reservation id. */
  reserve(credits: number, endpoint: string): Promise<string>
  /** Replaces a reservation with the real charge. */
  settle(reservationId: string, credits: number, endpoint: string): Promise<void>
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
  monthlyCap: number
  runCap: number | null
}): "monthly" | "run" | null {
  if (monthUsed + credits > monthlyCap) return "monthly"
  if (runCap !== null && runUsed + credits > runCap) return "run"
  return null
}

/**
 * Reserves `estimate` (the most the call can cost), makes the call, then
 * settles with what Firecrawl charged. A call that failed before reaching
 * Firecrawl settles at 0; one that may have been billed keeps the estimate.
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
    const maybeCharged = err instanceof FirecrawlDataError && err.charged === "unknown"
    await ledger.settle(reservationId, maybeCharged ? estimate : 0, `${endpoint} (failed)`)
    throw err
  }
}

/** In-memory ledger with the same cap rule, for tests. */
export function memoryCreditLedger(caps: { monthlyCap: number; runCap: number | null }, used = { month: 0, run: 0 }) {
  const reservations = new Map<string, number>()
  let next = 0
  const ledger: CreditLedger & { used: typeof used; settled: Array<{ endpoint: string; credits: number }> } = {
    used,
    settled: [],
    async reserve(credits) {
      const over = exceededCap({ monthUsed: used.month, runUsed: used.run, credits, ...caps })
      if (over) {
        const cap = over === "monthly" ? caps.monthlyCap : (caps.runCap ?? 0)
        throw new VendorCreditCapError(FIRECRAWL_DATA_VENDOR, over === "monthly" ? used.month : used.run, cap, credits, over)
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
