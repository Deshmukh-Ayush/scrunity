import { markConnectionInvalid, recordConnectionError } from "@/lib/data-sources/connections"
import { matchPeople, searchOrganizations, searchPeopleAtCompany } from "@/lib/vendors/apollo/calls"
import { BULK_MATCH_MAX_PEOPLE, BULK_MATCH_PATH, PEOPLE_MATCH_CREDITS_PER_PERSON } from "@/lib/vendors/apollo/constants"
import { ApolloError, invalidatesConnection } from "@/lib/vendors/apollo/errors"
import { apolloDepsFor, apolloLedger } from "@/lib/vendors/apollo/runtime"
import { APOLLO_SOURCE } from "@/lib/vendors/apollo/org-search"
import { publicDataSourceCode } from "@/lib/data-sources/codes"
import type {
  CompanyDiscoveryProvider,
  EmailEnrichmentProvider,
  PeopleDiscoveryProvider,
  VendorSpendContext,
} from "./types"

/**
 * Apollo with the customer's own key (bring your own key). Stage 4 searches
 * companies (1 credit per page), Stage 5 searches decision makers per company
 * (free) and reveals the chosen ones in batches of up to 10 (at most 1 credit
 * each). Credits are reserved against the per-run cap before every paid call.
 *
 * A rejected key marks the connection invalid (campaigns stop and ask the
 * customer to reconnect); plan and credit failures are recorded on the
 * connection for the Data sources page. The error is always rethrown.
 */

async function recordFailure(context: VendorSpendContext, err: unknown) {
  if (!(err instanceof ApolloError) || !context.connectionId) return
  const code = publicDataSourceCode(err.failureReason)
  if (invalidatesConnection(err.failureReason)) await markConnectionInvalid(context.connectionId, code)
  else if (err.failureReason !== "apollo_request_failed") await recordConnectionError(context.connectionId, code)
}

async function withConnection<T>(context: VendorSpendContext, call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (err) {
    await recordFailure(context, err)
    throw err
  }
}

export const apolloCustomerCompanyProvider: CompanyDiscoveryProvider = {
  key: APOLLO_SOURCE,
  searchCompanies: (query, context) =>
    withConnection(context, async () =>
      searchOrganizations(query, { deps: await apolloDepsFor(context), ledger: apolloLedger(context) })
    ),
}

export const apolloCustomerPeopleProvider: PeopleDiscoveryProvider = {
  key: APOLLO_SOURCE,
  revealsOnLookup: true,
  async findDecisionMakers(query, context) {
    try {
      const people = await withConnection(context, async () => searchPeopleAtCompany(query, await apolloDepsFor(context)))
      return { people: people.slice(0, query.limit), creditsUsed: 0 }
    } catch (err) {
      // Still rate-limited after the client's retries: unknown, retried later, not "nobody".
      if (err instanceof ApolloError && err.failureReason === "apollo_rate_limited") {
        return { people: [], creditsUsed: 0, incomplete: true }
      }
      throw err
    }
  },
}

/** Ref stored on a contact queued for the next batch (Apollo answers synchronously). */
const QUEUED_REF = "queued"

export const apolloCustomerEmailProvider: EmailEnrichmentProvider = {
  key: APOLLO_SOURCE,
  maxCreditsPerLookup: PEOPLE_MATCH_CREDITS_PER_PERSON,
  maxBatchSize: BULK_MATCH_MAX_PEOPLE,
  lookupEndpoint: BULK_MATCH_PATH,
  async start() {
    return { ref: QUEUED_REF }
  },
  async poll() {
    return null
  },
  lookupBatch: (inputs, context) =>
    withConnection(context, async () =>
      matchPeople(inputs, { deps: await apolloDepsFor(context), ledger: apolloLedger(context) })
    ),
}
