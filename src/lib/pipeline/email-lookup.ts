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
 * One email lookup for one stored contact, start to finish:
 *  1. reserve the most it can cost in the vendor ledger (monthly cap, atomic);
 *  2. start the vendor job (the only call that can charge) and save its ref on
 *     the contact BEFORE polling, so a restart polls the same job and never
 *     pays twice;
 *  3. poll with a hard maximum wait, heartbeating the campaign meanwhile;
 *  4. settle the reservation with the real charge and store the outcome.
 * A rate limit or timeout leaves the contact `lookup_incomplete` (ref kept) to
 * be re-polled later. Conditions that make further lookups pointless throw
 * LeadSearchStop. Never guesses an address.
 */

/** The verified-lead search must stop: no more lookups can or should run. */
export class LeadSearchStop extends Error {
  constructor(public readonly stopReason: string, detail: string) {
    super(detail)
    this.name = "LeadSearchStop"
  }
}

export type LookupOutcome =
  | { kind: "done"; result: EmailLookupResult }
  | { kind: "incomplete"; reason: "rate_limited" | "timeout" | "vendor_error" }

/** Stored on gtm_contact.enrichMetadata (never sent to customers). */
interface LookupMetadata {
  provider: string
  reservationId?: string
  vendorStatus?: string | null
  creditsUsed?: number
  note?: string | null
}

export interface LookupTiming {
  maxWaitMs: number
  /** Wait before the first poll, then between polls. */
  firstPollMs: number
  pollIntervalMs: number
  /** Absolute wall-clock limit of the whole search; polling never runs past it. */
  deadline: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function markIncomplete(contactId: string, reason: string) {
  await db
    .update(gtmContact)
    .set({ lookupStatus: "lookup_incomplete", skipReason: INCOMPLETE_REASON[reason] ?? "Lookup not finished yet" })
    .where(eq(gtmContact.id, contactId))
}

/**
 * Looks up (or, with `existing`, resumes polling) one contact's email.
 * `existing` is the stored ref and metadata of a job started earlier.
 */
export async function lookupContactEmail({
  contactId,
  input,
  provider,
  spend,
  timing,
  heartbeat,
  existing,
}: {
  contactId: string
  input: EmailLookupInput
  provider: EmailEnrichmentProvider
  spend: VendorSpendContext
  timing: LookupTiming
  heartbeat: () => Promise<void>
  existing?: { ref: string; metadata: LookupMetadata | null }
}): Promise<LookupOutcome> {
  let ref = existing?.ref
  let metadata: LookupMetadata = existing?.metadata ?? { provider: provider.key }

  if (!ref) {
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
    try {
      ref = (await provider.start(input)).ref
    } catch (err) {
      // Nothing was submitted, so nothing can have been charged.
      await settleVendorCredits(reservationId, 0, "email_lookup (not submitted)")
      const stop = toStop(err)
      if (stop) throw stop
      const reason = err instanceof VendorRequestError && err.status === 429 ? "rate_limited" : "vendor_error"
      console.warn(`[Lead search] email lookup for contact ${contactId} not started: ${(err as Error).message}`)
      await markIncomplete(contactId, reason)
      return { kind: "incomplete", reason }
    }
    metadata = { provider: provider.key, reservationId }
    await db
      .update(gtmContact)
      .set({ emailLookupRef: ref, enrichMetadata: metadata })
      .where(eq(gtmContact.id, contactId))
  }

  const giveUpAt = Math.min(Date.now() + timing.maxWaitMs, timing.deadline)
  let wait = existing ? 0 : timing.firstPollMs
  for (;;) {
    if (wait > 0) await sleep(Math.min(wait, Math.max(0, giveUpAt - Date.now())))
    await heartbeat()
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
    if (Date.now() >= giveUpAt) {
      await markIncomplete(contactId, "timeout")
      return { kind: "incomplete", reason: "timeout" }
    }
    wait = timing.pollIntervalMs
  }
}
