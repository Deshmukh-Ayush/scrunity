import { buildRecord, dedupeKey, type ImportRecord, type RowProblem } from "./clean"
import type { ColumnMapping } from "./columns"

/**
 * The review of a whole file: which rows import and why the others don't.
 * Pure: the server passes in what it looked up for this organization
 * (existing contacts, do-not-contact list, platform suppression), so every
 * rule is unit-tested without a database.
 */

export type RejectReason =
  | RowProblem
  | "duplicate_in_file"
  | "already_in_contacts"
  | "do_not_contact"
  | "suppressed"

export interface RejectedRow {
  rowNumber: number
  reason: RejectReason
  /** The row's original cells, returned only to the browser that uploaded the file. */
  cells: string[]
}

export interface ImportCounts {
  totalRows: number
  imported: number
  duplicates: number
  invalid: number
  suppressed: number
  personalEmails: number
  /** Imported rows without a name: they import, but no email can be written to them. */
  missingNames: number
  /** Imported rows with a name and website but no email: they import, but won't be contacted. */
  noEmail: number
}

export interface ImportReview {
  accepted: ImportRecord[]
  rejected: RejectedRow[]
  counts: ImportCounts
}

/** What the server knows about this organization's people, all lowercased. */
export interface OrgContactChecks {
  /** Dedupe keys (see dedupeKey) of contacts already in campaigns or active lists. */
  existingKeys: ReadonlySet<string>
  /** This organization's opt-outs (gtm_do_not_contact). */
  doNotContact: ReadonlySet<string>
  /** Platform-wide suppressed addresses (hard bounces). */
  suppressedEmails: ReadonlySet<string>
  /** Platform-wide suppressed domains (aggregators, no specific address). */
  suppressedDomains: ReadonlySet<string>
}

export const NO_CHECKS: OrgContactChecks = {
  existingKeys: new Set(),
  doNotContact: new Set(),
  suppressedEmails: new Set(),
  suppressedDomains: new Set(),
}

/** Every row cleaned once, before any lookup: the emails and domains the server must check. */
export function buildRecords(rows: string[][], mapping: ColumnMapping, lineNumbers?: number[]) {
  return rows.map((cells, i) => ({ cells, ...buildRecord(cells, mapping, lineNumbers?.[i] ?? i + 2) }))
}

export function reviewRecords(
  built: ReturnType<typeof buildRecords>,
  checks: OrgContactChecks = NO_CHECKS
): ImportReview {
  const accepted: ImportRecord[] = []
  const rejected: RejectedRow[] = []
  const seen = new Set<string>()
  const counts: ImportCounts = {
    totalRows: built.length,
    imported: 0,
    duplicates: 0,
    invalid: 0,
    suppressed: 0,
    personalEmails: 0,
    missingNames: 0,
    noEmail: 0,
  }
  const reject = (row: (typeof built)[number], reason: RejectReason) =>
    rejected.push({ rowNumber: row.record.rowNumber, reason, cells: row.cells })

  for (const row of built) {
    const { record, problem } = row
    if (problem) {
      counts.invalid++
      reject(row, problem)
      continue
    }
    const key = dedupeKey(record)
    if (key && seen.has(key)) {
      counts.duplicates++
      reject(row, "duplicate_in_file")
      continue
    }
    if (key) seen.add(key)
    if (key && checks.existingKeys.has(key)) {
      counts.duplicates++
      reject(row, "already_in_contacts")
      continue
    }
    if (record.email && checks.doNotContact.has(record.email)) {
      counts.suppressed++
      reject(row, "do_not_contact")
      continue
    }
    if (
      (record.email && checks.suppressedEmails.has(record.email)) ||
      (record.domain && checks.suppressedDomains.has(record.domain))
    ) {
      counts.suppressed++
      reject(row, "suppressed")
      continue
    }
    accepted.push(record)
    counts.imported++
    if (record.personalEmail) counts.personalEmails++
    if (!record.fullName && !record.firstName && !record.lastName) counts.missingNames++
    if (!record.email) counts.noEmail++
  }
  return { accepted, rejected, counts }
}

/** Emails and domains to look up for one file, deduplicated. */
export function lookupTargets(built: ReturnType<typeof buildRecords>) {
  const emails = new Set<string>()
  const domains = new Set<string>()
  const keys = new Set<string>()
  for (const { record } of built) {
    if (record.email) emails.add(record.email)
    if (record.domain) domains.add(record.domain)
    const key = dedupeKey(record)
    if (key) keys.add(key)
  }
  return { emails: [...emails], domains: [...domains], keys: [...keys] }
}
