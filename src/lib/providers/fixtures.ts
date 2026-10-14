import type { ApolloOrgSearchResponse } from "./apollo"
import type { FullEnrichResultBody } from "./fullenrich"
import australia from "./fixtures/apollo-org-search-australia.json"
import delhiIndia from "./fixtures/apollo-org-search-delhi-india.json"
import fullEnrichResults from "./fixtures/fullenrich-results.json"

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

interface FullEnrichFixture {
  pendingPolls?: number
  body: FullEnrichResultBody
}
const FULLENRICH_RESULTS = fullEnrichResults.results as Record<string, FullEnrichFixture>
// Polls seen per fixture job, so `pendingPolls` can simulate an asynchronous result.
const fixturePolls = new Map<string, number>()

/**
 * Sanitized FullEnrich result for "first last@domain" (see the file's _note),
 * or IN_PROGRESS while the entry still has pending polls left.
 */
export function loadFullEnrichFixture(key: string): FullEnrichResultBody {
  const entry: FullEnrichFixture = FULLENRICH_RESULTS[key] ?? { body: fullEnrichResults.notFound }
  const seen = fixturePolls.get(key) ?? 0
  fixturePolls.set(key, seen + 1)
  if (seen < (entry.pendingPolls ?? 0)) return { status: "IN_PROGRESS" }
  return entry.body
}
