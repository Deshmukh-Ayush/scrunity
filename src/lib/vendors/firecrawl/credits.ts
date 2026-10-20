import { memoryCreditLedger as genericMemoryLedger, type CreditCaps } from "@/lib/providers/credit-ledger"

/**
 * Firecrawl data credits: reserved before every call, settled with the
 * `creditsCost` Firecrawl returns. A call that would push this month's or this
 * campaign's spend past its cap is refused before any request is made. The
 * reservation logic is shared with customer-connected providers
 * (lib/providers/credit-ledger.ts).
 *
 * Data credits use their own ledger vendor ("firecrawl_data"), separate from the
 * "firecrawl" rows that count web calls for the per-organization daily call cap.
 */

export { exceededCap, withReservedCredits, type CreditLedger } from "@/lib/providers/credit-ledger"

export const FIRECRAWL_DATA_VENDOR = "firecrawl_data"

/** In-memory ledger with the same cap rule, for tests. */
export function memoryCreditLedger(caps: CreditCaps, used = { month: 0, run: 0 }) {
  return genericMemoryLedger(caps, used, FIRECRAWL_DATA_VENDOR)
}
