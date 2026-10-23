import type { RejectedRow } from "./review"
import { REJECT_REASON_TEXT } from "./copy"

/**
 * The rejected-rows file, built in the browser from the review response.
 * Pure. Cells that a spreadsheet would run as a formula (starting with =, +,
 * -, @, or a tab / carriage return before one) get a leading apostrophe, the
 * OWASP-recommended neutralization for CSV injection.
 */

const FORMULA_START = /^[=+\-@\t\r]/

export function escapeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value
}

/** One CSV field: formula-escaped, then quoted when it holds a quote, comma, semicolon or line break. */
export function csvField(value: string): string {
  const safe = escapeFormula(value)
  return /[",;\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function rejectedRowsCsv(headers: string[], rows: RejectedRow[]): string {
  const lines = [["Row", ...headers, "Reason"].map(csvField).join(",")]
  for (const row of rows) {
    lines.push([String(row.rowNumber), ...row.cells, REJECT_REASON_TEXT[row.reason]].map(csvField).join(","))
  }
  // BOM so Excel opens the file as UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`
}

/** "leads.csv" -> "leads-rejected-rows.csv". */
export function rejectedFileName(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, "") || "list"
  return `${base}-rejected-rows.csv`
}
