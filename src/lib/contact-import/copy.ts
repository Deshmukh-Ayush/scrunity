import type { RejectReason } from "./review"
import type { ImportErrorBody } from "./types"

/**
 * Every customer-facing string about imported lists, in one place for review.
 * Pure and client-safe.
 */

const pluralRules = new Intl.PluralRules("en")
export const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-US")} ${pluralRules.select(n) === "one" ? one : many}`

/** The attestation the user confirms before an import. Stored by version with each import. */
export const ATTESTATION_VERSION = "2026-10-22"
export const ATTESTATION_TEXT =
  "I have the right to contact the people in this list, and the list was collected lawfully."

export const IMPORT_COPY = {
  pageTitle: "Import a list",
  pageDescription: "Upload a CSV of people you want to reach. Scrunity researches their companies, writes the emails and waits for your approval before sending.",
  backToDataSources: "Data sources",

  stepUpload: "Upload",
  stepMap: "Match columns",
  stepReview: "Review",
  stepDone: "Done",

  uploadTitle: "Choose a CSV file",
  uploadHint: (maxMb: number, maxRows: number) =>
    `CSV only, up to ${maxMb} MB and ${maxRows.toLocaleString("en-US")} rows. Exports from Excel, Google Sheets and most CRMs work.`,
  uploadRequired: "Each person needs an email address, or a full name and a company website.",
  chooseFile: "Choose file",
  readingFile: "Reading your file",

  errorNotCsv: "This file isn't a CSV. In Excel or Google Sheets, use File > Download > CSV, then upload that file.",
  errorTooLarge: (maxMb: number) => `This file is larger than ${maxMb} MB. Split it into smaller files and import each one.`,
  errorTooManyRows: (rows: number, maxRows: number) =>
    `This file has ${rows.toLocaleString("en-US")} rows. The limit is ${maxRows.toLocaleString("en-US")}. Split it into smaller files and import each one.`,
  errorEmpty: "This file has no rows under the header.",
  errorParse: (line: number) =>
    `This file couldn't be read: a quoted value that starts on line ${line} is never closed. Check that line in a spreadsheet, save as CSV again, then upload it.`,
  errorBinary: "This file couldn't be read as text. Save it as CSV (UTF-8) and upload it again.",
  errorGeneric: "This file couldn't be read. Try again, or save it as CSV (UTF-8) and upload it again.",
  chooseAnother: "Choose another file",

  mapTitle: "Match your columns",
  mapDescription: "Check what each column holds. Columns set to Ignore aren't imported.",
  mapColumnHeader: "Column in your file",
  mapFieldHeader: "Imports as",
  mapSampleHeader: "First value",
  ignoreOption: "Ignore",
  previewTitle: (n: number) => `First ${count(n, "row", "rows")}`,
  missingIdentity: "Match a column to Email, or match Full name (or First and Last name) and Website or domain.",
  duplicateField: "Two columns are matched to the same field. Set one of them to Ignore.",
  continueAction: "Continue",
  backAction: "Back",

  reviewTitle: "Review the list",
  reviewChecking: "Checking for duplicates and people who can't be contacted",
  personalNote: (n: number) =>
    `${count(n, "person uses", "people use")} a personal email address (Gmail and similar). They import, but the company can't be told from the address.`,
  missingNameNote: (n: number) =>
    `${count(n, "person has", "people have")} no name. They import, but Scrunity can't write an email to them until a name is added.`,
  attestationLabel: ATTESTATION_TEXT,
  attestationRequired: "Confirm that you may contact these people before you import.",
  importAction: (n: number) => `Import ${count(n, "person", "people")}`,
  nothingToImport: "No rows can be imported. Download the rejected rows to see why.",
  importing: "Importing",

  summaryTitle: "List imported",
  summaryText: (n: number, fileName: string) => `${count(n, "person", "people")} from ${fileName} can now be used in campaigns.`,
  downloadRejected: (n: number) => `Download ${count(n, "rejected row", "rejected rows")}`,
  startCampaign: "Start a campaign",
  importAnother: "Import another list",

  countImported: "Imported",
  countDuplicates: "Duplicates",
  countInvalid: "Invalid",
  countSuppressed: "Can't be contacted",
  countPersonal: "Personal email",

  emailStatus: "From your list, not verified",

  listsTitle: "Imported lists",
  listsDescription: "People from your own CSV files. Their addresses aren't verified, so check your bounce rate.",
  listsEmpty: "No lists yet. Import a CSV of people you want to reach.",
  listsImportAction: "Import a list",
  listPeople: (n: number) => count(n, "person", "people"),
  listUploadedBy: (name: string | null) => (name ? `Uploaded by ${name}` : "Uploaded by a former member"),
  deleteAction: "Delete list",
  deleteTitle: (name: string) => `Delete ${name}?`,
  deleteBody: "This removes the list, its people and any emails to them that were never sent.",
  deleteKeepsSent: (n: number) =>
    `${count(n, "person you already emailed stays", "people you already emailed stay")}, so replies still reach the right thread and opt-outs still apply.`,
  deleteConfirm: "Delete list",
  deletedToast: "List deleted",
  deleteFailed: "The list wasn't deleted. Try again.",
  cancelAction: "Cancel",
  managerOnly: "Only owners and admins can import or delete lists.",
} as const

/** The message for an upload or import error code from the API. */
export function importErrorText(error: ImportErrorBody, limits: { maxMb: number; maxRows: number }): string {
  switch (error.code) {
    case "not_csv":
      return IMPORT_COPY.errorNotCsv
    case "too_large":
      return IMPORT_COPY.errorTooLarge(limits.maxMb)
    case "too_many_rows":
      return IMPORT_COPY.errorTooManyRows(error.rows ?? limits.maxRows + 1, limits.maxRows)
    case "empty_file":
      return IMPORT_COPY.errorEmpty
    case "parse_error":
      return IMPORT_COPY.errorParse(error.line ?? 1)
    case "binary_file":
      return IMPORT_COPY.errorBinary
    case "missing_identity":
      return IMPORT_COPY.missingIdentity
    case "duplicate_field":
      return IMPORT_COPY.duplicateField
    case "attestation_required":
      return IMPORT_COPY.attestationRequired
    case "nothing_to_import":
      return IMPORT_COPY.nothingToImport
    default:
      return IMPORT_COPY.errorGeneric
  }
}

/** The reason column of the rejected-rows file and the review table. */
export const REJECT_REASON_TEXT: Record<RejectReason, string> = {
  invalid_email: "Email address isn't valid",
  missing_identity: "No email, and no full name with a company website",
  duplicate_in_file: "Duplicate of an earlier row in this file",
  already_in_contacts: "Already in your contacts or another list",
  do_not_contact: "On your do-not-contact list",
  suppressed: "This address or domain can't be contacted",
}

/** Campaign failures specific to imported lists (campaign page). */
export const IMPORT_CAMPAIGN_FAILURE_TEXT: Record<string, string> = {
  import_list_unavailable: "The imported list for this campaign was deleted or is empty, so there's no one to write to. Start a new campaign from another list.",
  paused_bounce_rate:
    "Sending is paused to protect your mailbox: more than 5% of the emails sent from this list bounced. Clean the list's addresses, then import it again and start a new campaign.",
}
