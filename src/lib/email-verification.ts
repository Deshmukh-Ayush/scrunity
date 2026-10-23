/**
 * The one definition of a "verified" email address.
 *
 * Verified means an email-enrichment vendor checked the mailbox itself and
 * reported it deliverable. Nothing else counts: a pattern guess, an address
 * whose domain merely has MX records, an address scraped from a website, a
 * catch-all domain ("accepts everything", so the mailbox was never proven), an
 * unknown result, and the legacy enrich.so `enrich_verified` status (its docs
 * do not state a mailbox-level check) are all unverified.
 *
 * Only `mailbox_verified` contacts may be qualified (Stage 5.5), approved or
 * sent (lib/send-eligibility.ts). Pure module: safe in client components.
 */

/** Stored on gtm_contact.verificationStatus when a vendor verified the mailbox. */
export const MAILBOX_VERIFIED = "mailbox_verified"

/**
 * Statuses that pass the email gate. "verified" is the customer-facing name of
 * `mailbox_verified` (lib/data/public-fields.ts), so the same gate also works in
 * client components that only ever see public rows. No stored row carries the
 * literal "verified": it is not a value of the verificationStatus column.
 */
const VERIFIED_STATUSES: ReadonlySet<string> = new Set([MAILBOX_VERIFIED, "verified"])

export function isVerifiedStatus(status: string | null | undefined): boolean {
  return Boolean(status && VERIFIED_STATUSES.has(status.trim()))
}

/** A contact is verified only with an address and a verified status. */
export function isVerifiedEmail(contact: {
  email?: string | null
  verificationStatus?: string | null
}): boolean {
  return Boolean(contact.email?.trim()) && isVerifiedStatus(contact.verificationStatus)
}

/**
 * An address from the customer's own imported list (lib/contact-import/).
 * Not verified, and never shown as verified: the customer vouched for it when
 * they confirmed the import. It may be qualified, approved and sent, with the
 * bounce-rate pause protecting their mailbox (lib/contact-import/bounce-guard.ts).
 * Only the import writes this status.
 */
export const USER_PROVIDED = "user_provided"

export function isUserProvidedStatus(status: string | null | undefined): boolean {
  return status?.trim() === USER_PROVIDED
}

/** May this address be emailed: vendor-verified, or from the customer's own list. */
export function isSendableEmail(contact: {
  email?: string | null
  verificationStatus?: string | null
}): boolean {
  return isVerifiedEmail(contact) || (Boolean(contact.email?.trim()) && isUserProvidedStatus(contact.verificationStatus))
}

/** What one vendor lookup established for one person. */
export type EmailLookupStatus = "verified" | "unverified" | "not_found"

/**
 * The address must belong to the company we are prospecting. A vendor that
 * resolves a person through LinkedIn may return their mailbox at a different
 * (current or past) employer; that is not this company's decision maker.
 */
export function emailMatchesCompanyDomain(email: string, companyDomain: string): boolean {
  const at = email.lastIndexOf("@")
  if (at < 0) return false
  const emailDomain = email.slice(at + 1).trim().toLowerCase()
  const company = companyDomain.trim().toLowerCase().replace(/^www\./, "")
  return emailDomain === company || emailDomain.endsWith(`.${company}`)
}
