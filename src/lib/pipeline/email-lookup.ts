import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmContact } from "@/db/schema"
import { MAILBOX_VERIFIED } from "@/lib/email-verification"
import { getFullEnrichMonthlyCreditCap, getProviderMode } from "@/lib/providers/config"
import { reserveVendorCredits, settleVendorCredits } from "@/lib/providers/vendor-usage"
import {
  EmailProviderUnavailableError,
  VendorCreditCapError,
  VendorCreditsExhaustedError,
  VendorRequestError,
  type EmailEnrichmentProvider,
  type EmailLookupInput,
  type EmailLookupResult,
  type VendorSpendContext,
} from "@/lib/providers/types"

/**
 * One email lookup for one stored contact, in two calls so the wait between
 * them can be an Inngest step sleep instead of a long-running function:
 *  1. startEmailLookup: reserve the most it can cost in the vendor ledger
 *     (monthly cap, atomic), start the vendor job (the only call that can
 *     charge) and save its ref on the contact, so a restart polls the same job
 *     and never pays twice;
 *  2. pollEmailLookup (repeated): poll once; on a result, settle the
 *     reservation with the real charge and store the outcome. A lookup still
 *     pending after the maximum wait is left `lookup_incomplete` (ref kept) for
 *     a later attempt.
 * Conditions that make further lookups pointless throw LeadSearchStop. Never
 * guesses an address.
 */

/** The verified-lead search must stop: no more lookups can or should run. */
export class LeadSearchStop extends Error {
  constructor(public readonly stopReason: string, detail: string) {
    super(detail)
    this.name = "LeadSearchStop"
  }
}

/** Stored on gtm_contact.enrichMetadata (never sent to customers). */
export interface LookupMetadata {
  provider: string
  reservationId?: string
  vendorStatus?: string | null
  creditsUsed?: number
  note?: string | null
  /** The search attempt that last polled this job, and when it began polling. */
  pollAttemptId?: string | null
  pollStartedAt?: string | null
  /** This attempt waited the maximum time without a result and stopped polling. */
  gaveUpAttemptId?: string | null
  /** This attempt could not submit the job (rate limit, vendor error). */
  startFailedAttemptId?: string | null
}

export type LookupOutcome =
  | { kind: "done"; result: EmailLookupResult }
  | { kind: "pending" }
  | { kind: "incomplete"; reason: "rate_limited" | "timeout" | "vendor_error" }

/**
 * Ledger vendor name. Fixture lookups are recorded under "<key>_fixture" so
 * tests exercise the same cap logic without eating into the real vendor's
 * monthly cap.
 */
export function ledgerVendor(provider: Pick<EmailEnrichmentProvider, "key">): string {
  return getProviderMode() === "fixture" ? `${provider.key}_fixture` : provider.key
}

function toStop(err: unknown): LeadSearchStop | null {
  if (err instanceof LeadSearchStop) return err
  if (err instanceof VendorCreditCapError) return new LeadSearchStop("email_credit_cap_reached", err.message)
  if (err instanceof VendorCreditsExhaustedError) return new LeadSearchStop("email_credits_exhausted", err.message)
  if (err instanceof EmailProviderUnavailableError) return new LeadSearchStop("email_provider_unavailable", err.message)
  if (err instanceof VendorRequestError && (err.status === 401 || err.status === 403)) {
    return new LeadSearchStop("email_provider_unavailable", err.message)
  }
  return null
}

async function saveOutcome(contactId: string, result: EmailLookupResult, metadata: LookupMetadata) {
  const verified = result.status === "verified" && Boolean(result.email)
  await db
    .update(gtmContact)
    .set({
      email: verified ? result.email : null,
      emailSource: verified ? "vendor_lookup" : "none",
      verificationStatus: verified ? MAILBOX_VERIFIED : "unverified",
      emailStatus: result.status,
      emailLookedUpAt: new Date(),
      lookupStatus: "complete",
      skipReason: verified
        ? null
        : result.note === "email_at_other_company"
          ? "Email found only at a different company"
          : result.status === "unverified"
            ? "Email could not be verified"
            : "No email found",
      enrichMetadata: {
        ...metadata,
        vendorStatus: result.vendorStatus,
        creditsUsed: result.creditsUsed,
        note: result.note ?? null,
      },
    })
    .where(eq(gtmContact.id, contactId))
}

const INCOMPLETE_REASON: Record<string, string> = {
  rate_limited: "Lookup not finished yet",
  vendor_error: "Lookup not finished yet",
  timeout: "Lookup not finished yet",
  budget: "Not looked up (search budget reached)",
}

