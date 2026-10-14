import {
  newCompanyLookup,
  runLookupParts,
} from "@/inngest/functions/find-contacts-lookup"
import {
  isValidPersonName,
  scoreTitleMatch,
  type TeamCandidate,
} from "@/lib/gtm-contact-matcher"
import type {
  DecisionMakerQuery,
  NormalizedPerson,
  PeopleDiscoveryProvider,
  VendorSpendContext,
} from "./types"
import type { gtmProspectCompany } from "@/db/schema"

/** Same floor the legacy single-pick used (selectMatchingDecisionMaker). */
const MIN_TITLE_SCORE = 70
const FIRST_PASS = { maxRetries: 1 }
const PATIENT_PASS = { maxRetries: 3, baseDelayMs: 5_000 }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const isLinkedInProfile = (url?: string) => Boolean(url && /linkedin\.com\/in\//i.test(url))

/**
 * Interim decision-maker provider: the existing web discovery (a site search
 * for team/leadership pages plus a LinkedIn snippet search, both through
 * Firecrawl and its limiter and caps). Returns every plausible person ranked by
 * title match, with a LinkedIn profile URL attached when either search found
 * one for that name. A paid people vendor can replace it behind
 * PeopleDiscoveryProvider without touching the verified-lead search.
 *
 * The homepage scrape the legacy stage made (to find an address printed on the
 * site) is no longer run: scraped addresses are never used.
 */
export const webPeopleProvider: PeopleDiscoveryProvider = {
  key: "web",
  async findDecisionMakers(query: DecisionMakerQuery, context: VendorSpendContext) {
    // runLookupParts reads only id/domain/name; the rest of the row is unused here.
    const lookup = newCompanyLookup({
      id: query.company.providerId ?? query.company.domain,
      domain: query.company.domain,
      name: query.company.name,
    } as typeof gtmProspectCompany.$inferSelect)

    const titles = query.titles.filter(Boolean)
    await runLookupParts(
      lookup,
      {
        runContext: {
          campaignId: context.campaignId ?? undefined,
          organizationId: context.organizationId ?? undefined,
        },
        targetRole: { jobFunctions: titles, searchKeyword: titles[0] ?? "founder" },
        ...(query.patient ? PATIENT_PASS : FIRST_PASS),
      },
      ["team", "linkedin"]
    )

    const people = rankCandidates(
      [...lookup.teamCandidates, ...lookup.linkedinCandidates],
      titles,
      query.company.domain
    ).slice(0, query.limit)
    return { people, creditsUsed: 0, incomplete: lookup.incomplete.size > 0 }
  },
}

/** Valid, de-duplicated people with a matching title, best match first. */
export function rankCandidates(
  candidates: TeamCandidate[],
  titles: string[],
  domain: string
): NormalizedPerson[] {
  const byName = new Map<string, { candidate: TeamCandidate; score: number; linkedinUrl: string | null }>()
  for (const candidate of candidates) {
    if (!isValidPersonName(candidate.name)) continue
    const key = candidate.name.trim().toLowerCase()
    const score = scoreTitleMatch(candidate.title, titles).score
    const linkedinUrl = isLinkedInProfile(candidate.url) ? candidate.url! : null
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { candidate, score, linkedinUrl })
      continue
    }
    existing.linkedinUrl ??= linkedinUrl
    if (score > existing.score) Object.assign(existing, { candidate, score })
  }
  return [...byName.values()]
    .filter((p) => p.score >= MIN_TITLE_SCORE)
    .sort((a, b) => b.score - a.score)
    .map(({ candidate, linkedinUrl }) => {
      const [firstName, ...rest] = candidate.name.trim().split(/\s+/)
      return {
        providerPersonId: `web:${domain}:${slug(candidate.name)}`,
        firstName,
        lastName: rest.join(" "),
        title: candidate.title || null,
        linkedinUrl,
        location: null,
        source: "web",
      }
    })
}
