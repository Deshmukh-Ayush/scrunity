/**
 * Verified-only policy at the edges: an old unsent draft built on a guessed
 * (MX-only) address, and a synthetic fixture person, next to a properly
 * verified lead. Checks the default views hide the unverified lead, approval
 * refuses it, and the sender refuses it even when forced to 'approved' in the
 * database. Stubbed sender: no email leaves. No vendor or LLM call.
 *
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-verified-only-send.ts
 *
 * Creates one throwaway organization and deletes everything after.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "../src/utils/db"
import { executeSendEmails } from "../src/inngest/functions/send-emails"
import { setMailboxSenderForTests } from "../src/lib/mailbox-dispatcher"
import { getApprovalBlock } from "../src/lib/send-eligibility"
import { executeQualifyCampaignContacts } from "../src/lib/gtm-stage-5-5"
import { getCampaignDetail, listCampaignDrafts } from "../src/lib/data/campaigns"
import { checkLeadQualificationGates } from "../src/lib/gtm-qualification-gates"

const tag = crypto.randomBytes(3).toString("hex")
const id = (k: string) => `vs-${tag}-${k}`
const domain = `vs-${tag}.example`
let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures++
}
const q = (s: TemplateStringsArray, ...v: unknown[]) => db.execute(sql(s, ...v))
const rows = async (s: TemplateStringsArray, ...v: unknown[]) => (await q(s, ...v)).rows as any[]

const sent: string[] = []
setMailboxSenderForTests(async ({ to }) => {
  sent.push(to)
  return { messageId: `stub-${sent.length}-${tag}`, threadId: `thread-${sent.length}-${tag}` } as any
})

async function contact(key: string, name: string, local: string, source: string, verification: string, emailSource: string) {
  await q`insert into gtm_contact (id, prospect_company_id, name, title, email, email_source, verification_status, linkedin_url, source)
          values (${id(key)}, ${id("co")}, ${name}, 'CEO', ${`${local}@${domain}`}, ${emailSource}, ${verification},
                  ${`https://www.linkedin.com/in/vs-${local}`}, ${source})`
  await q`insert into gtm_email_draft (id, contact_id, outreach_campaign_id, subject, body, status)
          values (${id("d-" + key)}, ${id(key)}, ${id("camp")}, 'Hello', 'Body', 'draft')`
}

async function setup() {
  await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("u")}, 'VS', ${`vs-${tag}@scrunity-test.invalid`}, true, now(), now())`
  await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org")}, 'VS', ${id("slug")}, 'pilot', now(), now())`
  await q`insert into gtm_ai_credit_period (id, organization_id, period_start, period_end, plan, plan_allotment, credits_used, credits_remaining)
          values (${id("p")}, ${id("org")}, now() - interval '1 hour', now() + interval '30 days', 'pilot', 300, 0, 300)`
  await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage)
          values (${id("run")}, ${id("org")}, ${id("u")}, 'https://vs.example', 'VS', 'x', '11-50', 'done', 'done')`
  await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords) values (${id("seg")}, ${id("run")}, 'seg', 'x', '["x"]', '[]', '["x"]')`
  await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage) values (${id("camp")}, ${id("seg")}, ${id("run")}, 'awaiting_approval', 'awaiting_approval')`
  await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location) values (${id("co")}, ${id("camp")}, 'VS Co', ${domain}, 'x', 'AU')`
  await q`insert into gtm_connected_mailbox (id, organization_id, provider, email, status, daily_send_count, connected_by)
          values (${id("mbx")}, ${id("org")}, 'imap_smtp', ${`sender-${tag}@scrunity-test.invalid`}, 'connected', 0, ${id("u")})`
  // Verified by the email vendor: the only kind of lead that may be emailed.
  await contact("ok", "Priya Sharma", "priya", "web", "mailbox_verified", "vendor_lookup")
  // An old unsent draft from the legacy pipeline: a pattern guess that passed the MX check.
  await contact("guess", "Kiran Rao", "kiran.rao", "web", "pattern_guessed_mx_valid", "pattern_guessed_mx_valid")
  // Legacy enrich.so result: its docs do not state a mailbox-level check.
  await contact("enr", "Anita Desai", "anita", "web", "enrich_verified", "enrich_verified")
  // Synthetic fixture person with a "verified" fixture address.
  await contact("fx", "Olivia Sampleton", "olivia", "fixture", "mailbox_verified", "vendor_lookup")
}

async function run() {
  console.log("\nGate")
  for (const [label, status] of [["MX-only guess", "pattern_guessed_mx_valid"], ["catch-all/unknown", "unverified"], ["legacy enrich.so", "enrich_verified"], ["scraped on site", "found_on_site"]] as const) {
    const g = checkLeadQualificationGates({ email: "a@b.example", verificationStatus: status, linkedinUrl: "https://www.linkedin.com/in/x" })
    check(`${label} is refused`, !g.qualified, g.reason)
  }
  check("mailbox_verified passes", checkLeadQualificationGates({ email: "a@b.example", verificationStatus: "mailbox_verified", linkedinUrl: "https://www.linkedin.com/in/x" }).qualified)

  console.log("\nDefault views hide unverified leads")
  const detail = await getCampaignDetail(id("camp"), id("org"))
  const drafts = await listCampaignDrafts(id("camp"))
  console.log(`  contacts shown: ${detail!.contacts.map((c) => c.name).join(", ")}`)
  console.log(`  skipped: ${JSON.stringify(detail!.skippedContacts.map((s) => `${s.name}: ${s.reason}`))}`)
  console.log(`  summary: ${JSON.stringify(detail!.leadSummary)}; drafts shown: ${drafts.map((d) => d.contact.name).join(", ")}`)
  check("guessed-email lead hidden from contacts and drafts",
    !detail!.contacts.some((c) => c.name === "Kiran Rao") && !drafts.some((d) => d.contact.name === "Kiran Rao"))
  check("it is listed under Skipped with a neutral reason", detail!.skippedContacts.some((s) => s.name === "Kiran Rao" && s.reason === "Email not verified"))
  check("summary counts are honest", detail!.leadSummary.reviewed === 4 && detail!.leadSummary.verified === 2, JSON.stringify(detail!.leadSummary))
  check("no vendor wording in the response", !/enrich|fullenrich|mailbox_verified|vendor_lookup/i.test(JSON.stringify({ detail, drafts })))

  console.log("\nApproval")
  for (const [key, expectBlocked] of [["ok", false], ["guess", true], ["enr", true], ["fx", true]] as const) {
    const block = await getApprovalBlock(id("org"), id("d-" + key))
    check(`${key}: ${expectBlocked ? "refused" : "allowed"}`, Boolean(block) === expectBlocked, block ?? "no block")
  }

  console.log("\nSend: every draft forced to 'approved' by a direct database edit")
  await q`update gtm_email_draft set status = 'approved' where outreach_campaign_id = ${id("camp")}`
  await q`update gtm_outreach_campaign set status = 'in_progress', current_stage = 'send_emails' where id = ${id("camp")}`
  const result = await executeSendEmails({ outreachCampaignId: id("camp") })
  const st = Object.fromEntries((await rows`select id, status, error_message from gtm_email_draft where outreach_campaign_id = ${id("camp")}`).map((r) => [r.id, r]))
  check("only the verified lead was sent", sent.length === 1 && sent[0] === `priya@${domain}`, JSON.stringify(sent))
  for (const key of ["guess", "enr", "fx"]) {
    check(`${key}: rejected at send time`, st[id("d-" + key)].status === "rejected", st[id("d-" + key)].error_message)
  }
  check("three drafts blocked", result.blockedCount === 3, `${result.blockedCount}`)

  console.log("\nStage 5.5 re-qualification of the old guessed lead")
  await q`update gtm_email_draft set status = 'draft' where id = ${id("d-guess")}`
  await executeQualifyCampaignContacts(id("camp"))
  const [g] = await rows`select status, error_message from gtm_email_draft where id = ${id("d-guess")}`
  check("disqualified by the verified-email gate", g.status === "rejected", g.error_message)
}

async function cleanup() {
  setMailboxSenderForTests(null)
  await q`delete from organization where id = ${id("org")}`
  await q`delete from "user" where id = ${id("u")}`
  const left = (await rows`select (select count(*) from gtm_contact where id like ${`vs-${tag}-%`})::int contacts,
    (select count(*) from organization where id = ${id("org")})::int orgs`)[0]
  console.log(`\nCleanup — remaining test rows: ${JSON.stringify(left)}`)
}

setup()
  .then(run)
  .catch((err) => { console.error(err); failures++ })
  .finally(async () => {
    await cleanup()
    console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
    process.exit(failures === 0 ? 0 : 1)
  })
