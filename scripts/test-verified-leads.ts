/**
 * Verifies the verified-lead search (Stage 5) against the real database with
 * fixture providers: synthetic people and recorded FullEnrich responses, so
 * zero vendor calls and zero real credits. LLM calls (role derivation in the
 * runner path, company fit lines, drafts) do go to the configured LLM.
 *
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-verified-leads.ts
 *
 * Scenarios:
 *  1. full    Stage 4 -> selection gate -> Stage 5 search (target 3) -> drafts, via the runner
 *  2. budgets lookup budget, companies-examined budget, running out of companies
 *  3. stops   missing API key (stage fails cleanly) and monthly cap reached (no guessing)
 *  4. double  two executors at once, then Restart Stage, then a resumed vendor job
 * Creates one throwaway organization and deletes everything after.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { asc, eq, inArray, sql } from "drizzle-orm"
import { db } from "../src/utils/db"
import { gtmContact, gtmEmailDraft, gtmOutreachCampaign, gtmProspectCompany } from "../src/db/schema"
import { runCampaignPipeline, runCampaignStage } from "../src/lib/pipeline/runner"
import { claimCampaignStage } from "../src/lib/pipeline/stage-state"
import { confirmCompanySelection } from "../src/lib/pipeline/company-selection"
import { executeFindContacts } from "../src/inngest/functions/find-contacts"
import { leadSearchMessage } from "../src/lib/lead-search-message"
import { toPublicFailureReason } from "../src/lib/data/public-fields"

process.env.GTM_PROVIDER_MODE = "fixture"
process.env.GTM_DISCOVERY_MODE = "database"
process.env.GTM_PEOPLE_PROVIDER = "fixture"

const callsByHost = new Map<string, number>()
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  callsByHost.set(url.host, (callsByHost.get(url.host) ?? 0) + 1)
  return realFetch(input, init)
}) as typeof fetch
const vendorCalls = () =>
  [...callsByHost].filter(([h]) => /fullenrich|apollo|firecrawl|enrich\.so/.test(h)).reduce((n, [, c]) => n + c, 0)

const tag = crypto.randomBytes(3).toString("hex")
const id = (k: string) => `vl-${tag}-${k}`
let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures++
}
const q = (s: TemplateStringsArray, ...v: unknown[]) => db.execute(sql(s, ...v))
const rows = async (s: TemplateStringsArray, ...v: unknown[]) => (await q(s, ...v)).rows as any[]
const TITLES = ["Chief Executive Officer", "Chief Technology Officer"]
// The Australia company fixture, in its recorded (fit) order.
const AU = ["atlassian.com", "canva.com", "fujitsu.com", "freelancer.com", "talentinternational.com", "afr.com", "employmenthero.com", "cloudstaff.com"]

async function setup() {
  await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("u")}, 'VL', ${`vl-${tag}@scrunity-test.invalid`}, true, now(), now())`
  await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org")}, 'VL Test', ${id("slug")}, 'pilot', now(), now())`
  await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage, target_country_code)
          values (${id("run")}, ${id("org")}, ${id("u")}, 'https://vl.example', 'VL Outbound', 'Outbound automation for B2B teams', '11-50', 'done', 'done', 'AU')`
  await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords)
          values (${id("seg")}, ${id("run")}, 'Australian software companies', 'Manual outbound prospecting wastes sales time', '["50-5000 employees","Australia"]', '[]', '["software"]')`
}

/** A campaign at `stage`; with `domains`, prospect companies already stored in that order. */
async function campaign(key: string, stage: string, target: number, domains: string[] = []) {
  await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage, target_country_code, target_verified_leads)
          values (${id(key)}, ${id("seg")}, ${id("run")}, 'in_progress', ${stage}, 'AU', ${target})`
  for (const [i, domain] of domains.entries()) {
    await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location, source, created_at)
            values (${id(`${key}-co${i}`)}, ${id(key)}, ${domain.split(".")[0]}, ${domain}, 'fixture company', 'Australia', 'fixture', now() + ${`${i} seconds`}::interval)`
  }
  return id(key)
}

