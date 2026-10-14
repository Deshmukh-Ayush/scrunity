/**
 * ONE REAL micro-run of the verified-lead search. SPENDS REAL CREDITS:
 * FullEnrich (at most FULLENRICH_MONTHLY_CREDIT_CAP for the whole month,
 * enforced by the ledger), Firecrawl (within its existing caps) and the LLM.
 * Stops at drafts: nothing is approved or sent, and no mailbox is connected.
 *
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/run-live-micro.ts run
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/run-live-micro.ts cleanup <orgId>
 *
 * Uses a throwaway organization whose research run and segment copy the most
 * recent campaign of SOURCE_CAMPAIGN_ID (read-only), in legacy (web) discovery
 * mode. Prints FullEnrich's own balance (free endpoint) before and after.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { db } from "../src/utils/db"
import { gtmOutreachCampaign } from "../src/db/schema"
import { runCampaignPipeline } from "../src/lib/pipeline/runner"
import { leadSearchMessage } from "../src/lib/lead-search-message"

const SOURCE_CAMPAIGN_ID = process.env.SOURCE_CAMPAIGN_ID || "YAuvhAab-ogSOyVq6c4oS"
const q = (s: TemplateStringsArray, ...v: unknown[]) => db.execute(sql(s, ...v))
const rows = async (s: TemplateStringsArray, ...v: unknown[]) => (await q(s, ...v)).rows as any[]
const mask = (e: string | null) => (e ? e.replace(/^(.).*(@.*)$/, "$1***$2") : null)

async function balance(label: string) {
  const res = await fetch("https://app.fullenrich.com/api/v2/account/credits", {
    headers: { Authorization: `Bearer ${process.env.FULLENRICH_API_KEY}` },
  })
  console.log(`[FullEnrich balance ${label}] HTTP ${res.status} ${await res.text()}`)
}

async function run() {
  if (!process.env.FULLENRICH_API_KEY) throw new Error("FULLENRICH_API_KEY is missing")
  delete process.env.GTM_PROVIDER_MODE
  process.env.GTM_DISCOVERY_MODE = "legacy"
  process.env.FULLENRICH_MONTHLY_CREDIT_CAP ??= "6"
  process.env.GTM_EMAIL_LOOKUPS_PER_CAMPAIGN ??= "4"
  const tag = crypto.randomBytes(3).toString("hex")
  const id = (k: string) => `live-${tag}-${k}`

  const [src] = await rows`select r.company_name, r.company_description, r.website_url, r.company_size, r.target_country_code, r.target_region,
      s.name, s.pain_point, s.criteria, s.example_companies, s.target_keywords
    from gtm_outreach_campaign c join gtm_research_run r on r.id = c.research_run_id join gtm_icp_segment s on s.id = c.icp_segment_id
    where c.id = ${SOURCE_CAMPAIGN_ID}`
  console.log(`Segment copied from ${SOURCE_CAMPAIGN_ID}: "${src.name}" (seller: ${src.company_name})`)

  await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("u")}, 'Live micro-run', ${`${id("u")}@scrunity-test.invalid`}, true, now(), now())`
  await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org")}, 'Live micro-run', ${id("slug")}, 'pilot', now(), now())`
  await q`insert into member (id, organization_id, user_id, role, created_at) values (${id("m")}, ${id("org")}, ${id("u")}, 'owner', now())`
  await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage, target_country_code, target_region)
          values (${id("run")}, ${id("org")}, ${id("u")}, ${src.website_url}, ${src.company_name}, ${src.company_description}, ${src.company_size}, 'done', 'done', ${src.target_country_code}, ${src.target_region})`
  await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords)
          values (${id("seg")}, ${id("run")}, ${src.name}, ${src.pain_point}, ${JSON.stringify(src.criteria)}::jsonb, ${JSON.stringify(src.example_companies)}::jsonb, ${JSON.stringify(src.target_keywords)}::jsonb)`
  await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage, target_verified_leads, target_country_code, target_region)
          values (${id("camp")}, ${id("seg")}, ${id("run")}, 'in_progress', 'find_companies', 3, ${src.target_country_code}, ${src.target_region})`
  console.log(`Org ${id("org")}, campaign ${id("camp")}`)

  await balance("before")
  const t0 = Date.now()
  await runCampaignPipeline(id("camp"))
  const seconds = Math.round((Date.now() - t0) / 1000)
  await balance("after")

  const [c] = await db.select().from(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, id("camp")))
  console.log(`\nStage ${c.currentStage} / ${c.status} ${c.failureReason ?? ""} after ${seconds}s`)
  console.log(`Stage timings: ${JSON.stringify(c.stageTimings)}`)
  if (c.leadSearchOutcome) console.log(`Outcome: ${JSON.stringify(c.leadSearchOutcome)}\nMessage: "${leadSearchMessage(c.leadSearchOutcome)}"`)
  const people = await rows`select pc.domain, ct.name, ct.title, ct.email, ct.email_status, ct.skip_reason, ct.lookup_status,
      ct.enrich_metadata->>'vendorStatus' as vendor_status, ct.enrich_metadata->>'creditsUsed' as credits
    from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id
    where pc.outreach_campaign_id = ${id("camp")} order by ct.created_at`
  console.table(people.map((p) => ({ ...p, email: mask(p.email) })))
  console.table(await rows`select domain, decision_maker_status from gtm_prospect_company where outreach_campaign_id = ${id("camp")} order by created_at`)
  console.table(await rows`select vendor, endpoint, credits_used, created_at from gtm_vendor_usage where campaign_id = ${id("camp")} and vendor <> 'firecrawl' order by created_at`)
  console.log(`Firecrawl calls this campaign: ${(await rows`select count(*)::int n from gtm_vendor_usage where campaign_id = ${id("camp")} and vendor = 'firecrawl'`)[0].n}`)
  const drafts = await rows`select d.status, ct.name, d.subject from gtm_email_draft d join gtm_contact ct on ct.id = d.contact_id where d.outreach_campaign_id = ${id("camp")}`
  console.table(drafts)
  console.log(`FullEnrich month ledger: ${JSON.stringify((await rows`select coalesce(sum(credits_used),0)::int credits, count(*)::int rows from gtm_vendor_usage where vendor = 'fullenrich' and created_at >= date_trunc('month', now())`)[0])}`)
}

async function cleanup(orgId: string) {
  await q`delete from gtm_vendor_usage where organization_id = ${orgId} and vendor = 'firecrawl'`
  await q`delete from organization where id = ${orgId}`
  await q`delete from "user" where id = ${orgId.replace(/-org$/, "-u")}`
  console.log(`removed ${orgId} (FullEnrich ledger rows are kept: they are real spend)`)
}

const [command, arg] = process.argv.slice(2)
;(command === "run" ? run() : command === "cleanup" && arg ? cleanup(arg) : Promise.reject(new Error("usage: run | cleanup <orgId>")))
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
