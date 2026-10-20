import type {
  CompanyDiscoveryQuery,
  CompanyDiscoveryResult,
  NormalizedCompany,
} from "@/lib/providers/types"

/**
 * Apollo organization search: request params and response normalization.
 * Pure (no network, no database), shared by the legacy platform-key provider
 * (lib/providers/apollo.ts) and the customer-key provider.
 *
 * Apollo documents `mixed_companies/search` as its company search, but that
 * endpoint returns 403 on the Free plan ("not included in your Free plan").
 * `organizations/search` accepts the same filters, works on the Free key, and
 * Apollo bills it as "Organization search": 1 credit per page.
 */

export const APOLLO_SOURCE = "apollo"

/** The subset of Apollo's organization object we read. */
export interface ApolloOrganization {
  id: string
  name?: string | null
  website_url?: string | null
  primary_domain?: string | null
  linkedin_url?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  industry?: string | null
  estimated_num_employees?: number | null
  organization_revenue_printed?: string | null
  keywords?: string[] | null
}

export interface ApolloOrgSearchResponse {
  pagination?: { total_entries?: number | null } | null
  organizations?: ApolloOrganization[] | null
}

export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export function normalizeApolloOrganization(org: ApolloOrganization): NormalizedCompany {
  const keywords = (org.keywords ?? []).filter(Boolean).slice(0, 5)
  return {
    providerId: org.id,
    name: org.name?.trim() || org.primary_domain || "Unknown company",
    domain: (org.primary_domain || domainFromUrl(org.website_url))?.toLowerCase() ?? null,
    website: org.website_url ?? null,
    linkedinUrl: org.linkedin_url ?? null,
    country: org.country ?? null,
    state: org.state ?? null,
    city: org.city ?? null,
    industry: org.industry ?? null,
    headcount:
      typeof org.estimated_num_employees === "number" ? org.estimated_num_employees : null,
    revenueRange: org.organization_revenue_printed ?? null,
    // Apollo's search has no description field; its keyword tags are the closest fact.
    description: keywords.length > 0 ? keywords.join(", ") : null,
    source: APOLLO_SOURCE,
  }
}

/**
 * Apollo matches HQ location on free-text strings such as "delhi, india".
 * Parameter meanings (docs.apollo.io, company search): keyword tags filter on
 * "keywords associated with companies"; q_not_organization_keyword_tags[]
 * excludes companies matching any value "as an exact phrase against a
 * company's keywords, name, and short description"; organization_industries[]
 * values "must exactly match an Apollo industry name" and a company "only needs
 * to match one". The docs describe mixed_companies/search; the Free key can
 * only call organizations/search, so Stage 4 also applies the exclusions
 * itself (gtm-company-search.ts matchedExcludedTerm).
 */
export function buildSearchParams(query: CompanyDiscoveryQuery): URLSearchParams {
  const params = new URLSearchParams()
  const country = query.country.trim().toLowerCase()
  const state = query.state?.trim().toLowerCase()
  params.append("organization_locations[]", state ? `${state}, ${country}` : country)
  for (const keyword of query.keywords) {
    params.append("q_organization_keyword_tags[]", keyword.toLowerCase())
  }
  for (const keyword of query.excludeKeywords ?? []) {
    params.append("q_not_organization_keyword_tags[]", keyword.toLowerCase())
  }
  for (const industry of query.industries ?? []) {
    params.append("organization_industries[]", industry.toLowerCase())
  }
  if (query.headcountRange) {
    params.append(
      "organization_num_employees_ranges[]",
      `${query.headcountRange.min},${query.headcountRange.max}`
    )
  }
  params.append("page", "1")
  params.append("per_page", String(query.limit))
  return params
}

/** Narrows an organization search body; a body without an organizations array reads as empty. */
export function toOrgSearchResult(body: unknown, limit: number, creditsUsed: number): CompanyDiscoveryResult {
  const parsed = (typeof body === "object" && body !== null ? body : {}) as ApolloOrgSearchResponse
  const organizations = Array.isArray(parsed.organizations) ? parsed.organizations : []
  return {
    companies: organizations
      .filter((org): org is ApolloOrganization => typeof org?.id === "string")
      .slice(0, limit)
      .map(normalizeApolloOrganization),
    totalAvailable: parsed.pagination?.total_entries ?? null,
    creditsUsed,
  }
}
