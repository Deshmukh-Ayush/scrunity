import { getApolloMonthlyCreditCap, getProviderMode } from "./config"
import { loadApolloOrgSearchFixture } from "./fixtures"
import { assertVendorCreditsAvailable, recordVendorUsage } from "./vendor-usage"
import {
  VendorCreditsExhaustedError,
  VendorRequestError,
  type CompanyDiscoveryProvider,
  type CompanyDiscoveryQuery,
  type CompanyDiscoveryResult,
  type NormalizedCompany,
  type VendorSpendContext,
} from "./types"

const VENDOR = "apollo"
const BASE_URL = "https://api.apollo.io"
/**
 * Apollo documents `mixed_companies/search` as its company search, but that
 * endpoint returns 403 on the Free plan ("not included in your Free plan").
 * `organizations/search` accepts the same filters, works on the Free key, and
 * Apollo bills it as "Organization search": 1 credit per page.
 */
const ORG_SEARCH_PATH = "/api/v1/organizations/search"
const CREDITS_PER_PAGE = 1
const REQUEST_TIMEOUT_MS = 20_000
const MAX_RATE_LIMIT_WAIT_MS = 60_000
const DEFAULT_RATE_LIMIT_WAIT_MS = 10_000

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

function domainFromUrl(url: string | null | undefined): string | null {
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
    source: VENDOR,
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

function toResult(body: ApolloOrgSearchResponse, limit: number, creditsUsed: number): CompanyDiscoveryResult {
  return {
    companies: (body.organizations ?? []).slice(0, limit).map(normalizeApolloOrganization),
    totalAvailable: body.pagination?.total_entries ?? null,
    creditsUsed,
  }
}

function rateLimitWaitMs(res: Response): number {
  const retryAfter = Number(res.headers.get("retry-after"))
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RATE_LIMIT_WAIT_MS)
  }
  return DEFAULT_RATE_LIMIT_WAIT_MS
}

async function readErrorDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => "")
  try {
    const parsed = JSON.parse(text) as { error?: string }
    if (parsed.error) return parsed.error.slice(0, 200)
  } catch {
    // not JSON
  }
  return text.slice(0, 200) || res.statusText
}

async function postOrgSearch(params: URLSearchParams, apiKey: string): Promise<Response> {
  return fetch(`${BASE_URL}${ORG_SEARCH_PATH}?${params}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

export const apolloCompanyProvider: CompanyDiscoveryProvider = {
  key: VENDOR,

  async searchCompanies(
    query: CompanyDiscoveryQuery,
    context: VendorSpendContext
  ): Promise<CompanyDiscoveryResult> {
    if (getProviderMode() === "fixture") {
      return toResult(loadApolloOrgSearchFixture(query.country), query.limit, 0)
    }

    const apiKey = process.env.APOLLO_API_KEY
    if (!apiKey) {
      throw new VendorRequestError(VENDOR, 401, "APOLLO_API_KEY is not configured")
    }

    // Cap check happens before any network call.
    await assertVendorCreditsAvailable(VENDOR, CREDITS_PER_PAGE, getApolloMonthlyCreditCap())

    const params = buildSearchParams(query)
    let res = await postOrgSearch(params, apiKey)

    if (res.status === 429) {
      // Exactly one backoff retry, honoring Retry-After when Apollo sends it.
      await new Promise((r) => setTimeout(r, rateLimitWaitMs(res)))
      res = await postOrgSearch(params, apiKey)
    }
    if (res.status === 402) throw new VendorCreditsExhaustedError(VENDOR)
    if (!res.ok) throw new VendorRequestError(VENDOR, res.status, await readErrorDetail(res))

    const body = (await res.json()) as ApolloOrgSearchResponse
    await recordVendorUsage({
      vendor: VENDOR,
      endpoint: ORG_SEARCH_PATH,
      creditsUsed: CREDITS_PER_PAGE,
      context,
    })
    return toResult(body, query.limit, CREDITS_PER_PAGE)
  },
}
