import type { ColumnMapping, ImportField } from "./columns"

/**
 * Turning one mapped CSV row into a clean contact record. Pure and
 * client-safe; the server runs it on every row before anything is stored.
 */

export interface ImportRecord {
  /** 1-based row number in the file (the header is row 1), shown in the rejected-rows file. */
  rowNumber: number
  email: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  company: string | null
  /** The company's domain: from the website column, else from a work email. */
  domain: string | null
  website: string | null
  linkedinUrl: string | null
  phone: string | null
  city: string | null
  country: string | null
  notes: string | null
  /** The email is at a personal mailbox provider (gmail.com and similar). */
  personalEmail: boolean
}

export type RowProblem = "invalid_email" | "missing_identity"

/** Mailbox providers whose domain says nothing about the person's company. */
export const PERSONAL_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "ymail.com",
  "hotmail.com", "hotmail.co.uk", "hotmail.fr", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.de", "gmx.net", "web.de", "mail.com", "zoho.com", "yandex.com", "yandex.ru",
  "mail.ru", "qq.com", "163.com", "126.com", "rediffmail.com", "fastmail.com", "hey.com", "tutanota.com",
])

const MAX_FIELD = 500

const clean = (value: string | undefined): string | null => {
  const v = (value ?? "").replace(/\s+/g, " ").trim()
  return v ? v.slice(0, MAX_FIELD) : null
}

/** Trimmed and lowercased; "mailto:" and surrounding angle brackets removed. */
export function cleanEmail(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().replace(/^mailto:/i, "").replace(/^<|>$/g, "").trim().toLowerCase()
  return v || null
}

/**
 * A practical syntax check (not RFC 5322): one @, a local part without spaces,
 * a domain with a dot and a 2+ letter top-level label.
 */
export function isValidEmailSyntax(email: string): boolean {
  if (email.length > 254) return false
  const match = /^([^\s@]+)@([^\s@]+)$/.exec(email)
  if (!match) return false
  const [, local, domain] = match
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false
  return isValidDomain(domain)
}

export function isValidDomain(domain: string): boolean {
  if (domain.length > 253 || !domain.includes(".")) return false
  const labels = domain.split(".")
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1])) return false
  return labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))
}

/** "https://www.Example.com/about" -> "example.com"; null when it isn't a domain. */
export function domainFromWebsite(value: string | null | undefined): string | null {
  let v = (value ?? "").trim().toLowerCase()
  if (!v) return null
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "")
  v = v.split(/[/?#\s]/)[0].replace(/:\d+$/, "").replace(/\.$/, "")
  return isValidDomain(v) ? v : null
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1)
}

export function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase())
}

/** The one display name for a record: the full name, else first and last together. */
export function displayName(r: Pick<ImportRecord, "fullName" | "firstName" | "lastName">): string | null {
  return r.fullName ?? ([r.firstName, r.lastName].filter(Boolean).join(" ") || null)
}

/** The in-file and cross-list dedupe key: the email, else name + company domain. */
export function dedupeKey(r: ImportRecord): string | null {
  if (r.email) return `email:${r.email}`
  const name = displayName(r)
  return name && r.domain ? `name:${name.toLowerCase()}@${r.domain}` : null
}

export function buildRecord(
  cells: string[],
  mapping: ColumnMapping,
  rowNumber: number
): { record: ImportRecord; problem: RowProblem | null } {
  const get = (field: ImportField) => {
    const index = mapping.indexOf(field)
    return index >= 0 ? clean(cells[index]) : null
  }
  const rawEmail = get("email")
  const email = cleanEmail(rawEmail)
  const emailOk = email !== null && isValidEmailSyntax(email)
  const website = get("website")
  const fromEmail = emailOk && email && !isPersonalEmailDomain(emailDomain(email)) ? emailDomain(email) : null
  const record: ImportRecord = {
    rowNumber,
    email: emailOk ? email : null,
    firstName: get("firstName"),
    lastName: get("lastName"),
    fullName: get("fullName"),
    title: get("title"),
    company: get("company"),
    domain: domainFromWebsite(website) ?? fromEmail,
    website,
    linkedinUrl: get("linkedinUrl"),
    phone: get("phone"),
    city: get("city"),
    country: get("country"),
    notes: get("notes"),
    personalEmail: emailOk && email !== null && isPersonalEmailDomain(emailDomain(email)),
  }
  if (email && !emailOk) return { record, problem: "invalid_email" }
  if (!record.email && !(displayName(record) && record.domain)) return { record, problem: "missing_identity" }
  return { record, problem: null }
}
