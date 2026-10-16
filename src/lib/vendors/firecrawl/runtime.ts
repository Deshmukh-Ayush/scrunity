import {
  getFirecrawlMonthlyCreditCap,
  getFirecrawlRunCreditCap,
  getProviderMode,
} from "@/lib/providers/config"
import { reserveVendorCredits, settleVendorCredits } from "@/lib/providers/vendor-usage"
import type { VendorSpendContext } from "@/lib/providers/types"
import type { FirecrawlClientDeps } from "./client"
import { FIRECRAWL_DATA_VENDOR, type CreditLedger } from "./credits"
import { fixtureFetch } from "./fixtures"

/**
 * Wiring between the pure Firecrawl data modules and the app: the ledger and,
 * in GTM_PROVIDER_MODE=fixture, the offline transport.
 */

const fixtureMode = () => getProviderMode() === "fixture"

/**
 * Ledger vendor for Firecrawl data credits. Fixture runs record under
 * "firecrawl_data_fixture", so tests exercise the same caps without eating into
 * the real monthly cap.
 */
export function firecrawlLedgerVendor(): string {
  return fixtureMode() ? `${FIRECRAWL_DATA_VENDOR}_fixture` : FIRECRAWL_DATA_VENDOR
}

/** Fixture mode: answers from fixtures with zero network calls and no key. Live: the defaults. */
export function firecrawlClientDeps(): FirecrawlClientDeps {
  if (!fixtureMode()) return {}
  return { fetch: fixtureFetch, apiKey: "fixture", schedule: (request) => request() }
}

/**
 * The gtm_vendor_usage ledger for one campaign: every reservation is checked
 * atomically against FIRECRAWL_MONTHLY_CREDIT_CAP and FIRECRAWL_RUN_CREDIT_CAP
 * before the call is made.
 */
export function dbCreditLedger(context: VendorSpendContext): CreditLedger {
  return {
    reserve: (credits, endpoint) =>
      reserveVendorCredits({
        vendor: firecrawlLedgerVendor(),
        endpoint,
        credits,
        cap: getFirecrawlMonthlyCreditCap(),
        campaignCap: getFirecrawlRunCreditCap(),
        context,
      }),
    settle: (reservationId, credits, endpoint) => settleVendorCredits(reservationId, credits, endpoint),
  }
}
