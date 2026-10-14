import { emailMatchesCompanyDomain } from "@/lib/email-verification"
import { getProviderMode } from "./config"
import { loadFullEnrichFixture } from "./fixtures"
import {
  EmailProviderUnavailableError,
  VendorCreditsExhaustedError,
  VendorRequestError,
  type EmailEnrichmentProvider,
  type EmailLookupInput,
  type EmailLookupResult,
} from "./types"

/**
 * FullEnrich email enrichment (API v2, https://docs.fullenrich.com/api/v2).
 *
 * - Start: POST /contact/enrich/bulk with one contact and
 *   enrich_fields ["contact.work_emails"]; returns { enrichment_id }.
 * - Result: GET /contact/enrich/bulk/{id}; status CREATED/IN_PROGRESS until
 *   FINISHED (or CREDITS_INSUFFICIENT, CANCELED, RATE_LIMIT, UNKNOWN).
 * - A work email costs 1 credit, charged only when one is found ("Credits are
 *   only consumed when we actually find a result"); re-enriching the same
 *   person within 3 months is free.
 * - Email status: DELIVERABLE (mailbox verified), HIGH_PROBABILITY and
 *   CATCH_ALL (catch-all domains: the mailbox is not proven), INVALID,
 *   INVALID_DOMAIN. Only DELIVERABLE at the prospect company's own domain is
 *   `verified`; anything else returns no address at all.
 * - 402 means the account is out of credits; 429 gets one retry honouring
 *   Retry-After (FullEnrich asks for a one-minute wait when none is given).
 */

const BASE_URL = "https://app.fullenrich.com/api/v2"
const VENDOR = "fullenrich"
const REQUEST_TIMEOUT_MS = 20_000
const DEFAULT_RETRY_AFTER_MS = 60_000
const MAX_RETRY_AFTER_MS = 90_000

/** Shape of GET /contact/enrich/bulk/{id}, limited to the fields we read. */
export interface FullEnrichResultBody {
  id?: string
  status?: string
  cost?: { credits?: number }
  data?: Array<{
    contact_info?: {
      most_probable_work_email?: { email?: string | null; status?: string | null } | null
    } | null
  }>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function retryAfterMs(response: Response): number {
  const header = response.headers.get("retry-after")
  const seconds = header ? Number(header) : NaN
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS)
  const date = header ? Date.parse(header) : NaN
  if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_AFTER_MS)
  return DEFAULT_RETRY_AFTER_MS
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const apiKey = process.env.FULLENRICH_API_KEY
  if (!apiKey) throw new EmailProviderUnavailableError("FULLENRICH_API_KEY is not set")
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (response.status === 429 && attempt === 0) {
      await sleep(retryAfterMs(response))
      continue
    }
    return response
  }
}

async function failFor(response: Response): Promise<never> {
  if (response.status === 402) throw new VendorCreditsExhaustedError(VENDOR)
  const body = (await response.text().catch(() => "")).slice(0, 200)
  throw new VendorRequestError(VENDOR, response.status, body)
}

const NOT_FOUND_STATUSES = new Set(["INVALID", "INVALID_DOMAIN"])
/** Job statuses that mean "still working, poll again". */
const PENDING = new Set(["CREATED", "IN_PROGRESS", "RATE_LIMIT"])

/** Turns a finished FullEnrich job into our verified / unverified / not_found outcome. */
export function interpretFullEnrichResult(
  body: FullEnrichResultBody,
  input: EmailLookupInput
): EmailLookupResult {
  const creditsUsed = Number(body.cost?.credits ?? 0)
  const found = body.data?.[0]?.contact_info?.most_probable_work_email
  const email = found?.email?.trim() || null
  const vendorStatus = found?.status?.trim().toUpperCase() || null
  const base = { vendor: VENDOR, creditsUsed, vendorStatus }

  if (!email) return { ...base, email: null, status: "not_found" }
  if (!emailMatchesCompanyDomain(email, input.domain)) {
    return { ...base, email: null, status: "not_found", note: "email_at_other_company" }
  }
  if (vendorStatus === "DELIVERABLE") return { ...base, email, status: "verified" }
  if (vendorStatus && NOT_FOUND_STATUSES.has(vendorStatus)) {
    return { ...base, email: null, status: "not_found" }
  }
  // HIGH_PROBABILITY, CATCH_ALL and anything unknown: the mailbox was not proven.
  return { ...base, email: null, status: "unverified" }
}

/** Live FullEnrich, or recorded responses when GTM_PROVIDER_MODE=fixture (zero network). */
export const fullEnrichEmailProvider: EmailEnrichmentProvider = {
  key: VENDOR,
  maxCreditsPerLookup: 1,

  async start(input) {
    if (getProviderMode() === "fixture") {
      return { ref: `fixture:${input.firstName} ${input.lastName}@${input.domain}`.toLowerCase() }
    }
    const contact: Record<string, unknown> = {
      first_name: input.firstName,
      last_name: input.lastName,
      domain: input.domain,
      enrich_fields: ["contact.work_emails"],
    }
    if (input.companyName) contact.company_name = input.companyName
    if (input.linkedinUrl?.includes("linkedin.com")) contact.linkedin_url = input.linkedinUrl
    const response = await request("/contact/enrich/bulk", {
      method: "POST",
      body: JSON.stringify({ name: `scrunity ${input.domain}`, data: [contact] }),
    })
    if (!response.ok) await failFor(response)
    const body = (await response.json()) as { enrichment_id?: string }
    if (!body.enrichment_id) throw new VendorRequestError(VENDOR, response.status, "no enrichment_id")
    return { ref: body.enrichment_id }
  },

  async poll(ref, input) {
    if (ref.startsWith("fixture:")) {
      const recorded = loadFullEnrichFixture(ref.slice("fixture:".length))
      if (PENDING.has(recorded.status ?? "")) return null
      return interpretFullEnrichResult(recorded, input)
    }
    const response = await request(`/contact/enrich/bulk/${encodeURIComponent(ref)}`)
    if (response.status === 400) {
      const text = await response.text()
      if (text.includes("in_progress")) return null
      throw new VendorRequestError(VENDOR, 400, text.slice(0, 200))
    }
    if (!response.ok) await failFor(response)
    const body = (await response.json()) as FullEnrichResultBody
    const status = body.status ?? "UNKNOWN"
    if (PENDING.has(status)) return null
    if (status === "CREDITS_INSUFFICIENT") throw new VendorCreditsExhaustedError(VENDOR)
    if (status !== "FINISHED") throw new VendorRequestError(VENDOR, 503, `enrichment ${status}`)
    return interpretFullEnrichResult(body, input)
  },
}
