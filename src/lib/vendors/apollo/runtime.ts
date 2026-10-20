import { readConnectionSecret } from "@/lib/data-sources/connections"
import type { CreditLedger } from "@/lib/providers/credit-ledger"
import { getApolloRunCreditCap, getProviderMode } from "@/lib/providers/config"
import type { VendorSpendContext } from "@/lib/providers/types"
import { reserveVendorCredits, settleVendorCredits } from "@/lib/providers/vendor-usage"
import type { ApolloClientDeps } from "./client"
import { apolloFixtureFetch } from "./fixtures"
import { getConnectionLimiter } from "./limiter"

/**
 * Binds the pure Apollo calls to one customer connection: its decrypted key
 * (read here, inside the step, from the connection id in the spend context),
 * its own limiter, and the gtm_vendor_usage ledger with the per-run cap only.
 * In GTM_PROVIDER_MODE=fixture the transport is the offline fixture fetch.
 */

const APOLLO_CUSTOMER_VENDOR = "apollo_customer"

/** Ledger vendor for spend on customers' own Apollo accounts (never counted against a platform cap). */
export function apolloLedgerVendor(): string {
  return getProviderMode() === "fixture" ? `${APOLLO_CUSTOMER_VENDOR}_fixture` : APOLLO_CUSTOMER_VENDOR
}

export class MissingConnectionContextError extends Error {
  public readonly failureReason = "data_source_not_connected"
  constructor() {
    super("An Apollo call was made without an organization and connection id.")
    this.name = "MissingConnectionContextError"
  }
}

function connectionOf(context: VendorSpendContext): { organizationId: string; connectionId: string } {
  if (!context.organizationId || !context.connectionId) throw new MissingConnectionContextError()
  return { organizationId: context.organizationId, connectionId: context.connectionId }
}

/** Client deps for one call. The key lives only in the returned object, for the call's duration. */
export async function apolloDepsFor(context: VendorSpendContext): Promise<ApolloClientDeps> {
  const { organizationId, connectionId } = connectionOf(context)
  const apiKey = await readConnectionSecret(organizationId, connectionId)
  const limiter = getConnectionLimiter(connectionId)
  return getProviderMode() === "fixture" ? { apiKey, limiter, fetch: apolloFixtureFetch } : { apiKey, limiter }
}

/** Client deps for validating a key before it is stored (connect). */
export function apolloDepsForNewKey(apiKey: string, limiterKey: string): ApolloClientDeps {
  const limiter = getConnectionLimiter(`connect:${limiterKey}`)
  return getProviderMode() === "fixture" ? { apiKey, limiter, fetch: apolloFixtureFetch } : { apiKey, limiter }
}

/** The ledger for one campaign on a customer's account: no monthly cap, APOLLO_RUN_CREDIT_CAP per campaign. */
export function apolloLedger(context: VendorSpendContext): CreditLedger {
  return {
    reserve: (credits, endpoint) =>
      reserveVendorCredits({
        vendor: apolloLedgerVendor(),
        endpoint,
        credits,
        cap: null,
        campaignCap: getApolloRunCreditCap(),
        context,
      }),
    settle: (reservationId, credits, endpoint) => settleVendorCredits(reservationId, credits, endpoint),
  }
}