async function people(campaignId: string) {
  const r = await rows`select pc.domain, c.name, c.title, c.email_status, c.email, c.skip_reason, c.lookup_status,
      c.enrich_metadata->>'vendorStatus' as vendor_status, (c.enrich_metadata->>'creditsUsed')::int as credits,
      c.email_lookup_ref is not null as has_ref
    from gtm_contact c join gtm_prospect_company pc on pc.id = c.prospect_company_id
    where pc.outreach_campaign_id = ${campaignId} order by c.created_at`
  console.table(r)
  return r
}
const ledger = async (campaignId: string) =>
  (await rows`select count(*)::int n, coalesce(sum(credits_used),0)::int credits from gtm_vendor_usage where campaign_id = ${campaignId} and vendor = 'fullenrich_fixture'`)[0]
const readCampaign = async (cid: string) => (await db.select().from(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, cid)))[0]

/** Stage 5 directly (fixed titles, no LLM), after claiming it like the runner does. */
async function searchOnly(cid: string) {
  if (!(await claimCampaignStage(cid, "find_contacts"))) throw new Error("could not claim")
  return executeFindContacts(cid, { titles: TITLES, log: (l) => console.log(`    ${l}`) })
}

async function full() {
  console.log("\n1. Full fixture run: Stage 4 -> gate -> verified-lead search (target 3) -> drafts")
  const cid = await campaign("full", "find_companies", 3)
  callsByHost.clear()
  const t0 = Date.now()
  await runCampaignPipeline(cid)
  const companies = await db.select().from(gtmProspectCompany).where(eq(gtmProspectCompany.outreachCampaignId, cid)).orderBy(asc(gtmProspectCompany.createdAt))
  check("Stage 4 parks at the selection gate", (await readCampaign(cid)).currentStage === "awaiting_company_selection", `${companies.length} companies`)
  await confirmCompanySelection(cid, companies.map((c) => c.id))
  await runCampaignPipeline(cid)
  const after = await readCampaign(cid)
  const tried = await people(cid)
  const outcome = after.leadSearchOutcome!
  console.log(`  outcome: ${JSON.stringify(outcome)}\n  message: "${leadSearchMessage(outcome)}"`)
  console.log(`  stage timings: ${JSON.stringify(after.stageTimings)}  (total ${Math.round((Date.now() - t0) / 1000)} s)`)
  const drafts = await db.select().from(gtmEmailDraft).where(eq(gtmEmailDraft.outreachCampaignId, cid))
  const verifiedIds = (await db.select().from(gtmContact).where(inArray(gtmContact.prospectCompanyId, companies.map((c) => c.id))))
    .filter((c) => c.verificationStatus === "mailbox_verified").map((c) => c.id)
  check("reached the target: 3 verified", outcome.result === "reached_target" && outcome.verified === 3, leadSearchMessage(outcome))
  check("campaign is awaiting approval with 3 drafts", after.currentStage === "awaiting_approval" && drafts.length === 3, `${after.currentStage}, ${drafts.length} drafts`)
  check("every draft is for a mailbox-verified contact", drafts.every((d) => verifiedIds.includes(d.contactId)))
  check("no rejected marker drafts for skipped people", drafts.every((d) => d.status === "draft"))
  check("only verified people carry an email", tried.every((p) => (p.email ? p.email_status === "verified" : true)))
  const l = await ledger(cid)
  const charged = tried.reduce((n, p) => n + (p.credits ?? 0), 0)
  check("ledger credits equal the credits the (fixture) vendor charged", l.credits === charged, `ledger ${l.credits}, results ${charged}, ${l.n} lookups`)
  check("zero vendor network calls", vendorCalls() === 0, JSON.stringify(Object.fromEntries(callsByHost)))
  check("stage timings recorded for find_companies, find_contacts, write_emails",
    ["find_companies", "find_contacts", "write_emails"].every((s) => after.stageTimings?.[s]?.ms !== undefined))
}

