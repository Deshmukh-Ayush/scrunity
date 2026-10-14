/**
 * In-process verification of the send-time and opt-out fixes
 * (docs/tenant-security-audit.md A4, A5, A6) with stubbed sender and
 * classifier: no email leaves, no LLM or Firecrawl call is made.
 *
 *   TEST_THROTTLE_DELAY_SECONDS=0 FIRECRAWL_ORG_DAILY_CAP=3 \
 *     npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-send-safety.ts
 *
 * Creates two throwaway organizations (S and T) and deletes everything after.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { gtmConnectedMailbox } from "../src/db/schema"
import { db } from "../src/utils/db"
import { executeSendEmails } from "../src/inngest/functions/send-emails"
import { setMailboxSenderForTests } from "../src/lib/mailbox-dispatcher"
import { processLatestReply } from "../src/lib/reply-polling/process-reply"
import { listEligibleDrafts } from "../src/lib/reply-polling/eligible-drafts"
import { executeQualifyCampaignContacts } from "../src/lib/gtm-stage-5-5"
import { getSendBlock } from "../src/lib/send-eligibility"
import { checkFirecrawlCallAllowed, FirecrawlSpendPausedError } from "../src/lib/firecrawl-spend"
import { consumeOrgQuota } from "../src/lib/org-quota"

const tag = crypto.randomBytes(3).toString("hex")
const id = (k: string) => `ss-${tag}-${k}`
const domain = `ss-${tag}.example`
const mail = (local: string) => `${local}@${domain}`
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

async function contact(key: string, name: string, local: string, extra: { lookup?: string } = {}) {
  await q`insert into gtm_contact (id, prospect_company_id, name, title, email, email_source, verification_status, linkedin_url, lookup_status)
          values (${id(key)}, ${id("co")}, ${name}, 'CEO', ${mail(local)}, 'enrich_verified', 'enrich_verified', ${`https://www.linkedin.com/in/ss-${local}`}, ${extra.lookup ?? "complete"})`
}

async function setup() {
  await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("u")}, 'SS', ${`ss-${tag}@scrunity-test.invalid`}, true, now(), now())`
  for (const o of ["S", "T"]) {
    await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org" + o)}, ${"SS " + o}, ${id("slug" + o)}, 'pilot', now(), now())`
    await q`insert into gtm_ai_credit_period (id, organization_id, period_start, period_end, plan, plan_allotment, credits_used, credits_remaining)
            values (${id("p" + o)}, ${id("org" + o)}, now() - interval '1 hour', now() + interval '30 days', 'pilot', 300, 0, 300)`
  }
  await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage)
          values (${id("run")}, ${id("orgS")}, ${id("u")}, 'https://ss.example', 'SS', 'x', '11-50', 'done', 'done')`
  await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords) values (${id("seg")}, ${id("run")}, 'seg', 'x', '["x"]', '[]', '["x"]')`
  await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage) values (${id("camp")}, ${id("seg")}, ${id("run")}, 'in_progress', 'send_emails')`
  await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location) values (${id("co")}, ${id("camp")}, 'SS Co', ${domain}, 'x', 'IN')`
  await q`insert into gtm_connected_mailbox (id, organization_id, provider, email, status, daily_send_count, connected_by)
          values (${id("mbx")}, ${id("orgS")}, 'imap_smtp', ${`sender-${tag}@scrunity-test.invalid`}, 'connected', 0, ${id("u")})`
  await contact("ok", "Priya Sharma", "priya")
  await contact("hb", "Anita Desai", "anita")
  await contact("opt", "Kiran Rao", "kiran")
  await contact("inc", "Rahul Verma", "rahul", { lookup: "lookup_incomplete" })
  // Forced into the queue by a direct database edit: every draft is 'approved'.
  for (const k of ["ok", "hb", "opt", "inc"]) {
    await q`insert into gtm_email_draft (id, contact_id, outreach_campaign_id, subject, body, status) values (${id("d-" + k)}, ${id(k)}, ${id("camp")}, 'Hello', 'Body', 'approved')`
  }
  await q`insert into gtm_suppression_entry (id, email, domain, reason, source_org_id, is_real_send_bounce) values (${id("sup")}, ${mail("anita")}, ${domain}, 'hard_bounce', ${id("orgT")}, true)`
  await q`insert into gtm_do_not_contact (id, organization_id, email, reason) values (${id("dnc0")}, ${id("orgS")}, ${mail("kiran")}, 'opt_out')`
}

async function run() {
  console.log("\nA4 send-time re-check with a stubbed sender (all four drafts forced to 'approved')")
  const first = await executeSendEmails({ outreachCampaignId: id("camp") })
  check("exactly one email sent, to the verified contact", sent.length === 1 && sent[0] === mail("priya"), JSON.stringify(sent))
  check("three drafts blocked at send time", first.blockedCount === 3, `${first.blockedCount}`)
  const st = await rows`select id, status, error_message from gtm_email_draft where outreach_campaign_id = ${id("camp")} order by id`
  const byId = Object.fromEntries(st.map((r) => [r.id, r]))
  check("hard-bounced address: rejected, not sent", byId[id("d-hb")].status === "rejected", byId[id("d-hb")].error_message)
  check("opted-out address: rejected, not sent", byId[id("d-opt")].status === "rejected", byId[id("d-opt")].error_message)
  check("lookup_incomplete contact: rejected, not sent", byId[id("d-inc")].status === "rejected", byId[id("d-inc")].error_message)
  await executeSendEmails({ outreachCampaignId: id("camp") })
  check("running the sender again sends nothing more (the verified draft sent once)", sent.length === 1, `${sent.length} total`)

  console.log("\nA5 opt-out reply -> per-organization do-not-contact")
  const [mailbox] = await db.select().from(gtmConnectedMailbox).where(eq(gtmConnectedMailbox.id, id("mbx")))
  const eligible = await listEligibleDrafts({ organizationId: id("orgS"), sentSince: new Date(Date.now() - 3600_000), polledBefore: new Date(), forcePoll: true })
  const draft = eligible.find((e) => e.id === id("d-ok"))
  check("sent draft is eligible for reply polling", Boolean(draft))
  const ourMsg = { id: draft!.providerMessageId, threadId: "t", internalDate: "1", snippet: "Hello", payload: { headers: [{ name: "From", value: mailbox.email }] } }
  const reply = (n: number) => ({ id: `reply-${n}-${tag}`, threadId: "t", internalDate: String(1 + n), snippet: `please stop emailing me ${n}`,
    payload: { headers: [{ name: "From", value: mail("priya") }, { name: "Subject", value: "Re: Hello" }] } })
  const classifier = async () => ({ intent: "not_interested" as const, reasoning: "asked to stop (stub)" })
  for (const n of [1, 2]) {
    await processLatestReply({
      mailbox,
      draft: draft!, thread: { id: "t", messages: [ourMsg, reply(n)] }, threadId: "t", accessToken: "x", maxTurns: 3,
      mockSender: async () => { throw new Error("no auto-reply expected") }, mockClassifier: classifier,
    })
  }
  const dnc = await rows`select count(*)::int n from gtm_do_not_contact where organization_id = ${id("orgS")} and email = ${mail("priya")}`
  check("opt-out recorded once, even after two opt-out replies", dnc[0].n === 1, `${dnc[0].n} row(s)`)

  // Re-run: the campaign's companies and contacts are deleted and rediscovered.
  await q`delete from gtm_prospect_company where id = ${id("co")}`
  await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location) values (${id("co2")}, ${id("camp")}, 'SS Co', ${domain}, 'x', 'IN')`
  await q`insert into gtm_contact (id, prospect_company_id, name, title, email, email_source, verification_status, linkedin_url)
          values (${id("again")}, ${id("co2")}, 'Priya Sharma', 'CEO', ${mail("priya")}, 'enrich_verified', 'enrich_verified', 'https://www.linkedin.com/in/ss-priya')`
  const dncAfterRerun = await rows`select count(*)::int n from gtm_do_not_contact where organization_id = ${id("orgS")} and email = ${mail("priya")}`
  check("the re-run's deletes leave the do-not-contact entry in place", dncAfterRerun[0].n === 1)
  await executeQualifyCampaignContacts(id("camp"))
  const requal = await rows`select status, error_message from gtm_email_draft where contact_id = ${id("again")}`
  check("rediscovered person is disqualified by Stage 5.5 (not drafted)", requal[0]?.status === "rejected", requal[0]?.error_message)
  const blockS = await getSendBlock(id("orgS"), { email: mail("priya"), name: "Priya Sharma", verificationStatus: "enrich_verified", linkedinUrl: "https://www.linkedin.com/in/x" })
  check("send check in org S: opted_out", blockS?.code === "opted_out", blockS?.code)
  const blockT = await getSendBlock(id("orgT"), { email: mail("priya"), name: "Priya Sharma", verificationStatus: "enrich_verified", linkedinUrl: "https://www.linkedin.com/in/x" })
  check("org T is not affected by org S's opt-out", blockT === null, blockT?.code ?? "not blocked")
  const hbT = await getSendBlock(id("orgT"), { email: mail("anita"), name: "Anita Desai", verificationStatus: "enrich_verified", linkedinUrl: "https://www.linkedin.com/in/x" })
  check("a hard bounce still blocks across organizations", hbT?.code === "hard_bounce", hbT?.code)

  console.log("\nA6 per-organization daily Firecrawl cap (FIRECRAWL_ORG_DAILY_CAP=3) and atomic quotas")
  const results: string[] = []
  for (let i = 0; i < 4; i++) {
    try { await checkFirecrawlCallAllowed({ organizationId: id("orgS") }); results.push("ok") }
    catch (e) { results.push(e instanceof FirecrawlSpendPausedError ? e.failureReason : String(e)) }
  }
  check("calls 1-3 allowed, 4th refused with the daily-cap reason", results.join(",") === "ok,ok,ok,firecrawl_org_daily_cap_exceeded", results.join(","))
  let tOk = true
  try { await checkFirecrawlCallAllowed({ organizationId: id("orgT") }) } catch { tOk = false }
  check("another organization is unaffected", tOk)
  const ledger = await rows`select count(*)::int n from gtm_vendor_usage where vendor = 'firecrawl' and organization_id = ${id("orgS")}`
  check("each allowed call reserved one vendor-ledger row (3)", ledger[0].n === 3, `${ledger[0].n}`)
  const def = { key: "ss_test", window: "hour" as const, env: "SS_TEST_LIMIT", fallback: 5, message: "x" }
  const burst = await Promise.all(Array.from({ length: 20 }, () => consumeOrgQuota(id("orgS"), def)))
  check("20 concurrent quota uses with limit 5 -> exactly 5 allowed (database counter)", burst.filter((r) => r.allowed).length === 5,
    `${burst.filter((r) => r.allowed).length} allowed`)

  console.log("\nA3 cost of the per-request membership lookup")
  const times: number[] = []
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now()
    await q`select role, organization_id from member where user_id = ${id("u")}`
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  console.log(`  membership query: median ${times[10].toFixed(1)} ms, p90 ${times[18].toFixed(1)} ms (20 runs, Neon HTTP, indexed member_user_idx)`)
}

async function cleanup() {
  setMailboxSenderForTests(null)
  await q`delete from gtm_suppression_entry where id = ${id("sup")} or email like ${`%@${domain}`}`
  await q`delete from gtm_vendor_usage where organization_id like ${`ss-${tag}-%`}`
  await q`delete from organization where id like ${`ss-${tag}-%`}`
  await q`delete from "user" where id like ${`ss-${tag}-%`}`
  const left = (await rows`select
    (select count(*) from organization where id like ${`ss-${tag}-%`})::int orgs,
    (select count(*) from gtm_email_draft where id like ${`ss-${tag}-%`})::int drafts,
    (select count(*) from gtm_contact where id like ${`ss-${tag}-%`})::int contacts,
    (select count(*) from gtm_do_not_contact where email like ${`%@${domain}`})::int dnc,
    (select count(*) from gtm_suppression_entry where email like ${`%@${domain}`})::int suppression,
    (select count(*) from gtm_vendor_usage where organization_id like ${`ss-${tag}-%`})::int vendor_rows,
    (select count(*) from org_usage_counter where organization_id like ${`ss-${tag}-%`})::int counters,
    (select count(*) from gtm_connected_mailbox where id = ${id("mbx")})::int mailboxes,
    (select count(*) from "user" where id like ${`ss-${tag}-%`})::int users`)[0]
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
