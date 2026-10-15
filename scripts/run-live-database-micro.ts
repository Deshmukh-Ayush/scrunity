/**
 * ONE REAL database-mode micro-run: Apollo organization search -> selection
 * gate -> verified-lead search -> drafts. SPENDS REAL CREDITS (tiny budgets):
 * Apollo <= 2 (org search only), FullEnrich <= FE_TEST_BUDGET (default 6),
 * Firecrawl within its existing caps, Groq LLM. Stops at drafts: nothing is
 * approved or sent, no mailbox is connected, and every mail host is blocked.
 *
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/run-live-database-micro.ts preflight
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/run-live-database-micro.ts stage4
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/run-live-database-micro.ts run
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/run-live-database-micro.ts restart <campaignId>
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/run-live-database-micro.ts cleanup <orgId>
 *
 * stage4: Stage 4 only (1 Apollo credit, LLM filters and fit scores, no
 * FullEnrich, no Firecrawl): prints the companies with score and reason, then
 * removes the test org (ledger rows kept). FE_TEST_BUDGET=0 by default here.
 * run: the full pipeline with the registered people provider
 * (GTM_PEOPLE_PROVIDER=web, providers/people-web.ts over Firecrawl).
 * APOLLO_CAP_TOTAL pins the Apollo monthly ledger cap across several runs.
 *
 * Writes a JSON trace (every external call with timing, the search log, Groq
 * token usage) to OUT_DIR (default: cwd).
 */
import "dotenv/config"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { eq, sql } from "drizzle-orm"

// ---------------------------------------------------------------------------
// Network guard + trace. Installed before any app module is imported.
// ---------------------------------------------------------------------------
const FE_TEST_BUDGET = Number(process.env.FE_TEST_BUDGET ?? (process.argv[2] === "stage4" ? 0 : 6))
const APOLLO_TEST_BUDGET = 2
const BLOCKED_HOSTS = [/gmail\.googleapis\.com/, /oauth2\.googleapis\.com/, /graph\.microsoft\.com/, /login\.microsoftonline\.com/, /api\.resend\.com/]
type Call = { at: string; ms: number; host: string; method: string; path: string; status: number | string; note?: string }
const trace = { calls: [] as Call[], searchLog: [] as string[], groq: { calls: 0, promptTokens: 0, completionTokens: 0 }, apollo: null as unknown, events: [] as string[] }
const counters = { apolloSearch: 0, fullenrichStart: 0 }
const realFetch = globalThis.fetch
const event = (line: string) => {
  const stamped = `${new Date().toISOString()} ${line}`
  trace.events.push(stamped)
  console.log(`[harness] ${stamped}`)
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
  if (/neon\.tech$/.test(url.hostname)) return realFetch(input, init) // the database driver
  if (BLOCKED_HOSTS.some((re) => re.test(url.hostname))) throw new Error(`[harness] mail host blocked: ${url.hostname}`)
  if (url.hostname === "api.apollo.io") {
    if (!(method === "POST" && url.pathname === "/api/v1/organizations/search")) {
      throw new Error(`[harness] Apollo endpoint not allowed in this test: ${method} ${url.pathname}`)
    }
    if (++counters.apolloSearch > APOLLO_TEST_BUDGET) throw new Error("[harness] Apollo test budget (2) exceeded")
  }
  if (url.hostname === "app.fullenrich.com" && method === "POST") {
    if (++counters.fullenrichStart > FE_TEST_BUDGET) throw new Error(`[harness] FullEnrich test budget (${FE_TEST_BUDGET}) exceeded`)
  }
  const started = Date.now()
  let res: Response
  try {
    res = await realFetch(input, init)
  } catch (err) {
    trace.calls.push({ at: new Date(started).toISOString(), ms: Date.now() - started, host: url.hostname, method, path: url.pathname, status: `error: ${(err as Error).message}` })
    throw err
  }
  const call: Call = { at: new Date(started).toISOString(), ms: Date.now() - started, host: url.hostname, method, path: url.pathname, status: res.status }
  trace.calls.push(call)
  try {
    if (url.hostname === "api.groq.com" && res.ok) {
      const body = await res.clone().json()
      trace.groq.calls++
      trace.groq.promptTokens += body?.usage?.prompt_tokens ?? 0
      trace.groq.completionTokens += body?.usage?.completion_tokens ?? 0
    }
    if (url.hostname === "api.apollo.io" && res.ok) {
      const body = await res.clone().json()
      const orgs = (body.organizations ?? []) as any[]
      trace.apollo = {
        totalEntries: body.pagination?.total_entries ?? null,
        returned: orgs.length,
        withDomain: orgs.filter((o) => o.primary_domain || o.website_url).length,
        organizations: orgs.map((o) => ({ name: o.name, domain: o.primary_domain ?? null, website: o.website_url ?? null, employees: o.estimated_num_employees ?? null, industry: o.industry ?? null, city: o.city ?? null, state: o.state ?? null, country: o.country ?? null })),
      }
      call.note = `${orgs.length} orgs`
    }
    if (url.hostname === "app.fullenrich.com" && method === "GET" && res.ok && url.pathname.includes("/contact/enrich/bulk/")) {
      const body = await res.clone().json()
      call.note = `${body.status} cost=${body.cost?.credits ?? "?"}`
    }
  } catch {
    // trace only
  }
  return res
}) as typeof fetch

