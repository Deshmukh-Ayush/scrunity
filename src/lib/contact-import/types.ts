import type { ColumnMapping } from "./columns"
import type { ImportCounts, RejectedRow } from "./review"

/**
 * Shapes the import API and the browser share. Pure and client-safe.
 */

/** Neutral error codes from POST /api/gtm/data-sources/imports. */
export type ImportErrorCode =
  | "not_csv"
  | "too_large"
  | "too_many_rows"
  | "empty_file"
  | "parse_error"
  | "binary_file"
  | "missing_identity"
  | "duplicate_field"
  | "attestation_required"
  | "nothing_to_import"
  | "import_failed"

export interface ImportErrorBody {
  code: ImportErrorCode
  /** For parse_error: the line the unclosed quote starts on. For too_many_rows: the row count. */
  line?: number
  rows?: number
}

/** intent=preview: the file parsed, nothing looked up or stored. */
export interface ImportPreview {
  fileName: string
  headers: string[]
  mapping: ColumnMapping
  /** First 10 rows, as text. */
  sample: string[][]
  totalRows: number
}

/** intent=review (dry run) and intent=import. */
export interface ImportReviewResult {
  fileName: string
  headers: string[]
  counts: ImportCounts
  rejected: RejectedRow[]
  /** Set by intent=import once the list is stored. */
  importId?: string
}

/** One imported list as customers see it (Data sources page, new-run flow). */
export interface PublicImport {
  id: string
  fileName: string
  createdAt: string
  uploadedByName: string | null
  counts: Pick<ImportCounts, "totalRows" | "imported" | "duplicates" | "invalid" | "suppressed" | "personalEmails">
  /** People from this list who were already emailed: kept when the list is deleted. */
  emailedCount: number
}
