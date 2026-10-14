/**
 * Verifies that weak-data quality failures no longer write platform-wide
 * suppression entries (bad contact name, email-confidence gate, LinkedIn gate
 * in Stage 5.5; failed MX check in Stage 5) while the contact is still
 * disqualified, and that a real bounce still writes one. Runs the real code
 * against the real DB on a throwaway org. No vendor calls: fetch is stubbed to
 * refuse every host except the database, and attempts are counted (the MX
 * check is a DNS lookup of a .invalid domain).
 *
 *   npx tsx scripts/test-suppression-quality.ts
 *
 * Deletes everything it created (org cascade + its suppression rows).
 */
import "dotenv/config"
import crypto from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { db } from "../src/utils/db"
import {
  gtmContact,
  gtmEmailDraft,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  gtmSuppressionEntry,
  organization,
  user,
} from "../src/db/schema"
import { executeQualifyCampaignContacts } from "../src/lib/gtm-stage-5-5"
import { recordBounceForDraft } from "../src/lib/reply-polling/record-bounce"
import { resolveContactEmail } from "../src/inngest/functions/find-contacts-email"

const blockedHosts: string[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  if (url.host.endsWith("neon.tech")) return realFetch(input, init)
  blockedHosts.push(url.host)
  throw new Error(`blocked vendor call to ${url.host}`)
}) as typeof fetch

const tag = crypto.randomBytes(4).toString("hex")
const orgId = `suppr-test-org-${tag}`
const userId = `suppr-test-user-${tag}`

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  await db.insert(user).values({ id: userId, name: "Suppression Test", email: `${userId}@scrunity-test.invalid`, emailVerified: true })
  await db.insert(organization).values({ id: orgId, name: "Suppression Test", slug: orgId })
  const [run] = await db.insert(gtmResearchRun).values({
    organizationId: orgId, createdBy: userId, websiteUrl: "https://suppr-test.example", companyName: "Suppr Test",
    companyDescription: "test", companySize: "11-50", status: "done", currentStage: "done",
  }).returning()
  const [segment] = await db.insert(gtmIcpSegment).values({
    researchRunId: run.id, name: "Test segment", painPoint: "test", criteria: ["x"], exampleCompanies: [], targetKeywords: ["x"],
  }).returning()
  const [campaign] = await db.insert(gtmOutreachCampaign).values({
    icpSegmentId: segment.id, researchRunId: run.id, status: "in_progress", currentStage: "write_emails",
  }).returning()
  const [company] = await db.insert(gtmProspectCompany).values({
    outreachCampaignId: campaign.id, name: "Listicle Co", domain: `listicle-${tag}.example`, description: "x", location: "IN",
  }).returning()
  const [badName] = await db.insert(gtmContact).values({
    prospectCompanyId: company.id, name: "Best Marketing Automation Startups (2026) Team", title: "Team",
    email: `contact@listicle-${tag}.example`,
  }).returning()

  const [lowConfidence] = await db.insert(gtmContact).values({
    prospectCompanyId: company.id, name: "Rahul Verma", title: "CEO", email: `rahul@listicle-${tag}.example`,
    emailSource: "pattern_guessed_unverified", linkedinUrl: "https://www.linkedin.com/in/rahul-verma-test",
  }).returning()
  const [noLinkedin] = await db.insert(gtmContact).values({
    prospectCompanyId: company.id, name: "Anita Desai", title: "COO", email: `anita@listicle-${tag}.example`,
    verificationStatus: "enrich_verified", linkedinUrl: null,
  }).returning()

  console.log("Stage 5.5 quality disqualifications")
  await executeQualifyCampaignContacts(campaign.id)
  for (const [label, contact] of [["bad name", badName], ["email confidence (was mx_invalid)", lowConfidence], ["no LinkedIn (was no_linkedin_found)", noLinkedin]] as const) {
    const [draft] = await db.select().from(gtmEmailDraft).where(eq(gtmEmailDraft.contactId, contact.id))
    const rows = await db.select().from(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.sourceContactId, contact.id))
    check(`${label}: contact is disqualified`, draft?.status === "rejected", draft?.errorMessage ?? "no draft")
    check(`${label}: no suppression row`, rows.length === 0, rows.map((r) => r.reason).join(",") || "0 rows")
  }

  console.log("Stage 5 MX check failure")
  const noMxDomain = `no-mx-${tag}.invalid`
  const resolved = await resolveContactEmail({
    person: { personName: "Kiran Rao", personTitle: "CEO", linkedinUrl: null },
    domain: noMxDomain, siteMarkdown: "", organizationId: orgId,
  })
  const mxRows = await db.select().from(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.domain, noMxDomain))
  check("failed MX check still marks the email unverified", resolved.emailSource === "pattern_guessed_unverified", resolved.emailSource)
  check("failed MX check writes no suppression row", mxRows.length === 0, mxRows.map((r) => r.reason).join(",") || "0 rows")

  console.log("Real bounce")
  const [person] = await db.insert(gtmContact).values({
    prospectCompanyId: company.id, name: "Priya Sharma", title: "Head of Growth", email: `priya@listicle-${tag}.example`,
  }).returning()
  const [sent] = await db.insert(gtmEmailDraft).values({
    contactId: person.id, outreachCampaignId: campaign.id, subject: "hi", body: "hi", status: "sent", sentAt: new Date(),
  }).returning()
  await recordBounceForDraft({ draftId: sent.id, rawSnippet: "550 5.1.1 Address not found" })
  const bounceRows = await db.select().from(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.sourceContactId, person.id))
  check("bounce creates a hard_bounce suppression row", bounceRows.length === 1 && bounceRows[0].reason === "hard_bounce",
    bounceRows.map((r) => r.reason).join(",") || "none")

  check("no vendor call was attempted", blockedHosts.length === 0, blockedHosts.join(", ") || "none")
  const removed = await db.delete(gtmSuppressionEntry)
    .where(inArray(gtmSuppressionEntry.sourceContactId, [badName.id, lowConfidence.id, noLinkedin.id, person.id])).returning({ id: gtmSuppressionEntry.id })
  removed.push(...(await db.delete(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.domain, noMxDomain)).returning({ id: gtmSuppressionEntry.id })))
  await db.delete(organization).where(eq(organization.id, orgId))
  await db.delete(user).where(eq(user.id, userId))
  console.log(`Cleanup: removed org ${orgId}, user, ${removed.length} suppression row(s)`)
}

main().catch(async (err) => {
  console.error(err)
  await db.delete(organization).where(eq(organization.id, orgId)).catch(() => {})
  await db.delete(user).where(eq(user.id, userId)).catch(() => {})
  process.exit(1)
})
