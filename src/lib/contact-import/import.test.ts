import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { autoMapping, detectField, isColumnMapping, mappingProblem, type ColumnMapping } from "./columns"
import { buildRecord, cleanEmail, domainFromWebsite, isValidEmailSyntax } from "./clean"
import { buildRecords, reviewRecords, NO_CHECKS } from "./review"
import { csvField, escapeFormula, rejectedFileName, rejectedRowsCsv } from "./export"
import { importBlock, readCsvFile, reviewFile } from "./process"
import { getCsvImportMaxRows, looksLikeCsv } from "./limits"
import { shouldPauseForBounces } from "./bounce-guard"
import { planImportDelete } from "./delete-plan"
import { groupImportRows, type ImportRowLike } from "./group"
import { checkLeadQualificationGates } from "@/lib/gtm-qualification-gates"
import { isSendableEmail, isVerifiedEmail } from "@/lib/email-verification"

const headers = ["First Name", "Last Name", "Email", "Job Title", "Company", "Website"]
const mapping = autoMapping(headers)
const row = (first: string, last: string, email: string, company = "Acme", website = "acme.example") => [first, last, email, "CEO", company, website]

describe("header auto-detection", () => {
  it("recognizes common CRM, Sheets and Excel spellings", () => {
    assert.deepEqual(mapping, ["firstName", "lastName", "email", "title", "company", "website"])
    assert.equal(detectField("E-mail Address"), "email")
    assert.equal(detectField("Person Linkedin Url"), "linkedinUrl")
    assert.equal(detectField("company_domain"), "website")
    assert.equal(detectField("Email Status"), null)
    assert.equal(detectField("Company LinkedIn URL"), null)
  })

  it("maps a field once; a second matching column stays ignored", () => {
    assert.deepEqual(autoMapping(["Email", "Work Email", "Name"]), ["email", null, "fullName"])
  })
})

describe("required fields", () => {
  it("needs an email column, or a name and a company website", () => {
    assert.equal(mappingProblem(["email", null]), null)
    assert.equal(mappingProblem(["fullName", "website"]), null)
    assert.equal(mappingProblem(["firstName", "lastName", "website"]), null)
    assert.equal(mappingProblem(["firstName", "website"]), "missing_identity")
    assert.equal(mappingProblem(["fullName", "company"]), "missing_identity")
    assert.equal(mappingProblem(["email", "email"]), "duplicate_field")
  })

  it("rejects a row with neither an email nor a name and domain", () => {
    const m: ColumnMapping = ["fullName", "email", "website"]
    assert.equal(buildRecord(["Ana Ortiz", "", "acme.example"], m, 2).problem, null)
    assert.equal(buildRecord(["Ana Ortiz", "", ""], m, 3).problem, "missing_identity")
    assert.equal(buildRecord(["", "ana@acme.example", ""], m, 4).problem, null)
  })

  it("validates mappings that come from the browser", () => {
    assert.equal(isColumnMapping(["email", null], 2), true)
    assert.equal(isColumnMapping(["email"], 2), false)
    assert.equal(isColumnMapping(["password", null], 2), false)
  })
})

describe("email cleaning", () => {
  it("trims, lowercases and strips mailto", () => {
    assert.equal(cleanEmail("  Mailto:Ana.Ortiz@ACME.example "), "ana.ortiz@acme.example")
  })

  it("checks syntax", () => {
    assert.equal(isValidEmailSyntax("ana@acme.example"), true)
    for (const bad of ["ana@", "ana acme@acme.example", "ana@acme", "ana@@acme.example", ".ana@acme.example", "ana@acme.e"]) {
      assert.equal(isValidEmailSyntax(bad), false, bad)
    }
  })

  it("derives the domain from the website, else from a work email", () => {
    assert.equal(domainFromWebsite("https://www.Acme.example/about?x=1"), "acme.example")
    assert.equal(domainFromWebsite("not a site"), null)
    const m: ColumnMapping = ["email", "website"]
    assert.equal(buildRecord(["ana@acme.example", ""], m, 2).record.domain, "acme.example")
    assert.equal(buildRecord(["ana@acme.example", "beta.example"], m, 2).record.domain, "beta.example")
  })

  it("flags personal mailboxes instead of rejecting them, and never takes gmail.com as the company", () => {
    const { record, problem } = buildRecord(["ana.ortiz@gmail.com", ""], ["email", "website"], 2)
    assert.equal(problem, null)
    assert.equal(record.personalEmail, true)
    assert.equal(record.domain, null)
  })
})

