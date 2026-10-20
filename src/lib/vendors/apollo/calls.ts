import { withReservedCredits, type CreditLedger } from "@/lib/providers/credit-ledger"
import type {
  BatchLookupOutcome,
  CompanyDiscoveryQuery,
  CompanyDiscoveryResult,
  DecisionMakerQuery,
  EmailLookupInput,
  NormalizedPerson,
} from "@/lib/providers/types"
import { apolloRequest, type ApolloClientDeps } from "./client"
import {
  BULK_MATCH_PATH,
  ORG_SEARCH_CREDITS_PER_PAGE,
  ORG_SEARCH_PATH,
  PEOPLE_MATCH_CREDITS_PER_PERSON,
  PEOPLE_SEARCH_PATH,
} from "./constants"
import { buildSearchParams, toOrgSearchResult } from "./org-search"
import { bulkMatchQuery, buildBulkMatchBody, parseBulkMatch } from "./people-match"
import { buildPeopleSearchParams, parsePeopleSearch } from "./people-search"

/**
 * The Apollo calls a campaign makes with a customer's key. Pure: the key,
 * limiter and ledger are passed in (lib/vendors/apollo/runtime.ts binds them
 * to the database), so tests run them against a stubbed fetch.
 */

export interface ApolloCallContext {
  deps: ApolloClientDeps
  ledger: CreditLedger
}

/**
 * Checks a key with one free call (a one-row People API search, 0 credits).
 * It also proves the key can use the search the campaign needs: a plan that
 * blocks it fails here, at connect time, instead of mid-campaign.
 */
export async function validateApolloKey(deps: ApolloClientDeps): Promise<void> {
  const query = new URLSearchParams({ page: "1", per_page: "1" })
  await apolloRequest({ path: PEOPLE_SEARCH_PATH, query }, deps)
}

/** Stage 4: one page of organization search (1 credit, reserved before the call). */
export function searchOrganizations(query: CompanyDiscoveryQuery, { deps, ledger }: ApolloCallContext): Promise<CompanyDiscoveryResult> {
  return withReservedCredits(ledger, ORG_SEARCH_CREDITS_PER_PAGE, ORG_SEARCH_PATH, async () => {
    const body = await apolloRequest({ path: ORG_SEARCH_PATH, query: buildSearchParams(query) }, deps)
    const value = toOrgSearchResult(body, query.limit, ORG_SEARCH_CREDITS_PER_PAGE)
    return { value, creditsCost: ORG_SEARCH_CREDITS_PER_PAGE }
  })
}

/** Stage 5: decision makers at one company (free; no ledger row). */
export async function searchPeopleAtCompany(query: DecisionMakerQuery, deps: ApolloClientDeps): Promise<NormalizedPerson[]> {
  const body = await apolloRequest({ path: PEOPLE_SEARCH_PATH, query: buildPeopleSearchParams(query) }, deps)
  return parsePeopleSearch(body)
}

/** Stage 5: reveal up to 10 people (at most 1 credit each, reserved for the batch). */
export function matchPeople(inputs: EmailLookupInput[], { deps, ledger }: ApolloCallContext): Promise<BatchLookupOutcome[]> {
  const estimate = inputs.length * PEOPLE_MATCH_CREDITS_PER_PERSON
  return withReservedCredits(ledger, estimate, BULK_MATCH_PATH, async () => {
    const body = await apolloRequest(
      { path: BULK_MATCH_PATH, query: bulkMatchQuery(), body: buildBulkMatchBody(inputs) },
      deps
    )
    const { outcomes, creditsCost } = parseBulkMatch(body, inputs)
    return { value: outcomes, creditsCost }
  })
}