async function markIncomplete(contactId: string, reason: string, metadata?: LookupMetadata) {
  await db
    .update(gtmContact)
    .set({
      lookupStatus: "lookup_incomplete",
      skipReason: INCOMPLETE_REASON[reason] ?? "Lookup not finished yet",
      ...(metadata ? { enrichMetadata: metadata } : {}),
    })
    .where(eq(gtmContact.id, contactId))
}

/**
 * Starts the vendor job for a stored contact. Returns "pending" once the job
 * ref is saved, or "incomplete" when the job could not be submitted (nothing
 * charged). Throws LeadSearchStop when the cap is reached or the vendor is
 * unusable; the contact is then left open for a later attempt.
 */
export async function startEmailLookup({
  contactId,
  input,
  provider,
  spend,
  attemptId,
  previous,
}: {
  contactId: string
  input: EmailLookupInput
  provider: EmailEnrichmentProvider
  spend: VendorSpendContext
  attemptId: string | null
  previous?: LookupMetadata | null
}): Promise<LookupOutcome> {
  let reservationId: string
  try {
    reservationId = await reserveVendorCredits({
      vendor: ledgerVendor(provider),
      endpoint: "email_lookup (reserved)",
      credits: provider.maxCreditsPerLookup,
      cap: getFullEnrichMonthlyCreditCap(),
      context: spend,
    })
  } catch (err) {
    // Cap reached before anything was submitted: leave the person open so a
    // later attempt (next month, or a raised cap) looks them up.
    await markIncomplete(contactId, "budget")
    throw toStop(err) ?? err
  }
  let ref: string
  try {
    ref = (await provider.start(input)).ref
  } catch (err) {
    // Nothing was submitted, so nothing can have been charged.
    await settleVendorCredits(reservationId, 0, "email_lookup (not submitted)")
    const stop = toStop(err)
    if (stop) throw stop
    const reason = err instanceof VendorRequestError && err.status === 429 ? "rate_limited" : "vendor_error"
    console.warn(`[Lead search] email lookup for contact ${contactId} not started: ${(err as Error).message}`)
    await markIncomplete(contactId, reason, { ...(previous ?? { provider: provider.key }), startFailedAttemptId: attemptId })
    return { kind: "incomplete", reason }
  }
  const metadata: LookupMetadata = {
    provider: provider.key,
    reservationId,
    pollAttemptId: attemptId,
    pollStartedAt: new Date().toISOString(),
  }
  await db
    .update(gtmContact)
    .set({ emailLookupRef: ref, enrichMetadata: metadata, lookupStatus: "complete", skipReason: null })
    .where(eq(gtmContact.id, contactId))
  return { kind: "pending" }
}

/**
 * Polls a started job once. The first poll by a new attempt restarts that
 * attempt's wait clock; past `maxWaitMs` without a result the contact is left
 * `lookup_incomplete` (ref kept, so a later attempt polls the paid job again).
 */
export async function pollEmailLookup({
  contactId,
  ref,
  metadata: stored,
  input,
  provider,
  attemptId,
  maxWaitMs,
}: {
  contactId: string
  ref: string
  metadata: LookupMetadata | null
  input: EmailLookupInput
  provider: EmailEnrichmentProvider
  attemptId: string | null
  maxWaitMs: number
}): Promise<LookupOutcome> {
  let metadata: LookupMetadata = stored ?? { provider: provider.key }
  if (attemptId && metadata.gaveUpAttemptId === attemptId) return { kind: "incomplete", reason: "timeout" }
  if (!metadata.pollStartedAt || metadata.pollAttemptId !== attemptId) {
    metadata = { ...metadata, pollAttemptId: attemptId, pollStartedAt: new Date().toISOString() }
    await db.update(gtmContact).set({ enrichMetadata: metadata }).where(eq(gtmContact.id, contactId))
  }

  let result: EmailLookupResult | null = null
  try {
    result = await provider.poll(ref, input)
  } catch (err) {
    const stop = toStop(err)
    if (stop) throw stop
    // Rate limit or a vendor hiccup while reading: the job is still paid for, keep polling.
    console.warn(`[Lead search] poll for contact ${contactId} failed: ${(err as Error).message}`)
  }
  if (result) {
    if (metadata.reservationId) {
      await settleVendorCredits(metadata.reservationId, result.creditsUsed, "email_lookup")
    }
    await saveOutcome(contactId, result, metadata)
    return { kind: "done", result }
  }
  if (Date.now() - Date.parse(metadata.pollStartedAt!) >= maxWaitMs) {
    await markIncomplete(contactId, "timeout", { ...metadata, gaveUpAttemptId: attemptId })
    return { kind: "incomplete", reason: "timeout" }
  }
  return { kind: "pending" }
}