describe("review", () => {
  it("dedupes inside the file by email and by name + domain", () => {
    const built = buildRecords(
      [row("Ana", "Ortiz", "ana@acme.example"), row("Ana", "Ortiz", "ANA@acme.example "), row("Ben", "Lee", ""), row("ben", "lee", "")],
      mapping
    )
    const review = reviewRecords(built)
    assert.equal(review.counts.imported, 2)
    assert.equal(review.counts.duplicates, 2)
    assert.deepEqual(review.rejected.map((r) => r.reason), ["duplicate_in_file", "duplicate_in_file"])
  })

  it("dedupes against the organization's contacts and skips do-not-contact and suppressed people", () => {
    const built = buildRecords(
      [
        row("Ana", "Ortiz", "ana@acme.example"),
        row("Ben", "Lee", "ben@acme.example"),
        row("Cara", "Diaz", "cara@acme.example"),
        row("Dev", "Rao", "dev@listings.example", "Listings", "listings.example"),
        row("Eve", "Moss", "eve@acme.example"),
      ],
      mapping
    )
    const review = reviewRecords(built, {
      ...NO_CHECKS,
      existingKeys: new Set(["email:ana@acme.example"]),
      doNotContact: new Set(["ben@acme.example"]),
      suppressedEmails: new Set(["cara@acme.example"]),
      suppressedDomains: new Set(["listings.example"]),
    })
    assert.deepEqual(review.rejected.map((r) => r.reason), ["already_in_contacts", "do_not_contact", "suppressed", "suppressed"])
    assert.equal(review.counts.imported, 1)
    assert.equal(review.counts.suppressed, 3)
    assert.equal(review.counts.duplicates, 1)
  })

  it("counts invalid rows and personal emails", () => {
    const built = buildRecords([row("Ana", "Ortiz", "not-an-email"), row("Ben", "Lee", "ben@gmail.com", "Acme", "")], mapping)
    const { counts, rejected } = reviewRecords(built)
    assert.equal(counts.invalid, 1)
    assert.equal(rejected[0].reason, "invalid_email")
    assert.equal(counts.personalEmails, 1)
  })
})

describe("rejected-rows file", () => {
  it("escapes cells a spreadsheet would run as a formula", () => {
    for (const cell of ["=HYPERLINK(\"x\")", "+1", "-2+3", "@SUM(A1)", "\t=1"]) assert.equal(escapeFormula(cell)[0], "'", cell)
    assert.equal(escapeFormula("Ana"), "Ana")
    assert.equal(csvField('=1,"2"'), `"'=1,""2"""`)
  })

  it("adds the row number and a reason column", () => {
    const csv = rejectedRowsCsv(["Email"], [{ rowNumber: 3, reason: "invalid_email", cells: ["=cmd|' /C calc'!A0"] }])
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n")
    assert.equal(lines[0], "Row,Email,Reason")
    assert.equal(lines[1], "3,'=cmd|' /C calc'!A0,Email address isn't valid")
    assert.equal(rejectedFileName("Leads Q4.csv"), "Leads Q4-rejected-rows.csv")
  })
})

describe("upload limits and steps", () => {
  const file = (name: string, text: string, type = "text/csv") => ({ name, type, size: Buffer.byteLength(text), text: async () => text })

  it("accepts .csv only and enforces the size and row limits", async () => {
    assert.equal(looksLikeCsv("list.xlsx", ""), false)
    assert.equal(looksLikeCsv("list.csv", "application/vnd.ms-excel"), true)
    assert.deepEqual(await readCsvFile(file("list.xlsx", "a"), 10), { ok: false, error: { code: "not_csv" } })
    const big = { ...file("list.csv", "Email\n"), size: 5 * 1024 * 1024 + 1 }
    assert.deepEqual(await readCsvFile(big, 10), { ok: false, error: { code: "too_large" } })
    const many = await readCsvFile(file("list.csv", "Email\n" + "a@b.example\n".repeat(11)), 10)
    assert.deepEqual(many, { ok: false, error: { code: "too_many_rows", rows: 11 } })
    assert.equal(getCsvImportMaxRows({ GTM_CSV_IMPORT_MAX_ROWS: "500" } as Record<string, string> as NodeJS.ProcessEnv), 500)
    assert.equal(getCsvImportMaxRows({} as NodeJS.ProcessEnv), 2000)
  })

  it("requires the attestation before an import", async () => {
    const parsed = await readCsvFile(file("list.csv", "Email\nana@acme.example\n"), 10)
    assert.ok(parsed.ok)
    const review = await reviewFile({ parsed: parsed.value, mapping: ["email"], loadChecks: async () => NO_CHECKS })
    assert.ok(review.ok)
    assert.deepEqual(importBlock(review.value, false), { code: "attestation_required" })
    assert.equal(importBlock(review.value, true), null)
  })

  it("refuses a mapping without the required columns", async () => {
    const parsed = await readCsvFile(file("list.csv", "Name,Phone\nAna,1\n"), 10)
    assert.ok(parsed.ok)
    const review = await reviewFile({ parsed: parsed.value, mapping: ["fullName", "phone"], loadChecks: async () => NO_CHECKS })
    assert.deepEqual(review, { ok: false, error: { code: "missing_identity" } })
  })
})

