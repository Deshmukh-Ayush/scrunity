import { CsvParseError, parseCsv, type ParsedCsv } from "./csv-parse"
import { autoMapping, isColumnMapping, mappingProblem } from "./columns"
import { CSV_IMPORT_MAX_BYTES, looksLikeCsv } from "./limits"
import { buildRecords, lookupTargets, reviewRecords, type ImportReview, type OrgContactChecks } from "./review"
import type { ImportErrorBody, ImportPreview, ImportReviewResult } from "./types"

/**
 * The three steps of POST /api/gtm/data-sources/imports, without the request
 * or the database: preview (parse only), review (dry run with this
 * organization's checks) and import (review, attestation required, then the
 * caller stores `review.accepted`). The browser re-sends the file for each
 * step, so nothing about an unconfirmed file is ever stored. Pure.
 */

export type StepResult<T> = { ok: true; value: T } | { ok: false; error: ImportErrorBody }

const fail = <T>(error: ImportErrorBody): StepResult<T> => ({ ok: false, error })

export const PREVIEW_ROWS = 10

/** Reads and parses an uploaded file within the limits. */
export async function readCsvFile(
  file: { name: string; type: string; size: number; text: () => Promise<string> },
  maxRows: number
): Promise<StepResult<ParsedCsv>> {
  if (!looksLikeCsv(file.name, file.type)) return fail({ code: "not_csv" })
  if (file.size > CSV_IMPORT_MAX_BYTES) return fail({ code: "too_large" })
  let parsed: ParsedCsv
  try {
    parsed = parseCsv(await file.text())
  } catch (err) {
    if (err instanceof CsvParseError) {
      if (err.code === "binary_content") return fail({ code: "binary_file" })
      if (err.code === "no_header") return fail({ code: "empty_file" })
      return fail({ code: "parse_error", line: err.line })
    }
    return fail({ code: "parse_error", line: 1 })
  }
  if (parsed.rows.length === 0) return fail({ code: "empty_file" })
  if (parsed.rows.length > maxRows) return fail({ code: "too_many_rows", rows: parsed.rows.length })
  return { ok: true, value: parsed }
}

export function previewOf(fileName: string, parsed: ParsedCsv): ImportPreview {
  return {
    fileName,
    headers: parsed.headers,
    mapping: autoMapping(parsed.headers),
    sample: parsed.rows.slice(0, PREVIEW_ROWS),
    totalRows: parsed.rows.length,
  }
}

/** Checks the mapping, looks the file's people up, and reviews every row. */
export async function reviewFile({
  parsed,
  mapping,
  loadChecks,
}: {
  parsed: ParsedCsv
  mapping: unknown
  loadChecks: (targets: { emails: string[]; domains: string[] }) => Promise<OrgContactChecks>
}): Promise<StepResult<ImportReview>> {
  if (!isColumnMapping(mapping, parsed.headers.length)) return fail({ code: "missing_identity" })
  const problem = mappingProblem(mapping)
  if (problem) return fail({ code: problem })
  const built = buildRecords(parsed.rows, mapping, parsed.lineNumbers)
  const checks = await loadChecks(lookupTargets(built))
  return { ok: true, value: reviewRecords(built, checks) }
}

/** The import step's own rules on top of the review. */
export function importBlock(review: ImportReview, attested: boolean): ImportErrorBody | null {
  if (!attested) return { code: "attestation_required" }
  if (review.accepted.length === 0) return { code: "nothing_to_import" }
  return null
}

export function reviewResult(fileName: string, parsed: ParsedCsv, review: ImportReview, importId?: string): ImportReviewResult {
  return { fileName, headers: parsed.headers, counts: review.counts, rejected: review.rejected, ...(importId ? { importId } : {}) }
}

/** Display name of an uploaded file: no path, at most 200 characters. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "list.csv"
  return base.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "list.csv"
}
