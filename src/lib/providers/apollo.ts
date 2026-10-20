import { getApolloMonthlyCreditCap, getProviderMode } from "./config"
import { loadApolloOrgSearchFixture } from "./fixtures"
import { assertVendorCreditsAvailable, recordVendorUsage } from "./vendor-usage"
import {
  VendorCreditsExhaustedError,
  VendorRequestError,
  type CompanyDiscoveryProvider,
  type CompanyDiscoveryQuery,
  type CompanyDiscoveryResult,
  type VendorSpendContext,
} from "./types"
import {
  APOLLO_BASE_URL as BASE_URL,
  ORG_SEARCH_CREDITS_PER_PAGE as CREDITS_PER_PAGE,
  ORG_SEARCH_PATH,
} from "@/lib/vendors/apollo/constants"
import {
  buildSearchParams,
  normalizeApolloOrganization,
  type ApolloOrgSearchResponse,
} from "@/lib/vendors/apollo/org-search"

/**
 * LEGACY platform-key Apollo (APOLLO_API_KEY, PEOPLE_DATA_PROVIDER=legacy for
 * allowlisted internal organizations only). Customers use their own key
 * through lib/providers/apollo-customer.ts.
 */

export {
  buildSearchParams,
  normalizeApolloOrganization,
  type ApolloOrganization,
  type ApolloOrgSearchResponse,
} from "@/lib/vendors/apollo/org-search"

const VENDOR = "apollo"
const REQUEST_TIMEOUT_MS = 20_000
const MAX_RATE_LIMIT_WAIT_MS = 60_000
const DEFAULT_RATE_LIMIT_WAIT_MS = 10_000

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
