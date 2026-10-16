import type { PeopleDiscoveryProvider } from "./types"

/**
 * Decision makers with PEOPLE_DATA_PROVIDER=firecrawl. Stage 4's people search
 * already found and stored each company's people (lead_search_state.prefetched),
 * and the verified-lead search reads them from there. This provider is only
 * asked about a company that has none stored, and answers with nobody: no call,
 * no credits, never a second search.
 */
export const storedPeopleProvider: PeopleDiscoveryProvider = {
  key: "stored",
  async findDecisionMakers() {
    return { people: [], creditsUsed: 0 }
  },
}
