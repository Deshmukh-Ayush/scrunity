import { autoMapping } from "@/lib/contact-import/columns"
import type { ImportPreview, ImportReviewResult, PublicImport } from "@/lib/contact-import/types"

/** Invented people at .example domains only. */
const HEADERS = ["First Name", "Last Name", "Email", "Job Title", "Company", "Website", "Notes"]
const SAMPLE: string[][] = [
  ["Ana", "Ortiz", "ana.ortiz@northwind.example", "Head of Operations", "Northwind Studio", "northwind.example", "Met at the spring meetup"],
  ["Ben", "Lee", "ben@harbor-labs.example", "Founder", "Harbor Labs", "https://harbor-labs.example", ""],
  ["Cara", "Diaz", "cara.diaz@gmail.com", "Marketing lead", "Fernhill Co", "", "Personal address from a webinar form"],
  ["Dev", "Rao", "dev@quartz.example", "CTO", "Quartz Analytics", "quartz.example", ""],
  ["Eli", "Moss", "eli.moss@lumen.example", "VP Sales", "Lumen Works", "lumen.example", "Asked for a follow-up in Q1"],
  ["Fay", "Chen", "fay@orbit.example", "COO", "Orbit Freight", "orbit.example", ""],
  ["Gus", "Park", "=HYPERLINK(\"http://evil.example\")", "Director", "Pine & Co", "pine.example", ""],
  ["Hana", "Ito", "hana.ito@meadow.example", "Head of Growth", "Meadow Health", "meadow.example", ""],
  ["", "", "info@cobalt.example", "", "Cobalt Systems", "cobalt.example", "Shared inbox"],
  ["Ivo", "Novak", "ivo@delta-forge.example", "Managing director", "Delta Forge", "delta-forge.example", ""],
]

export const PREVIEW: ImportPreview = {
  fileName: "conference-leads-q4.csv",
  headers: HEADERS,
  mapping: autoMapping(HEADERS),
  sample: SAMPLE,
  totalRows: 412,
}

/** Mapping with no Email and no Website: the required-field message. */
export const PREVIEW_MISSING: ImportPreview = {
  ...PREVIEW,
  headers: ["Name", "Title", "Organisation", "Phone"],
  mapping: autoMapping(["Name", "Title", "Organisation", "Phone"]),
  sample: SAMPLE.map((r) => [`${r[0]} ${r[1]}`.trim(), r[3], r[4], "+1 555 0100"]),
}

const LONG = "A very long note pasted from a CRM export. ".repeat(7).slice(0, 300)
const WIDE_HEADERS = Array.from({ length: 40 }, (_, i) => (i === 0 ? "Email" : i === 1 ? "Full Name" : i === 2 ? "Website" : `Custom field ${i + 1}`))

/** 40 columns and a 300-character cell, for the 320px break test. */
export const PREVIEW_WIDE: ImportPreview = {
  fileName: "crm-export-all-fields-2026-10-22-final-v3.csv",
  headers: WIDE_HEADERS,
  mapping: autoMapping(WIDE_HEADERS),
  sample: SAMPLE.map((r, row) => WIDE_HEADERS.map((_, i) => (i === 0 ? r[2] : i === 1 ? `${r[0]} ${r[1]}` : i === 2 ? r[5] : i === 5 && row === 0 ? LONG : `value ${row + 1}.${i + 1}`))),
  totalRows: 1980,
}

export const REVIEW: ImportReviewResult = {
  fileName: PREVIEW.fileName,
  headers: HEADERS,
  counts: { totalRows: 412, imported: 371, duplicates: 22, invalid: 9, suppressed: 10, personalEmails: 14, missingNames: 3 },
  rejected: [
    { rowNumber: 8, reason: "invalid_email", cells: SAMPLE[6] },
    { rowNumber: 14, reason: "duplicate_in_file", cells: SAMPLE[0] },
    { rowNumber: 23, reason: "already_in_contacts", cells: SAMPLE[3] },
    { rowNumber: 31, reason: "do_not_contact", cells: SAMPLE[5] },
    { rowNumber: 40, reason: "suppressed", cells: SAMPLE[9] },
    { rowNumber: 57, reason: "missing_identity", cells: ["", "", "", "", "", "", "Row with only a note"] },
  ],
}

export const REVIEW_NOTHING: ImportReviewResult = {
  ...REVIEW,
  counts: { totalRows: 3, imported: 0, duplicates: 1, invalid: 2, suppressed: 0, personalEmails: 0, missingNames: 0 },
  rejected: REVIEW.rejected.slice(0, 3),
}

export const IMPORTED: ImportReviewResult = { ...REVIEW, importId: "imp_fixture_1" }

export const LISTS: PublicImport[] = [
  {
    id: "imp_fixture_1",
    fileName: "conference-leads-q4.csv",
    createdAt: "2026-10-21T15:12:00.000Z",
    uploadedByName: "Riley Example",
    counts: { totalRows: 412, imported: 371, duplicates: 22, invalid: 9, suppressed: 10, personalEmails: 14 },
    emailedCount: 48,
  },
  {
    id: "imp_fixture_2",
    fileName: "partners-referrals.csv",
    createdAt: "2026-10-02T09:40:00.000Z",
    uploadedByName: null,
    counts: { totalRows: 58, imported: 58, duplicates: 0, invalid: 0, suppressed: 0, personalEmails: 3 },
    emailedCount: 0,
  },
]
