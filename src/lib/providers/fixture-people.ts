import synthetic from "./fixtures/people-synthetic.json"
import type {
  DecisionMakerQuery,
  NormalizedPerson,
  PeopleDiscoveryProvider,
} from "./types"

interface SyntheticPerson {
  id: string
  domain: string
  first_name: string
  last_name: string
  title: string
  city: string
  state: string
  country: string
}

const PEOPLE: SyntheticPerson[] = synthetic.people

function toNormalized(person: SyntheticPerson): NormalizedPerson {
  return {
    providerPersonId: person.id,
    firstName: person.first_name,
    lastName: person.last_name,
    title: person.title,
    linkedinUrl:
      `https://linkedin.example/in/${person.first_name}-${person.last_name}`.toLowerCase(),
    location: [person.city, person.state, person.country].join(", "),
    source: "fixture",
  }
}

/**
 * Serves invented decision makers from `fixtures/people-synthetic.json` with
 * zero network calls and zero credits. It applies the same person-location
 * filter a real vendor would (country, then state when given) but ignores the
 * title list, so tests don't depend on what the LLM derives. This is the only
 * people provider until a vendor that allows people search is chosen.
 */
export const fixturePeopleProvider: PeopleDiscoveryProvider = {
  key: "fixture",
  async findDecisionMakers(query: DecisionMakerQuery) {
    const country = query.country.trim().toLowerCase()
    const state = query.state?.trim().toLowerCase()
    const people = PEOPLE.filter(
      (p) =>
        p.domain === query.company.domain &&
        p.country.toLowerCase() === country &&
        (!state ||
          p.state.toLowerCase() === state ||
          p.city.toLowerCase().includes(state))
    )
      .slice(0, query.limit)
      .map(toNormalized)
    return { people, creditsUsed: 0 }
  },
}
