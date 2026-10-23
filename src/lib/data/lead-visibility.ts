import "server-only"

import { sql } from "drizzle-orm"
import { gtmContact } from "@/db/schema"
import { isSendableEmail } from "@/lib/email-verification"

/**
 * Which leads the default views show. A lead is usable when its email was
 * verified at mailbox level or came from the customer's own imported list
 * (lib/email-verification.ts), it was not rejected
 * or disqualified, and mail to it never bounced. Everything else is "skipped":
 * hidden by default, listed in a closed, neutral Skipped section.
 */

/** SQL condition on gtm_contact for usable leads (for list queries). */
export const usableLeadSql = sql`(
  ${gtmContact.verificationStatus} IN ('mailbox_verified', 'user_provided')
  AND ${gtmContact.email} IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM gtm_email_draft d WHERE d.contact_id = ${gtmContact.id} AND d.status = 'rejected')
  AND NOT EXISTS (
    SELECT 1 FROM gtm_email_draft d JOIN gtm_email_event e ON e.email_draft_id = d.id
    WHERE d.contact_id = ${gtmContact.id} AND e.type = 'bounced'
  )
)`

/**
 * Lead counts for the quiet summary line ("Reviewed 23 people · 12 verified ·
 * 4 from your list"). Verified and from-your-list are counted apart: an
 * imported address is usable but never verified.
 */
export const leadSummarySql = {
  reviewed: sql<number>`count(*)::int`,
  verified: sql<number>`count(*) FILTER (WHERE ${usableLeadSql} AND ${gtmContact.verificationStatus} = 'mailbox_verified')::int`,
  fromList: sql<number>`count(*) FILTER (WHERE ${usableLeadSql} AND ${gtmContact.verificationStatus} = 'user_provided')::int`,
}

/** A leadSummarySql row as the client's LeadSummary. */
export function toLeadSummary(row: { reviewed?: unknown; verified?: unknown; fromList?: unknown } | undefined) {
  return { reviewed: Number(row?.reviewed ?? 0), verified: Number(row?.verified ?? 0), fromList: Number(row?.fromList ?? 0) }
}

/** The same counts from loaded contacts (campaign page): `usable` are those skippedReason let through. */
export function summarizeLeads(all: number, usable: Array<{ verificationStatus: string | null }>) {
  return {
    reviewed: all,
    verified: usable.filter((c) => c.verificationStatus === "mailbox_verified").length,
    fromList: usable.filter((c) => c.verificationStatus === "user_provided").length,
  }
}

interface ContactLike {
  id: string
  email: string | null
  verificationStatus: string | null
  skipReason?: string | null
}

interface DraftLike {
  contactId: string
  status: string
  hasBounced?: boolean
}

/** Neutral reason a contact is not shown by default, or null when it is usable. */
export function skippedReason(contact: ContactLike, drafts: DraftLike[]): string | null {
  const own = drafts.filter((d) => d.contactId === contact.id)
  if (!isSendableEmail(contact)) return contact.skipReason || "Email not verified"
  if (own.some((d) => d.hasBounced)) return "Email bounced"
  if (own.some((d) => d.status === "rejected")) return "Not selected for outreach"
  return null
}
