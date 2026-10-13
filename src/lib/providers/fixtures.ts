import type { ApolloOrgSearchResponse } from "./apollo"
import australia from "./fixtures/apollo-org-search-australia.json"
import delhiIndia from "./fixtures/apollo-org-search-delhi-india.json"

/**
 * Recorded, sanitized Apollo responses for GTM_PROVIDER_MODE=fixture. They are
 * real API output, so they only cover the filters they were recorded with
 * (Delhi, India and Australia); any other country falls back to Delhi.
 */
const APOLLO_ORG_SEARCH_FIXTURES: Record<string, ApolloOrgSearchResponse> = {
  india: delhiIndia,
  australia,
}

export function loadApolloOrgSearchFixture(country: string): ApolloOrgSearchResponse {
  return APOLLO_ORG_SEARCH_FIXTURES[country.trim().toLowerCase()] ?? delhiIndia
}