const OUT_DIR = process.env.OUT_DIR || process.cwd()
const writeTrace = (name: string) => {
  const file = path.join(OUT_DIR, name)
  fs.writeFileSync(file, JSON.stringify(trace, null, 2))
  console.log(`[harness] trace written to ${file}`)
}

// Run configuration (config.ts reads these on every call).
process.env.GTM_DISCOVERY_MODE = "database"
process.env.GTM_PEOPLE_PROVIDER = "web"
delete process.env.GTM_PROVIDER_MODE
process.env.PIPELINE_EXECUTOR = "direct"
process.env.GTM_TARGET_VERIFIED_LEADS = "3"
process.env.GTM_MAX_CANDIDATES_PER_COMPANY = "3"
process.env.GTM_MAX_COMPANIES_EXAMINED = "15"
process.env.GTM_MAX_COMPANIES_PER_RUN = "15"
process.env.GTM_EMAIL_LOOKUPS_PER_CAMPAIGN = String(FE_TEST_BUDGET)

const SOURCE_SEGMENT_ID = process.env.SOURCE_SEGMENT_ID || "NdrPf26WeQtp68eu54Xj-" // Digital Marketing Agencies
const TARGET_COUNTRY = "US"
const FOUNDER_EMAIL = "ayushdeshmukh301@gmail.com"
const mask = (e: string | null) => (e ? e.replace(/^(.).*(@.*)$/, "$1***$2") : null)