async function budgets() {
  process.env.GTM_LEAD_SEARCH_CONCURRENCY = "1"
  console.log("\n2a. Lookup budget: GTM_EMAIL_LOOKUPS_PER_CAMPAIGN=3, target 3")
  process.env.GTM_EMAIL_LOOKUPS_PER_CAMPAIGN = "3"
  const a = await campaign("budget", "find_contacts", 3, AU)
  const oa = await searchOnly(a)
  await people(a)
  check("ends short and honest", oa.result === "budget_reached" && oa.verified < 3 && oa.stopReason === "email_run_budget", leadSearchMessage(oa))
  check("never more than 3 lookups", (await ledger(a)).n <= 3, `${(await ledger(a)).n}`)
  delete process.env.GTM_EMAIL_LOOKUPS_PER_CAMPAIGN

  console.log("\n2b. Companies-examined budget: GTM_MAX_COMPANIES_EXAMINED=2, target 3")
  process.env.GTM_MAX_COMPANIES_EXAMINED = "2"
  const b = await campaign("examined", "find_contacts", 3, AU)
  const ob = await searchOnly(b)
  check("stops after 2 companies", ob.companiesExamined === 2 && ob.stopReason === "companies_examined_budget", leadSearchMessage(ob))
  delete process.env.GTM_MAX_COMPANIES_EXAMINED

  console.log("\n2c. Out of companies: only canva.com and afr.com (nobody verifiable), target 3")
  const c = await campaign("short", "find_contacts", 3, ["canva.com", "afr.com"])
  const oc = await searchOnly(c)
  await people(c)
  check("Found 0 of 3, no invented leads", oc.result === "out_of_companies" && oc.verified === 0, leadSearchMessage(oc))
  const emails = await rows`select count(*)::int n from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${c} and ct.email is not null`
  check("no address stored for anyone", emails[0].n === 0)
  delete process.env.GTM_LEAD_SEARCH_CONCURRENCY
}

async function stops() {
  console.log("\n3a. Missing FULLENRICH_API_KEY in live mode: the stage fails with a plain reason, nothing guessed")
  const savedKey = process.env.FULLENRICH_API_KEY
  delete process.env.FULLENRICH_API_KEY
  process.env.GTM_PROVIDER_MODE = "live"
  process.env.GTM_DISCOVERY_MODE = "legacy"
  callsByHost.clear()
  const a = await campaign("nokey", "find_contacts", 3, AU)
  const outcome = await runCampaignStage(a, "find_contacts")
  const row = await readCampaign(a)
  check("stage failed", outcome === "failed" && row.status === "failed", `${outcome}/${row.status}`)
  check("stored reason is email_provider_unavailable", row.failureReason === "email_provider_unavailable", row.failureReason ?? "")
  check("customers see the neutral code email_lookup_unavailable", toPublicFailureReason(row.failureReason) === "email_lookup_unavailable")
  const nonDb = [...callsByHost].filter(([h]) => !h.includes("neon.tech"))
  check("no people stored, no call to any vendor or LLM", (await people(a)).length === 0 && nonDb.length === 0, JSON.stringify(Object.fromEntries(callsByHost)))
  process.env.FULLENRICH_API_KEY = savedKey
  process.env.GTM_PROVIDER_MODE = "fixture"
  process.env.GTM_DISCOVERY_MODE = "database"

  console.log("\n3b. Monthly cap reached (FULLENRICH_MONTHLY_CREDIT_CAP=0): ends at once, nobody guessed")
  process.env.FULLENRICH_MONTHLY_CREDIT_CAP = "0"
  const b = await campaign("cap", "find_contacts", 3, AU)
  const ob = await searchOnly(b)
  const tried = await people(b)
  check("ends with the cap as reason", ob.result === "budget_reached" && ob.stopReason === "email_credit_cap_reached", leadSearchMessage(ob))
  check("no email stored for anyone", tried.every((p) => p.email === null))
  check("no lookups recorded", (await ledger(b)).n === 0)
  check("people stopped by the cap stay open for a later attempt", tried.every((p) => p.lookup_status === "lookup_incomplete"))
  delete process.env.FULLENRICH_MONTHLY_CREDIT_CAP
}

