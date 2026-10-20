/**
 * Database mode's people provider, the provider check before any spend, and
 * the company-name-as-person filter. Real database; the network is stubbed:
 * Firecrawl answers from a local stub through the real limiter (default 8
 * requests/min, so step durations are realistic), Apollo and FullEnrich run in
 * fixture mode (recorded responses), and any other vendor host is refused.
 *
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-people-provider.ts
 *
 * 1. registry: which people provider each mode selects, and what is refused
 * 2. a missing provider is refused at Stage 4 before any vendor or LLM call (ledger unchanged)
 * 3. database mode, GTM_PEOPLE_PROVIDER=web: Stage 5 runs on the web provider;
 *    "Carter Murray" at cartermurray.com (the firm's own name) is never stored
 *    or looked up; prints each search step's duration under the real limiter
 * Creates one throwaway org and deletes it (and its ledger rows) after.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { sql } from "drizzle-orm"

process.env.GTM_DISCOVERY_MODE = "database"
process.env.FIRECRAWL_API_KEY = "stub-key-not-real"
delete process.env.FIRECRAWL_REQUESTS_PER_MINUTE // the real default pace (8/min)
delete process.env.FIRECRAWL_CAMPAIGN_RUN_CAP
delete process.env.RESEND_API_KEY

const tag = crypto.randomBytes(3).toString("hex")
const id = (k: string) => `pp-${tag}-${k}`
let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures++
}

// Network stub: Firecrawl answers locally; every other vendor host is counted and refused.
const realFetch = globalThis.fetch
const vendorCalls: string[] = []
let firecrawlRequests = 0
const PEOPLE: Record<string, Array<[string, string]>> = {
  // LinkedIn snippets per company name (the query quotes the company name).
  Atlassian: [["Noah Sampleberg", "Chief Executive Officer"]],
  "Carter Murray": [["Carter Murray", "Founder"], ["Jane Wake", "Founder"]],
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  if (url.host.endsWith("neon.tech")) return realFetch(input, init)
  if (url.host === "api.firecrawl.dev") {
    firecrawlRequests++
    await new Promise((r) => setTimeout(r, 300))
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string }
    const company = /"([^"]+)"/.exec(body.query ?? "")?.[1] ?? ""
    const data = (body.query ?? "").includes("linkedin.com/in")
      ? (PEOPLE[company] ?? []).map(([name, title]) => ({
          title: `${name} - ${title} - ${company} | LinkedIn`, description: title,
          url: `https://www.linkedin.com/in/${name.toLowerCase().replace(/\s+/g, "-")}`,
        }))
      : []
    return Response.json({ success: true, data })
  }
  vendorCalls.push(url.host)
  if (/apollo|fullenrich|firecrawl|enrich\.so/.test(url.host)) throw new Error(`[stub] refused vendor call to ${url.host}`)
  return realFetch(input, init) // the LLM (filter/fit generation is not reached in these scenarios)
}) as typeof fetch

async function main() {
  const { db } = await import("../src/utils/db")
  const registry = await import("../src/lib/providers/registry")
  const { getPeopleProviderKey } = await import("../src/lib/providers/config")
  const { checkCampaignProviders } = await import("../src/lib/pipeline/provider-check")
  const { runCampaignStage } = await import("../src/lib/pipeline/runner")
  const q = (s: TemplateStringsArray, ...v: unknown[]) => db.execute(sql(s, ...v))
  const rows = async (s: TemplateStringsArray, ...v: unknown[]) => (await q(s, ...v)).rows as any[]
  const providerOrError = () => {
    try {
      return registry.getLeadSearchPeopleProvider().key
    } catch (err) {
      return `refused: ${(err as { failureReason?: string }).failureReason}`
    }
  }

  console.log("1. Registry")
  delete process.env.GTM_PEOPLE_PROVIDER
  delete process.env.GTM_PROVIDER_MODE
  check("live database mode defaults to the web provider", getPeopleProviderKey() === "web" && providerOrError() === "web", providerOrError())
  process.env.GTM_PROVIDER_MODE = "fixture"
  check("fixture mode defaults to the fixture provider", providerOrError() === "fixture", providerOrError())
  delete process.env.GTM_PROVIDER_MODE
  process.env.GTM_PEOPLE_PROVIDER = "fixture"
  check("the synthetic provider is refused in live mode", providerOrError() === "refused: people_provider_unavailable", providerOrError())
  process.env.GTM_PEOPLE_PROVIDER = "web"
  const savedKey = process.env.FIRECRAWL_API_KEY
  delete process.env.FIRECRAWL_API_KEY
  check("the web provider is refused without its API key", providerOrError() === "refused: people_provider_unavailable", providerOrError())
  // Platform providers are checked only for an allowlisted internal organization.
  const platformOrg = `pp-platform-${Date.now()}`
  const savedAllowlist = process.env.PLATFORM_DATA_ORG_IDS
  process.env.PLATFORM_DATA_ORG_IDS = platformOrg
  const missing = await checkCampaignProviders(platformOrg)
  if (savedAllowlist === undefined) delete process.env.PLATFORM_DATA_ORG_IDS
  else process.env.PLATFORM_DATA_ORG_IDS = savedAllowlist
  check("the campaign check says so in plain words, without a vendor name", !missing.ok && /decision-maker search/.test(missing.message) && !/firecrawl|apollo/i.test(missing.message), missing.ok ? "ok" : missing.message)
  process.env.FIRECRAWL_API_KEY = savedKey

  await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("u")}, 'PP', ${`pp-${tag}@scrunity-test.invalid`}, true, now(), now())`
  await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org")}, 'PP Test', ${id("slug")}, 'pilot', now(), now())`
  await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage, target_country_code)
          values (${id("run")}, ${id("org")}, ${id("u")}, 'https://pp.example', 'PP Outbound', 'Outbound automation', '11-50', 'done', 'done', 'AU')`
  await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords)
          values (${id("seg")}, ${id("run")}, 'Australian software companies', 'Manual prospecting', '["Australia"]', '[]', '["software"]')`
  try {
    console.log("\n2. A missing provider is refused at Stage 4, before any spend")
    process.env.GTM_PEOPLE_PROVIDER = "fixture" // refused in live mode
    await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage, target_country_code)
            values (${id("refused")}, ${id("seg")}, ${id("run")}, 'in_progress', 'find_companies', 'AU')`
    const before = vendorCalls.length
    const outcome = await runCampaignStage(id("refused"), "find_companies")
    const [c] = await rows`select status, failure_reason, search_filters from gtm_outreach_campaign where id = ${id("refused")}`
    const ledger = await rows`select count(*)::int n from gtm_vendor_usage where campaign_id = ${id("refused")}`
    check("Stage 4 failed with people_provider_unavailable", outcome === "failed" && c.failure_reason === "people_provider_unavailable", `${outcome}, ${c.failure_reason}`)
    check("zero vendor or LLM calls, zero ledger rows, no filters generated", vendorCalls.length === before && ledger[0].n === 0 && c.search_filters === null,
      `${vendorCalls.length - before} calls, ${ledger[0].n} ledger rows`)

    console.log("\n3. Database mode with GTM_PEOPLE_PROVIDER=web (Apollo/FullEnrich fixtures, Firecrawl stubbed, limiter 8/min)")
    process.env.GTM_PROVIDER_MODE = "fixture"
    process.env.GTM_PEOPLE_PROVIDER = "web"
    process.env.GTM_EMAIL_POLL_INTERVAL_MS = "1000"
    // Titles are set so the step needs no LLM call; fit order: Atlassian, Carter Murray, then 6 with nobody to find.
    await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage, target_country_code, target_verified_leads, lead_search_state)
            values (${id("web")}, ${id("seg")}, ${id("run")}, 'in_progress', 'find_contacts', 'AU', 3,
                    ${JSON.stringify({ attemptId: null, titles: ["Chief Executive Officer", "Founder"] })}::jsonb)`
    const companies: Array<[string, string]> = [["Atlassian", "atlassian.com"], ["Carter Murray", "cartermurray.com"],
      ...[1, 2, 3, 4, 5, 6].map((n) => [`Quiet Co ${n}`, `quiet${n}.example`] as [string, string])]
    for (const [i, [name, domain]] of companies.entries()) {
      await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location, source, fit_score)
              values (${id(`web-co${i}`)}, ${id("web")}, ${name}, ${domain}, 'fixture', 'Australia', 'fixture', ${90 - i})`
    }
    const stepLines: string[] = []
    const log = console.log
    console.log = (...args: unknown[]) => {
      const line = args.map(String).join(" ")
      if (/step \d+: /.test(line)) stepLines.push(line)
      log(...args)
    }
    const t0 = Date.now()
    const stage = await runCampaignStage(id("web"), "find_contacts")
    console.log = log
    const people = await rows`select pc.domain, ct.name, ct.source, ct.skip_reason, ct.email_status, (ct.email_lookup_ref is not null) looked_up
      from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${id("web")} order by ct.created_at`
    console.table(people)
    const statuses = await rows`select domain, decision_maker_status from gtm_prospect_company where outreach_campaign_id = ${id("web")} order by fit_score desc`
    console.table(statuses)
    check("Stage 5 completed on the web provider", stage === "completed" && people.length > 0 && people.every((p) => p.source === "web"), `${stage}, sources ${[...new Set(people.map((p) => p.source))].join(",")}`)
    check("Firecrawl was called (through the stub)", firecrawlRequests > 0, `${firecrawlRequests} requests`)
    check("'Carter Murray' (the company's own name) was never stored or looked up", !people.some((p) => p.name === "Carter Murray"))
    check("the real person at that company was (Jane Wake)", people.some((p) => p.name === "Jane Wake" && p.looked_up))
    check("Noah Sampleberg at Atlassian verified (fixture DELIVERABLE)", people.some((p) => p.name === "Noah Sampleberg" && p.email_status === "verified"))
    const durations = stepLines.map((l) => Number(/in (\d+) ms/.exec(l)?.[1] ?? 0))
    console.log(`  search steps: ${durations.length}, durations ms: ${durations.join(", ")}; longest ${Math.max(...durations)} ms; stage total ${Math.round((Date.now() - t0) / 1000)} s`)
    check("every step stayed under 60 s with the real 8/min limiter", Math.max(...durations) < 60_000, `${Math.max(...durations)} ms`)
    check("no Apollo/FullEnrich network call (fixtures)", !vendorCalls.some((h) => /apollo|fullenrich/.test(h)), vendorCalls.join(","))
  } finally {
    await q`delete from gtm_vendor_usage where campaign_id like ${`pp-${tag}-%`}`
    await q`delete from organization where id = ${id("org")}`
    await q`delete from "user" where id = ${id("u")}`
    console.log(`\nCleanup: ${JSON.stringify((await rows`select (select count(*)::int from gtm_outreach_campaign where id like ${`pp-${tag}-%`}) campaigns`)[0])}`)
  }
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
