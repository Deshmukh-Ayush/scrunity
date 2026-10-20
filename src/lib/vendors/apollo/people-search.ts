import { z } from "zod"
import type { DecisionMakerQuery, NormalizedPerson } from "@/lib/providers/types"
import { APOLLO_SOURCE } from "./org-search"

/**
 * Apollo People API search (POST /api/v1/mixed_people/api_search, 0 credits)
 * for decision makers at one company, by its domain.
 *
 * Documented response per person: id, first_name, last_name_obfuscated
 * ("first 2 characters, asterisks, last character"), title, has_email and an
 * organization with a name and has_* flags. No email, no LinkedIn URL, no full
 * last name: the paid lookup (people-match.ts) reveals those, and only for the
 * people the search picks.
 */

/** Rows read per company: a few more than the people we may look up. */
const MAX_PER_PAGE = 25

export function buildPeopleSearchParams(query: DecisionMakerQuery): URLSearchParams {
  const params = new URLSearchParams()
  params.append("q_organization_domains_list[]", query.company.domain.toLowerCase())
  for (const title of query.titles.slice(0, 10)) params.append("person_titles[]", title)
  // Similar titles widen "Founder" to "Co-Founder & CEO"; ranking happens on our side.
  params.append("include_similar_titles", "true")
  params.append("page", "1")
  params.append("per_page", String(Math.max(1, Math.min(query.limit, MAX_PER_PAGE))))
  return params
}

const personSchema = z.looseObject({
  id: z.string().min(1),
  first_name: z.string().nullish(),
  last_name_obfuscated: z.string().nullish(),
  last_name: z.string().nullish(),
  title: z.string().nullish(),
  has_email: z.boolean().nullish(),
})

const bodySchema = z.looseObject({ people: z.array(z.unknown()).nullish() })

/**
 * Narrows the search body. People Apollo says have no email are dropped (a
 * lookup could only come back empty); people without a first name or id too.
 * The last name stays masked until a lookup reveals it.
 */
export function parsePeopleSearch(body: unknown): NormalizedPerson[] {
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return []
  const people: NormalizedPerson[] = []
  for (const raw of parsed.data.people ?? []) {
    const person = personSchema.safeParse(raw)
    if (!person.success) continue
    const p = person.data
    const firstName = p.first_name?.trim()
    if (!firstName || p.has_email === false) continue
    people.push({
      providerPersonId: p.id,
      firstName,
      lastName: (p.last_name ?? p.last_name_obfuscated ?? "").trim(),
      title: p.title?.trim() || null,
      linkedinUrl: null,
      location: null,
      source: APOLLO_SOURCE,
    })
  }
  return people
}