async function double() {
  console.log("\n4a. Double trigger: two runner executions of Stage 5 at the same time")
  const cid = await campaign("double", "find_contacts", 3, AU)
  const results = await Promise.all([runCampaignStage(cid, "find_contacts"), runCampaignStage(cid, "find_contacts")])
  const first = await ledger(cid)
  const tried = await people(cid)
  check("one executor ran, the other was skipped", results.sort().join(",") === "completed,skipped", results.join(","))
  const looked = tried.filter((p) => p.has_ref)
  check("each person looked up at most once", new Set(looked.map((p) => p.name)).size === looked.length && first.n === looked.length,
    `${first.n} ledger rows, ${looked.length} people with a job`)

  console.log("\n4b. Restart Stage on the finished search: no new lookups, no new spend")
  await db.update(gtmOutreachCampaign).set({ currentStage: "find_contacts", status: "in_progress", stageStartedAt: new Date(0), lastProgressAt: null })
    .where(eq(gtmOutreachCampaign.id, cid))
  await q`delete from gtm_email_draft where outreach_campaign_id = ${cid}`
  const again = await searchOnly(cid)
  const second = await ledger(cid)
  check("same ledger rows and credits after the restart", second.n === first.n && second.credits === first.credits, `${first.n}/${first.credits} -> ${second.n}/${second.credits}`)
  check("result unchanged", again.verified === 3, leadSearchMessage(again))

  console.log("\n4c. A vendor job started before a crash is polled again, not paid for twice")
  const r = await campaign("resume", "find_contacts", 1, ["fujitsu.com"])
  await q`insert into gtm_contact (id, prospect_company_id, name, title, source, provider_person_id, email_status, email_lookup_ref, lookup_status)
          values (${id("resume-ct")}, ${id("resume-co0")}, 'Ethan Fixturelli', 'Managing Director', 'fixture', 'fx-person-011', 'not_looked_up',
                  'fixture:ethan fixturelli@fujitsu.com', 'complete')`
  const or = await searchOnly(r)
  const [ct] = await db.select().from(gtmContact).where(eq(gtmContact.id, id("resume-ct")))
  check("resumed job verified the person", or.verified === 1 && ct.emailStatus === "verified", `${ct.emailStatus}`)
  check("no new reservation for the resumed job", (await ledger(r)).n === 0, `${(await ledger(r)).n} rows`)
  check("nobody else was looked up", (await people(r)).length === 1)
}

async function cleanup() {
  await q`delete from gtm_vendor_usage where campaign_id like ${`vl-${tag}-%`}`
  await q`delete from organization where id = ${id("org")}`
  await q`delete from "user" where id = ${id("u")}`
  const left = (await rows`select
    (select count(*) from gtm_outreach_campaign where id like ${`vl-${tag}-%`})::int campaigns,
    (select count(*) from gtm_vendor_usage where campaign_id like ${`vl-${tag}-%`})::int ledger_rows,
    (select count(*) from organization where id = ${id("org")})::int orgs`)[0]
  console.log(`\nCleanup — remaining test rows: ${JSON.stringify(left)}`)
}

setup()
  .then(full)
  .then(budgets)
  .then(stops)
  .then(double)
  .catch((err) => { console.error(err); failures++ })
  .finally(async () => {
    await cleanup()
    console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
    process.exit(failures === 0 ? 0 : 1)
  })