describe("email status from an imported list", () => {
  it("passes the email and LinkedIn gates as user_provided, but is never verified", () => {
    const contact = { email: "ana@acme.example", verificationStatus: "user_provided", linkedinUrl: null }
    assert.deepEqual(checkLeadQualificationGates(contact), { qualified: true })
    assert.equal(isVerifiedEmail(contact), false)
    assert.equal(isSendableEmail(contact), true)
    assert.equal(checkLeadQualificationGates({ ...contact, verificationStatus: "unverified" }).qualified, false)
    assert.equal(isSendableEmail({ email: "", verificationStatus: "user_provided" }), false)
  })
})

describe("bounce-rate pause", () => {
  it("waits for 20 sends, then pauses above 5%", () => {
    assert.equal(shouldPauseForBounces({ sent: 19, bounced: 10 }), false)
    assert.equal(shouldPauseForBounces({ sent: 20, bounced: 1 }), false)
    assert.equal(shouldPauseForBounces({ sent: 20, bounced: 2 }), true)
    assert.equal(shouldPauseForBounces({ sent: 100, bounced: 5 }), false)
    assert.equal(shouldPauseForBounces({ sent: 100, bounced: 6 }), true)
  })
})

describe("deleting a list", () => {
  it("keeps people who were emailed, removes the rest and every unsent draft", () => {
    const plan = planImportDelete({
      contacts: [
        { id: "c_sent", prospectCompanyId: "co_1" },
        { id: "c_bounced", prospectCompanyId: "co_1" },
        { id: "c_draft", prospectCompanyId: "co_2" },
        { id: "c_none", prospectCompanyId: "co_3" },
      ],
      drafts: [
        { id: "d_sent", contactId: "c_sent", status: "sent", sentAt: new Date() },
        { id: "d_followup", contactId: "c_sent", status: "draft", sentAt: null },
        { id: "d_bounced", contactId: "c_bounced", status: "failed", sentAt: new Date() },
        { id: "d_unsent", contactId: "c_draft", status: "approved", sentAt: null },
      ],
      companyIds: ["co_1", "co_2", "co_3"],
      otherContactCompanyIds: ["co_3"],
    })
    assert.deepEqual(plan.contactIds, ["c_draft", "c_none"])
    assert.deepEqual(plan.draftIds, ["d_followup", "d_unsent"])
    assert.deepEqual(plan.companyIds, ["co_2"])
    assert.equal(plan.keptContacts, 2)
  })
})

describe("grouping a list into a campaign", () => {
  const r = (id: string, rowNumber: number, over: Partial<ImportRowLike>): ImportRowLike => ({
    id, rowNumber, email: null, firstName: null, lastName: null, fullName: "Ana Ortiz", title: null,
    companyName: null, companyDomain: null, website: null, linkedinUrl: null, city: null, country: null, ...over,
  })

  it("groups by domain, then company name; caps companies and skips used emails", () => {
    const { companies, skippedAlreadyUsed, leftForLater } = groupImportRows(
      [
        r("1", 2, { companyDomain: "acme.example", companyName: "Acme", email: "a@acme.example" }),
        r("2", 3, { companyDomain: "acme.example", email: "b@acme.example" }),
        r("3", 4, { companyName: "Beta Co", email: "c@gmail.com" }),
        r("4", 5, { email: "d@gmail.com" }),
        r("5", 6, { companyDomain: "gamma.example", email: "e@gamma.example" }),
        r("6", 7, { companyDomain: "acme.example", email: "used@acme.example" }),
      ],
      { maxCompanies: 3, skipEmails: new Set(["used@acme.example"]) }
    )
    assert.deepEqual(companies.map((c) => [c.name, c.domain, c.people.length]), [["Acme", "acme.example", 2], ["Beta Co", "", 1], ["Company not given", "", 1]])
    assert.equal(skippedAlreadyUsed, 1)
    assert.equal(leftForLater, 1)
  })
})
