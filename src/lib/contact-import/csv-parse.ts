/**
 * A small RFC 4180 CSV parser for customer list uploads. Pure and DB-free, so
 * every edge case is unit-tested (csv-parse.test.ts).
 *
 * Handles: a UTF-8 byte order mark, comma or semicolon delimiters (Excel in
 * many European locales writes semicolons), tab as a fallback, quoted fields
 * holding delimiters, doubled quotes and line breaks, CRLF / LF / CR line
 * endings, blank rows, and duplicate or empty headers (renamed so every column
 * keeps its own key). No dependency: the repo has no CSV library and the
 * format is small enough to own.
 */

export type CsvDelimiter = "," | ";" | "\t"

export interface ParsedCsv {
  delimiter: CsvDelimiter
  /** Unique, trimmed header labels; duplicates become "Email (2)", empty ones "Column 3". */
  headers: string[]
  /** Data rows, each padded or cut to headers.length. Blank rows are dropped. */
  rows: string[][]
  /** 1-based line number in the file of each row's first line, for error messages. */
  lineNumbers: number[]
}

export class CsvParseError extends Error {
  constructor(public readonly code: "unterminated_quote" | "no_header" | "binary_content", public readonly line: number) {
    super(`CSV parse error: ${code} at line ${line}`)
    this.name = "CsvParseError"
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Picks the delimiter from the first line outside quotes: the most frequent of
 * comma, semicolon and tab. Ties go to comma.
 */
export function sniffDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ",": 0, ";": 0, "\t": 0 }
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break
    else if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) counts[ch]++
  }
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";"
  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t"
  return ","
}

/** Splits text into records of raw fields. Throws CsvParseError on an unclosed quote. */
function tokenize(text: string, delimiter: CsvDelimiter): { records: string[][]; lines: number[] } {
  const records: string[][] = []
  const lines: number[] = []
  let field = ""
  let record: string[] = []
  let inQuotes = false
  let line = 1
  let recordLine = 1
  let quoteLine = 1

  const endRecord = () => {
    record.push(field)
    records.push(record)
    lines.push(recordLine)
    record = []
    field = ""
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) line++
        field += ch
      }
      continue
    }
    if (ch === '"' && field.trim() === "") {
      // A quote opens a quoted field only at its start (spaces before it are dropped).
      field = ""
      inQuotes = true
      quoteLine = line
    } else if (ch === delimiter) {
      record.push(field)
      field = ""
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      endRecord()
      line++
      recordLine = line
    } else {
      field += ch
    }
  }
  if (inQuotes) throw new CsvParseError("unterminated_quote", quoteLine)
  if (field !== "" || record.length > 0) endRecord()
  return { records, lines }
}

const isBlank = (record: string[]) => record.every((f) => f.trim() === "")

/** Unique labels: empty headers get "Column N", repeats get " (2)", " (3)", ... */
export function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((h, i) => {
    const base = h.trim() || `Column ${i + 1}`
    const key = base.toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

export function parseCsv(input: string): ParsedCsv {
  const text = stripBom(input)
  // A NUL byte means a binary file (xlsx, image) renamed to .csv.
  if (text.includes("\u0000")) throw new CsvParseError("binary_content", 1)
  const delimiter = sniffDelimiter(text)
  const { records, lines } = tokenize(text, delimiter)

  const headerIndex = records.findIndex((r) => !isBlank(r))
  if (headerIndex < 0) throw new CsvParseError("no_header", 1)
  const headers = uniqueHeaders(records[headerIndex])

  const rows: string[][] = []
  const lineNumbers: number[] = []
  for (let i = headerIndex + 1; i < records.length; i++) {
    const record = records[i]
    if (isBlank(record)) continue
    const row = record.slice(0, headers.length).map((f) => f.trim())
    while (row.length < headers.length) row.push("")
    rows.push(row)
    lineNumbers.push(lines[i])
  }
  return { delimiter, headers, rows, lineNumbers }
}
