import { and, eq, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmContact, gtmDoNotContact, gtmEmailDraft, gtmProspectCompany } from "@/db/schema"
import { isValidPersonName } from "@/lib/gtm-contact-matcher"
import { checkLeadQualificationGates } from "@/lib/gtm-qualification-gates"
import { checkSuppression } from "@/lib/gtm-suppression"

/**
 * One place that decides whether a contact may be emailed. Called when a client
 * approves a draft and again by the sender right before an email leaves, so a
 * skipped earlier check or a direct API call cannot get around it.
 *
 * Blocks: no email, synthetic fixture people, lookup incomplete, invalid name,
 * failed qualification gates (which include "email verified at mailbox level",
 * lib/email-verification.ts), this organization's do-not-contact list
 * (opt-outs), and platform-wide suppression (hard bounces, aggregator domains).
 */
export type SendBlockCode =
  | "no_email"
  | "synthetic_contact"
  | "lookup_incomplete"
  | "invalid_name"
  | "not_qualified"
  | "opted_out"
  | "hard_bounce"
  | "suppressed"

export interface SendBlock {
  code: SendBlockCode
  message: string
}

export interface SendCandidate {
  email: string | null
  name: string
  verificationStatus?: string | null
  emailSource?: string | null
  linkedinUrl?: string | null
  lookupStatus?: string | null
  /** People-provider key; "fixture" people are invented and must never be emailed. */
  source?: string | null
  domain?: string | null
}

const normalize = (email: string) => email.trim().toLowerCase()

export async function isOptedOut(organizationId: string, email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: gtmDoNotContact.id })
    .from(gtmDoNotContact)
    .where(and(eq(gtmDoNotContact.organizationId, organizationId), eq(gtmDoNotContact.email, normalize(email))))
    .limit(1)
  return Boolean(row)
}

export async function getSendBlock(organizationId: string, c: SendCandidate): Promise<SendBlock | null> {
  if (!c.email?.trim()) return { code: "no_email", message: "This contact has no email address." }
  if (c.source === "fixture") {
    return { code: "synthetic_contact", message: "This is a test contact and cannot be emailed." }
  }
  if (c.lookupStatus === "lookup_incomplete") {
    return { code: "lookup_incomplete", message: "This contact's lookup is not finished yet." }
  }
  if (!isValidPersonName(c.name)) {
    return { code: "invalid_name", message: "This contact's name is not a real person's name." }
  }
  const gates = checkLeadQualificationGates({
    email: c.email,
    verificationStatus: c.verificationStatus,
    emailSource: c.emailSource,
    linkedinUrl: c.linkedinUrl,
  })
  if (!gates.qualified) {
    return { code: "not_qualified", message: gates.reason || "This contact did not pass qualification." }
  }
  if (await isOptedOut(organizationId, c.email)) {
    return { code: "opted_out", message: "This person asked not to be contacted." }
  }
  const suppression = await checkSuppression({ email: c.email, domain: c.domain })
  if (suppression) {
    return suppression.reason === "hard_bounce"
      ? { code: "hard_bounce", message: "Email to this address bounced; it cannot be sent to." }
      : { code: "suppressed", message: "This address or domain cannot be contacted." }
  }
  return null
}

/**
 * Draft status as a state machine for client calls: only a pending draft
 * (`draft`, or `approved` again) can be approved. `rejected` (disqualified),
 * `failed` (send error or bounce), `sent` and paused drafts stay where they are;
 * only the pipeline re-qualifies them.
 */
export function clientCanApprove(status: string): boolean {
  return status === "draft" || status === "approved"
}

/** The draft with the contact fields getSendBlock needs. */
export async function loadDraftForSending(draftId: string) {
  const [row] = await db
    .select({
      draftId: gtmEmailDraft.id,
      status: gtmEmailDraft.status,
      email: gtmContact.email,
      name: gtmContact.name,
      verificationStatus: gtmContact.verificationStatus,
      emailSource: gtmContact.emailSource,
      linkedinUrl: gtmContact.linkedinUrl,
      lookupStatus: gtmContact.lookupStatus,
      source: gtmContact.source,
      domain: gtmProspectCompany.domain,
    })
    .from(gtmEmailDraft)
    .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
    .innerJoin(gtmProspectCompany, eq(gtmContact.prospectCompanyId, gtmProspectCompany.id))
    .where(eq(gtmEmailDraft.id, draftId))
  return row ?? null
}

/** Why a client may not approve this draft, or null when it may. */
export async function getApprovalBlock(organizationId: string, draftId: string): Promise<string | null> {
  const draft = await loadDraftForSending(draftId)
  if (!draft) return "Draft not found."
  if (!clientCanApprove(draft.status)) {
    return `This draft is ${draft.status} and cannot be approved.`
  }
  const block = await getSendBlock(organizationId, draft)
  return block ? block.message : null
}

/**
 * Records an opt-out for this organization (idempotent per email) and rejects
 * any still-pending drafts to the same address in this organization, so no
 * later step of any campaign sends to them.
 */
export async function recordOptOut({
  organizationId,
  email,
  contactId,
  sourceDraftId,
}: {
  organizationId: string
  email: string
  contactId?: string | null
  sourceDraftId?: string | null
}) {
  const normalized = normalize(email)
  const inserted = await db
    .insert(gtmDoNotContact)
    .values({ organizationId, email: normalized, reason: "opt_out", contactId: contactId ?? null, sourceDraftId: sourceDraftId ?? null })
    .onConflictDoNothing({ target: [gtmDoNotContact.organizationId, gtmDoNotContact.email] })
    .returning({ id: gtmDoNotContact.id })

  await db.execute(sql`
    UPDATE gtm_email_draft d
    SET status = 'rejected', error_message = 'Opted out: this person asked not to be contacted.'
    FROM gtm_contact c, gtm_prospect_company pc, gtm_outreach_campaign oc, gtm_research_run r
    WHERE d.contact_id = c.id AND c.prospect_company_id = pc.id AND pc.outreach_campaign_id = oc.id
      AND oc.research_run_id = r.id AND r.organization_id = ${organizationId}
      AND lower(c.email) = ${normalized} AND d.status IN ('draft', 'approved')
  `)
  return { created: inserted.length > 0 }
}
