/**
 * Upload limits for list imports. Pure; read on the server (and passed to the
 * client as props) so both enforce the same numbers.
 */

export const CSV_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const CSV_IMPORT_MAX_MB = 5
const DEFAULT_MAX_ROWS = 2000

/** GTM_CSV_IMPORT_MAX_ROWS, default 2,000, never below 1 or above 10,000. */
export function getCsvImportMaxRows(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.GTM_CSV_IMPORT_MAX_ROWS ?? "", 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_ROWS
  return Math.min(n, 10_000)
}

/**
 * Companies one imported-list campaign takes from a list (file order). Kept
 * at 50 so fit scoring stays at two short LLM calls and the selection gate
 * (which accepts up to 100) stays usable; the rest of the list is left for the
 * next campaign.
 */
export const IMPORT_COMPANIES_PER_CAMPAIGN = 50

/** A file looks like CSV by name and type. Browsers send "", text/csv or the Excel CSV type. */
export function looksLikeCsv(fileName: string, mimeType: string): boolean {
  if (!/\.csv$/i.test(fileName)) return false
  const type = mimeType.toLowerCase()
  return (
    type === "" ||
    type === "text/csv" ||
    type === "text/plain" ||
    type === "application/csv" ||
    type === "text/x-csv" ||
    type === "application/vnd.ms-excel" ||
    type === "application/octet-stream"
  )
}
