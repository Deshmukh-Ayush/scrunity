import {
  getFirecrawlMonthlyCreditCap,
  getFirecrawlRunCreditCap,
  getProviderMode,
} from "@/lib/providers/config"
import { reserveVendorCredits, settleVendorCredits } from "@/lib/providers/vendor-usage"
import type { VendorSpendContext } from "@/lib/providers/types"
import { FIRECRAWL_DATA_VENDOR, type CreditLedger } from "./credits"

/**
 * Ledger vendor for Firecrawl data credits. Fixture runs record under
 * "firecrawl_data_fixture", so tests exercise the same caps without eating into
 * the real monthly cap.
 */
export function firecrawlLedgerVendor(): string {
  return getProviderMode() === "fixture" ? `${FIRECRAWL_DATA_VENDOR}_fixture` : FIRECRAWL_DATA_VENDOR
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