async function main() {
  const { db } = await import("../src/utils/db")
  const schema = await import("../src/db/schema")
  const { getMonthlyVendorCredits } = await import("../src/lib/providers/vendor-usage")
  const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[]

  // Ledger caps: this test may add at most FE_TEST_BUDGET FullEnrich and 2 Apollo credits this month.
  const feUsed = await getMonthlyVendorCredits("fullenrich")
  const apolloUsed = await getMonthlyVendorCredits("apollo")
  process.env.FULLENRICH_MONTHLY_CREDIT_CAP = String(feUsed + FE_TEST_BUDGET)
  process.env.APOLLO_MONTHLY_CREDIT_CAP = process.env.APOLLO_CAP_TOTAL ?? String(apolloUsed + APOLLO_TEST_BUDGET)

  const config = await import("../src/lib/providers/config")
  const { getPipelineExecutor } = await import("../src/lib/pipeline/executor")
  const { leadSearchBudget } = await import("../src/lib/pipeline/lead-search-budget")

  async function balance(label: string) {
    const res = await realFetch("https://app.fullenrich.com/api/v2/account/credits", { headers: { Authorization: `Bearer ${process.env.FULLENRICH_API_KEY}` } })
    event(`FullEnrich balance ${label}: HTTP ${res.status} ${await res.text()}`)
  }

  function printConfig() {
    const b = leadSearchBudget(3)
    console.table({
      GTM_DISCOVERY_MODE: config.getDiscoveryMode(),
      GTM_PROVIDER_MODE: config.getProviderMode(),
      GTM_PEOPLE_PROVIDER: config.getPeopleProviderKey(),
      GTM_TARGET_VERIFIED_LEADS: config.getTargetVerifiedLeads(3),
      GTM_MAX_CANDIDATES_PER_COMPANY: config.getMaxCandidatesPerCompany(),
      GTM_MAX_COMPANIES_EXAMINED: config.getMaxCompaniesExamined(),
      GTM_MAX_COMPANIES_PER_RUN: config.getMaxCompaniesPerRun(),
      GTM_EMAIL_LOOKUPS_PER_CAMPAIGN: config.getEmailLookupsPerCampaign(),
      GTM_LEAD_SEARCH_MAX_MINUTES: config.getLeadSearchMaxMs() / 60000,
      GTM_LEAD_SEARCH_CONCURRENCY: config.getLeadSearchConcurrency(),
      GTM_EMAIL_LOOKUP_MAX_WAIT_SECONDS: config.getEmailLookupMaxWaitMs() / 1000,
      GTM_EMAIL_POLL_INTERVAL_MS: b.pollIntervalMs,
      FULLENRICH_MONTHLY_CREDIT_CAP: `${config.getFullEnrichMonthlyCreditCap()} (month used ${feUsed} + ${FE_TEST_BUDGET})`,
      APOLLO_MONTHLY_CREDIT_CAP: `${config.getApolloMonthlyCreditCap()} (month used ${apolloUsed})`,
      FIRECRAWL_CAMPAIGN_RUN_CAP: process.env.FIRECRAWL_CAMPAIGN_RUN_CAP ?? "35 (default)",
      FIRECRAWL_CAMPAIGN_LIFETIME_CAP: process.env.FIRECRAWL_CAMPAIGN_LIFETIME_CAP ?? "120 (default)",
      FIRECRAWL_REQUESTS_PER_MINUTE: process.env.FIRECRAWL_REQUESTS_PER_MINUTE ?? "8 (default)",
      FIRECRAWL_MAX_CONCURRENCY: process.env.FIRECRAWL_MAX_CONCURRENCY ?? "2 (default)",
      FIRECRAWL_ORG_DAILY_CAP: process.env.FIRECRAWL_ORG_DAILY_CAP ?? "400 (default)",
      PIPELINE_EXECUTOR: getPipelineExecutor(),
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ? "<set, redacted>" : "MISSING",
      APOLLO_API_KEY: process.env.APOLLO_API_KEY ? "<set, redacted>" : "MISSING",
      FULLENRICH_API_KEY: process.env.FULLENRICH_API_KEY ? "<set, redacted>" : "MISSING",
      GROQ_API_KEY: process.env.GROQ_API_KEY ? "<set, redacted>" : "MISSING",
    })
  }

  const [command, arg] = process.argv.slice(2)

  if (command === "preflight") {
    printConfig()
    const { getLeadSearchPeopleProvider } = await import("../src/lib/providers/registry")
    try {
      const p = getLeadSearchPeopleProvider()
      console.log(`database-mode live people provider: ${p.key}`)
    } catch (err) {
      console.log(`database-mode live people provider: REFUSED -> ${(err as Error).name}: ${(err as Error).message} (failureReason=${(err as any).failureReason})`)
    }
    await balance("now")
    return
  }

  if (command === "run") return run()
  if (command === "stage4") return stage4()
  if (command === "restart" && arg) return restart(arg)
  if (command === "cleanup" && arg) return cleanup(arg)
  throw new Error("usage: preflight | stage4 | run | restart <campaignId> | cleanup <orgId>")

  // -------------------------------------------------------------------------
  async function report(campaignId: string) {
    const { leadSearchMessage } = await import("../src/lib/lead-search-message")
    const [c] = await db.select().from(schema.gtmOutreachCampaign).where(eq(schema.gtmOutreachCampaign.id, campaignId))
    console.log(`\nCampaign ${campaignId}: stage=${c.currentStage} status=${c.status} failure=${c.failureReason ?? "-"}`)
    console.log(`Stage timings: ${JSON.stringify(c.stageTimings, null, 1)}`)
    if (c.leadSearchOutcome) console.log(`Outcome: ${JSON.stringify(c.leadSearchOutcome)}\nUI message: "${leadSearchMessage(c.leadSearchOutcome)}"`)
    console.log("Companies:")
    console.table(await rows(sql`select name, domain, headcount, fit_score score, selection_status sel, decision_maker_status dm, left(fit_note, 90) fit from gtm_prospect_company where outreach_campaign_id = ${campaignId} order by fit_score desc nulls last, created_at`))
    const people = await rows(sql`select pc.domain, ct.name, ct.title, ct.source, (ct.linkedin_url is not null) li, ct.email, ct.verification_status vs, ct.email_status, ct.lookup_status, ct.skip_reason,
        ct.enrich_metadata->>'vendorStatus' vendor_status, ct.enrich_metadata->>'creditsUsed' credits, ct.enrich_metadata->>'note' note, (ct.email_lookup_ref is not null) has_ref, ct.created_at
      from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${campaignId} order by ct.created_at`)
    console.log("People tried:")
    console.table(people.map((p) => ({ ...p, email: mask(p.email) })))
    console.log("Vendor ledger rows for this campaign (non-Firecrawl):")
    console.table(await rows(sql`select id, vendor, endpoint, credits_used, created_at from gtm_vendor_usage where campaign_id = ${campaignId} and vendor <> 'firecrawl' order by created_at`))
    console.log(`Firecrawl ledger rows this campaign: ${(await rows(sql`select count(*)::int n, coalesce(sum(credits_used),0)::int c from gtm_vendor_usage where campaign_id = ${campaignId} and vendor = 'firecrawl'`))[0].n}`)
    console.log(`Campaign firecrawl counters: attempt=${c.firecrawlAttemptCallCount} lifetime=${c.firecrawlCallCount}`)
    console.log("Drafts:")
    console.table(await rows(sql`select d.status, ct.name, left(d.subject, 60) subject, left(d.body, 70) body from gtm_email_draft d join gtm_contact ct on ct.id = d.contact_id where d.outreach_campaign_id = ${campaignId}`))
    console.log(`Month ledger: ${JSON.stringify(await rows(sql`select vendor, coalesce(sum(credits_used),0)::int credits, count(*)::int rows from gtm_vendor_usage where created_at >= date_trunc('month', now()) and vendor <> 'firecrawl' group by vendor`))}`)
    return { campaign: c, people }
  }

  async function snapshot(campaignId: string) {
    const [s] = await rows(sql`select
      (select count(*)::int from gtm_vendor_usage where campaign_id = ${campaignId} and vendor = 'fullenrich') fe_rows,
      (select coalesce(sum(credits_used),0)::int from gtm_vendor_usage where campaign_id = ${campaignId} and vendor = 'fullenrich') fe_credits,
      (select count(*)::int from gtm_vendor_usage where campaign_id = ${campaignId} and vendor = 'apollo') apollo_rows,
      (select count(*)::int from gtm_vendor_usage where campaign_id = ${campaignId} and vendor = 'firecrawl') firecrawl_rows,
      (select count(*)::int from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${campaignId}) contacts,
      (select count(*)::int from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${campaignId} and ct.email_lookup_ref is not null) looked_up,
      (select count(distinct ct.email_lookup_ref)::int from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${campaignId}) distinct_refs,
      (select string_agg(ct.id || ':' || coalesce(ct.email,'-'), ',' order by ct.id) from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${campaignId} and ct.verification_status = 'mailbox_verified') verified_leads,
      (select count(*)::int from gtm_email_draft where outreach_campaign_id = ${campaignId}) drafts`)
    return s
  }

  /** Throwaway org (plan + admin credit grant), a copy of the segment, one campaign at Stage 4. */
  async function setupCampaign() {
    const { grantManualCredits, setOrganizationPlan } = await import("../src/lib/pilot/admin-actions")
    const tag = crypto.randomBytes(3).toString("hex")
    const id = (k: string) => `dbtest-${tag}-${k}`
    const [admin] = await rows(sql`select id, email from "user" where lower(email) = ${FOUNDER_EMAIL}`)
    const [src] = await rows(sql`select r.company_name, r.company_description, r.website_url, r.company_size,
        s.name, s.pain_point, s.criteria, s.example_companies, s.target_keywords, s.headcount_min, s.headcount_max, s.estimated_size_label
      from gtm_icp_segment s join gtm_research_run r on r.id = s.research_run_id where s.id = ${SOURCE_SEGMENT_ID}`)
    event(`segment copied from ${SOURCE_SEGMENT_ID}: "${src.name}" kw=${JSON.stringify(src.target_keywords)} headcount=${src.headcount_min}-${src.headcount_max}; seller ${src.company_name}; market ${TARGET_COUNTRY}`)

    await db.execute(sql`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("u")}, 'DB-mode live test', ${`${id("u")}@scrunity-test.invalid`}, true, now(), now())`)
    await db.execute(sql`insert into organization (id, name, slug, created_at, updated_at) values (${id("org")}, 'DB-mode live test', ${id("slug")}, now(), now())`)
    await db.execute(sql`insert into member (id, organization_id, user_id, role, created_at) values (${id("m")}, ${id("org")}, ${id("u")}, 'owner', now())`)
    const plan = await setOrganizationPlan(id("org"), "pilot")
    const grant = await grantManualCredits({ organizationId: id("org"), amount: 100, reason: "database-mode live test", adminUserId: admin.id, adminEmail: admin.email, requestId: `dbtest-${tag}-grant` })
    event(`org ${id("org")}: plan ${JSON.stringify(plan)}; grant ${grant.status}, credits remaining ${"creditsRemaining" in grant ? grant.creditsRemaining : "?"}`)

    await db.execute(sql`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage, target_country_code, target_region)
      values (${id("run")}, ${id("org")}, ${id("u")}, ${src.website_url}, ${src.company_name}, ${src.company_description}, ${src.company_size}, 'done', 'done', ${TARGET_COUNTRY}, null)`)
    await db.execute(sql`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords, headcount_min, headcount_max, estimated_size_label)
      values (${id("seg")}, ${id("run")}, ${src.name}, ${src.pain_point}, ${JSON.stringify(src.criteria)}::jsonb, ${JSON.stringify(src.example_companies)}::jsonb, ${JSON.stringify(src.target_keywords)}::jsonb, ${src.headcount_min}, ${src.headcount_max}, ${src.estimated_size_label})`)
    // Same row POST /api/gtm/campaigns writes, plus the per-campaign target.
    await db.execute(sql`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage, stage_started_at, target_verified_leads, target_country_code, target_region)
      values (${id("camp")}, ${id("seg")}, ${id("run")}, 'in_progress', 'find_companies', now(), 3, ${TARGET_COUNTRY}, null)`)
    const mailboxes = await rows(sql`select count(*)::int n from gtm_connected_mailbox where organization_id = ${id("org")}`)
    event(`campaign ${id("camp")} created; connected mailboxes for org: ${mailboxes[0].n}`)
    return { tag, id }
  }

  /** Stage 4 only: filters, one Apollo search, fit scores. Then removes the test org (ledger kept). */
  async function stage4() {
    if (!process.env.APOLLO_API_KEY) throw new Error("APOLLO_API_KEY missing")
    printConfig()
    const { runCampaignPipeline } = await import("../src/lib/pipeline/runner")
    const { describeCompanySearch } = await import("../src/lib/company-search-text")
    const { tag, id } = await setupCampaign()
    const t0 = Date.now()
    await runCampaignPipeline(id("camp"))
    const [c] = await db.select().from(schema.gtmOutreachCampaign).where(eq(schema.gtmOutreachCampaign.id, id("camp")))
    event(`Stage 4 finished in ${Math.round((Date.now() - t0) / 1000)}s: ${c.currentStage}/${c.status} ${c.failureReason ?? ""}`)
    if (c.searchFilters) {
      console.log(`
Gate line: "${describeCompanySearch(c.searchFilters)}"`)
      console.log(`Filters: ${JSON.stringify(c.searchFilters)}`)
    }
    console.log(`Discovery note: "${c.discoveryNote}"`)
    console.log(`Apollo returned: ${JSON.stringify({ ...(trace.apollo as object), organizations: undefined })}`)
    const companies = await rows(sql`select name, domain, industry, headcount, fit_score score, selection_status sel, fit_note reason
      from gtm_prospect_company where outreach_campaign_id = ${id("camp")} order by fit_score desc nulls last, created_at`)
    console.table(companies)
    console.log(`Apollo ledger rows this campaign: ${JSON.stringify(await rows(sql`select endpoint, credits_used from gtm_vendor_usage where campaign_id = ${id("camp")}`))}`)
    console.log(`Fetch counters: ${JSON.stringify(counters)}; Groq: ${JSON.stringify(trace.groq)}`)
    writeTrace(`dbtest-${tag}-stage4-trace.json`)
    await cleanup(id("org"))
  }

  async function run() {
    if (!process.env.FULLENRICH_API_KEY || !process.env.APOLLO_API_KEY) throw new Error("vendor keys missing")
    printConfig()
    const { runCampaignPipeline, runCampaignStage } = await import("../src/lib/pipeline/runner")
    const { confirmCompanySelection } = await import("../src/lib/pipeline/company-selection")
    const { dispatchCampaign } = await import("../src/lib/pipeline/dispatch")
    const { campaignIsIdle } = await import("../src/lib/pipeline/stage-state")
    const { and } = await import("drizzle-orm")

    const { tag, id } = await setupCampaign()

    await balance("before")
    const t0 = Date.now()

    // Stage 4: Apollo search + fit lines, parks at the selection gate.
    await runCampaignPipeline(id("camp"))
    const t4 = Date.now()
    const companies = await rows(sql`select id, name, domain, headcount, fit_note from gtm_prospect_company where outreach_campaign_id = ${id("camp")} order by created_at`)
    const [gate] = await rows(sql`select current_stage, status, discovery_note from gtm_outreach_campaign where id = ${id("camp")}`)
    event(`Stage 4 done in ${Math.round((t4 - t0) / 1000)}s: ${JSON.stringify(gate)}; stored ${companies.length} companies`)
    if (gate.current_stage !== "awaiting_company_selection") {
      await report(id("camp"))
      writeTrace(`dbtest-${tag}-trace.json`)
      return
    }

    // Selection gate: keep exactly what Stage 4 pre-selected (fit score >= threshold).
    const selected = (await rows(sql`select id from gtm_prospect_company where outreach_campaign_id = ${id("camp")} and selection_status = 'selected'`)).map((c) => c.id)
    const confirmed = await confirmCompanySelection(id("camp"), selected)
    event(`selection confirmed (${confirmed}): ${selected.length} companies selected`)

    // Stage 5 + 6 through the runner, with a double trigger and a refused restart while it is live.
    const pipeline = runCampaignPipeline(id("camp"))
    await new Promise((r) => setTimeout(r, 45_000))
    const second = await runCampaignStage(id("camp"), "find_contacts")
    event(`double trigger while Stage 5 is live: runCampaignStage -> ${second}`)
    const dispatched = await dispatchCampaign(id("camp"))
    event(`double trigger while Stage 5 is live: dispatchCampaign -> ${dispatched} (in-process guard)`)
    const reset = await db.update(schema.gtmOutreachCampaign)
      .set({ currentStage: "find_contacts", status: "in_progress", failureReason: null, stageStartedAt: new Date(), lastProgressAt: null })
      .where(and(eq(schema.gtmOutreachCampaign.id, id("camp")), eq(schema.gtmOutreachCampaign.currentStage, "find_contacts"), campaignIsIdle()))
      .returning({ id: schema.gtmOutreachCampaign.id })
    event(`Restart Stage while Stage 5 is live (route's conditional reset): ${reset.length ? "APPLIED (unexpected)" : "refused (409 stillRunning)"}`)
    await pipeline
    const t6 = Date.now()
    event(`pipeline stopped after ${Math.round((t6 - t0) / 1000)}s total`)
    await balance("after")

    await report(id("camp"))
    console.log("Snapshot:", JSON.stringify(await snapshot(id("camp"))))
    console.log(`Fetch counters: ${JSON.stringify(counters)}; Groq: ${JSON.stringify(trace.groq)}`)
    writeTrace(`dbtest-${tag}-trace.json`)
    console.log(`\nORG=${id("org")} CAMPAIGN=${id("camp")}`)
  }

  /** Step 4: restart the lead search on the finished campaign; must charge nothing. */
  async function restart(campaignId: string) {
    const { runCampaignPipeline, runCampaignStage } = await import("../src/lib/pipeline/runner")
    const { campaignIsIdle } = await import("../src/lib/pipeline/stage-state")
    const { and } = await import("drizzle-orm")
    // No new companies may be examined: the restart only resumes/settles what exists.
    const [{ n: settled }] = await rows(sql`select count(*)::int n from gtm_prospect_company where outreach_campaign_id = ${campaignId} and decision_maker_status is not null`)
    process.env.GTM_MAX_COMPANIES_EXAMINED = String(Math.max(1, settled))
    printConfig()

    const before = await snapshot(campaignId)
    console.log("BEFORE:", JSON.stringify(before))
    const [row] = await rows(sql`select current_stage, status from gtm_outreach_campaign where id = ${campaignId}`)
    event(`campaign at ${row.current_stage}/${row.status}; Restart Stage there answers with a message and resets nothing`)

    // Restart Stage on find_contacts: exactly the route's resetStage write (row put back at that stage first).
    await db.update(schema.gtmOutreachCampaign).set({ currentStage: "find_contacts", status: "failed", failureReason: "dbtest: simulated failure for restart" }).where(eq(schema.gtmOutreachCampaign.id, campaignId))
    const reset = await db.update(schema.gtmOutreachCampaign)
      .set({ currentStage: "find_contacts", status: "in_progress", failureReason: null, stageStartedAt: new Date(), lastProgressAt: null })
      .where(and(eq(schema.gtmOutreachCampaign.id, campaignId), eq(schema.gtmOutreachCampaign.currentStage, "find_contacts"), campaignIsIdle()))
      .returning({ id: schema.gtmOutreachCampaign.id })
    event(`Restart Stage (find_contacts, idle): ${reset.length ? "reset applied" : "refused"}`)

    // Double start: two executors race for the same stage.
    const [a, b] = await Promise.all([runCampaignStage(campaignId, "find_contacts"), runCampaignStage(campaignId, "find_contacts")])
    event(`double start of find_contacts: ${a} / ${b}`)
    await runCampaignPipeline(campaignId) // write_emails again -> awaiting_approval

    const after = await snapshot(campaignId)
    console.log("AFTER: ", JSON.stringify(after))
    const changed = Object.keys(before).filter((k) => k !== "firecrawl_rows" && (before as any)[k] !== (after as any)[k])
    event(`changed fields (excluding Firecrawl): ${changed.length ? changed.join(", ") : "none"}; Firecrawl rows ${before.firecrawl_rows} -> ${after.firecrawl_rows}`)
    console.log(`Fetch counters: ${JSON.stringify(counters)}; Groq: ${JSON.stringify(trace.groq)}`)
    await report(campaignId)
    writeTrace(`dbtest-restart-${campaignId}-trace.json`)
  }

  async function cleanup(orgId: string) {
    const count = async () => (await rows(sql`select
      (select count(*)::int from organization where id = ${orgId}) orgs,
      (select count(*)::int from member where organization_id = ${orgId}) members,
      (select count(*)::int from gtm_research_run where organization_id = ${orgId}) runs,
      (select count(*)::int from gtm_icp_segment s join gtm_research_run r on r.id = s.research_run_id where r.organization_id = ${orgId}) segments,
      (select count(*)::int from gtm_outreach_campaign c join gtm_research_run r on r.id = c.research_run_id where r.organization_id = ${orgId}) campaigns,
      (select count(*)::int from gtm_prospect_company p join gtm_outreach_campaign c on c.id = p.outreach_campaign_id join gtm_research_run r on r.id = c.research_run_id where r.organization_id = ${orgId}) companies,
      (select count(*)::int from gtm_contact ct join gtm_prospect_company p on p.id = ct.prospect_company_id join gtm_outreach_campaign c on c.id = p.outreach_campaign_id join gtm_research_run r on r.id = c.research_run_id where r.organization_id = ${orgId}) contacts,
      (select count(*)::int from gtm_email_draft d join gtm_outreach_campaign c on c.id = d.outreach_campaign_id join gtm_research_run r on r.id = c.research_run_id where r.organization_id = ${orgId}) drafts,
      (select count(*)::int from gtm_ai_credit_transaction where organization_id = ${orgId}) credit_tx,
      (select count(*)::int from gtm_vendor_usage where campaign_id like ${orgId.replace(/-org$/, "-%")}) ledger_rows_by_campaign,
      (select coalesce(sum(credits_used),0)::int from gtm_vendor_usage where campaign_id like ${orgId.replace(/-org$/, "-%")} and vendor = 'fullenrich') ledger_fullenrich_credits,
      (select coalesce(sum(credits_used),0)::int from gtm_vendor_usage where campaign_id like ${orgId.replace(/-org$/, "-%")} and vendor = 'apollo') ledger_apollo_credits`))[0]
    console.log("BEFORE:", JSON.stringify(await count()))
    await db.execute(sql`delete from organization where id = ${orgId}`)
    await db.execute(sql`delete from "user" where id = ${orgId.replace(/-org$/, "-u")}`)
    console.log("AFTER: ", JSON.stringify(await count()))
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    writeTrace(`dbtest-error-trace.json`)
    process.exit(1)
  })
