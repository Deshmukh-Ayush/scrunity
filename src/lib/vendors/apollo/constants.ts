/**
 * Apollo endpoints and credit costs: the one place they are written down.
 * Everything here describes the customer's own Apollo account (bring your own
 * key): Scrunity never pays Apollo, and these numbers only drive the estimate
 * shown before a run and the per-run cap that protects the customer's credits.
 *
 * Sources (docs.apollo.io, read 2026-10-21):
 * - Organization search (POST /api/v1/organizations/search): the existing
 *   client (lib/providers/apollo.ts) assumes 1 credit per page; kept.
 * - People API search (POST /api/v1/mixed_people/api_search): 0 credits.
 *   Returns no email, no LinkedIn URL and a masked last name.
 * - Bulk people enrichment (POST /api/v1/people/bulk_match): up to 10 people
 *   per request; "1 credit for demographics or email", +8 only for a mobile
 *   phone, which is never requested here; 0 when nothing is returned. So a
 *   lookup costs at most 1 credit per person, found email or not.
 */

export const APOLLO_BASE_URL = "https://api.apollo.io"

export const ORG_SEARCH_PATH = "/api/v1/organizations/search"
export const PEOPLE_SEARCH_PATH = "/api/v1/mixed_people/api_search"
export const BULK_MATCH_PATH = "/api/v1/people/bulk_match"

export const ORG_SEARCH_CREDITS_PER_PAGE = 1
export const PEOPLE_SEARCH_CREDITS = 0
/** Worst case per person sent to bulk_match (no phone reveal requested). */
export const PEOPLE_MATCH_CREDITS_PER_PERSON = 1
/** Apollo's documented maximum for one bulk_match request. */
export const BULK_MATCH_MAX_PEOPLE = 10

/**
 * Apollo's own word for an email it confirmed. The API reference gives
 * "verified" as the email_status example without listing every value, so only
 * this exact status counts as verified; anything else (unverified, guessed,
 * likely to engage, missing) is not.
 */
export const APOLLO_VERIFIED_STATUS = "verified"

/** Seniority values Apollo documents for person_seniorities[]. */
export const APOLLO_SENIORITIES = [
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
] as const
