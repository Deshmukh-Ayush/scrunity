import { ORG_SEARCH_CREDITS_PER_PAGE, PEOPLE_MATCH_CREDITS_PER_PERSON } from "@/lib/vendors/apollo/constants"
import type { ProviderConnectionRecord, PublicConnection, RunCreditEstimate } from "./types"

/**
 * Customer-facing views of a connection and of a campaign's cost. Pure: the
 * API and the server component both call these, so the browser only ever gets
 * these fields.
 */

/** Allow-list copy of the stored row: anything not named here (the secret) never leaves. */
export function toPublicConnection(row: ProviderConnectionRecord): PublicConnection {
  return {
    provider: row.provider,
    status: row.status,
    authType: row.authType,
    last4: row.status === "revoked" ? null : row.secretLast4,
    connectedAt: row.createdAt.toISOString(),
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
  }
}

/**
 * Worst case for one campaign on the customer's Apollo account: one page of
 * company search, then at most one paid lookup per person tried
 * (GTM_EMAIL_LOOKUPS_PER_CAMPAIGN, counted across restarts). A Stage 4 restart
 * searches again (one more page), which the run cap still bounds. The run cap
 * is the hard ceiling either way.
 */
export function estimateApolloRunCredits({
  emailLookupsPerCampaign,
  runCap,
}: {
  emailLookupsPerCampaign: number
  runCap: number
}): RunCreditEstimate {
  const worstCase = ORG_SEARCH_CREDITS_PER_PAGE + emailLookupsPerCampaign * PEOPLE_MATCH_CREDITS_PER_PERSON
  return { provider: "apollo", maxCreditsPerCampaign: Math.min(worstCase, runCap), runCap }
}
