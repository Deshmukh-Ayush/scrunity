/**
 * Verifies database-mode Stage 4 (Apollo company discovery) against the real DB.
 *
 *   npx tsx scripts/test-apollo-discovery.ts fixture      # 0 credits: India/Delhi from fixtures
 *   npx tsx scripts/test-apollo-discovery.ts caps         # 0 credits: company cap + credit cap
 *   npx tsx scripts/test-apollo-discovery.ts live         # 2 credits: Delhi, India + Australia
 *   npx tsx scripts/test-apollo-discovery.ts seed-probe   # records the Step 0 probe spend once
 *
 * Every fetch is counted by host, so "zero Firecrawl calls" and "no Apollo call
 * when over the cap" are measured, not assumed. Inserted runs are deleted at the
 * end unless --keep is passed (the vendor ledger rows are kept: they are real spend).
 */
import "dotenv/config"
import { writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { db } from "../src/utils/db"
import {
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  gtmVendorUsage,
  organization,
  user,
} from "../src/db/schema"
import { runCampaignStage } from "../src/lib/pipeline/runner"
import { getCompanyDiscoveryProvider } from "../src/lib/providers/registry"
import { getMaxCompaniesPerRun } from "../src/lib/providers/config"
import { getMonthlyVendorCredits } from "../src/lib/providers/vendor-usage"
import { VendorCreditCapError } from "../src/lib/providers/types"

// --- fetch accounting -------------------------------------------------------
const callsByHost = new Map<string, number>()
const apolloBodies: string[] = []
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  callsByHost.set(url.host, (callsByHost.get(url.host) ?? 0) + 1)
  const res = await realFetch(input, init)
  if (url.host === "api.apollo.io") apolloBodies.push(await res.clone().text())
  return res
}) as typeof fetch

const resetCalls = () => {
  callsByHost.clear()
  apolloBodies.length = 0
}
const callsTo = (fragment: string) =>
  [...callsByHost].filter(([h]) => h.includes(fragment)).reduce((n, [, c]) => n + c, 0)

// --- fixtures for runs ------------------------------------------------------
const createdRunIds: string[] = []

async function testOrgAndUser() {
  const [org] = await db.select().from(organization).limit(1)
  const [usr] = await db.select().from(user).limit(1)
  if (!org || !usr) throw new Error("Need at least one organization and user in the DB")
  return { orgId: org.id, userId: usr.id }
}

/** A research run + segment + campaign parked at find_companies, ready to claim. */
async function createCampaign({
  countryCode,
  region,
  keywords,
  headcount,
}: {
  countryCode: string
  region: string | null
  keywords: string[]
  headcount: [number, number] | null
}) {
  const { orgId, userId } = await testOrgAndUser()
  const [run] = await db
    .insert(gtmResearchRun)
    .values({
      organizationId: orgId,
      createdBy: userId,
      websiteUrl: "https://scrunity-stage4-test.example",
      companyName: "Stage4 Test Co",
      companyDescription: "Verification run for database-mode Stage 4",
      companySize: "11-50",
      targetCountryCode: countryCode,
      targetRegion: region,
      ownTamAmount: 50_000_000,
      ownTamCurrency: "USD",
      status: "done",
      currentStage: "done",
    })
    .returning()
  createdRunIds.push(run.id)

  const [segment] = await db
    .insert(gtmIcpSegment)
    .values({
      researchRunId: run.id,
      name: "Stage4 Test Segment",
      painPoint: "Test",
      criteria: ["test"],
      exampleCompanies: [],
      targetKeywords: keywords,
      headcountMin: headcount?.[0] ?? null,
      headcountMax: headcount?.[1] ?? null,
    })
    .returning()

  const [campaign] = await db
    .insert(gtmOutreachCampaign)
    .values({
      icpSegmentId: segment.id,
      researchRunId: run.id,
      targetCountryCode: run.targetCountryCode,
      targetRegion: run.targetRegion,
      status: "in_progress",
      currentStage: "find_companies",
    })
    .returning()
  return { run, campaign }
}

async function runStage4(campaignId: string) {
  resetCalls()
  const outcome = await runCampaignStage(campaignId, "find_companies")
  const [campaign] = await db
    .select()
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  const rows = await db
    .select({
      name: gtmProspectCompany.name,
      domain: gtmProspectCompany.domain,
      city: gtmProspectCompany.city,
      state: gtmProspectCompany.state,
      country: gtmProspectCompany.country,
      headcount: gtmProspectCompany.headcount,
      industry: gtmProspectCompany.industry,
      revenueRange: gtmProspectCompany.revenueRange,
      source: gtmProspectCompany.source,
    })
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
  console.log(`  outcome=${outcome} stage=${campaign.currentStage} status=${campaign.status} failureReason=${campaign.failureReason ?? "-"}`)
  console.log(`  discoveryNote: ${campaign.discoveryNote ?? "(none)"}`)
  console.log(`  network calls by host: ${JSON.stringify(Object.fromEntries(callsByHost))}`)
  console.log(`  firecrawl calls: ${callsTo("firecrawl")}  apollo calls: ${callsTo("apollo")}`)
  console.log(`  stored prospect rows: ${rows.length}`)
  console.table(rows)
  return { outcome, campaign, rows }
}

function check(label: string, ok: boolean) {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`)
  if (!ok) process.exitCode = 1
}

// --- scenarios --------------------------------------------------------------
async function fixtureScenario() {
  process.env.GTM_PROVIDER_MODE = "fixture"
  console.log("\n[fixture] India / Delhi, database mode, fixture provider")
  const { campaign } = await createCampaign({ countryCode: "IN", region: "Delhi", keywords: ["software"], headcount: [11, 200] })
  const { rows, outcome } = await runStage4(campaign.id)
  check("stage completed", outcome === "completed")
  check("zero Firecrawl calls", callsTo("firecrawl") === 0)
  check("zero Apollo network calls in fixture mode", callsTo("apollo") === 0)
  check("rows stored with provider fields", rows.length > 0 && rows.every((r) => r.source === "apollo" && r.country))
}

async function capsScenario() {
  process.env.GTM_PROVIDER_MODE = "fixture"
  console.log("\n[caps] GTM_MAX_COMPANIES_PER_RUN=3")
  process.env.GTM_MAX_COMPANIES_PER_RUN = "3"
  const { campaign } = await createCampaign({ countryCode: "IN", region: "Delhi", keywords: ["software"], headcount: null })
  const { rows } = await runStage4(campaign.id)
  check("at most 3 companies stored", rows.length <= 3)
  process.env.GTM_MAX_COMPANIES_PER_RUN = "100"
  check(`env 100 is clamped to the 25 ceiling (got ${getMaxCompaniesPerRun()})`, getMaxCompaniesPerRun() === 25)
  delete process.env.GTM_MAX_COMPANIES_PER_RUN

  console.log("\n[caps] APOLLO_MONTHLY_CREDIT_CAP at current spend, live mode")
  process.env.GTM_PROVIDER_MODE = "live"
  const used = await getMonthlyVendorCredits("apollo")
  process.env.APOLLO_MONTHLY_CREDIT_CAP = String(used)
  console.log(`  ledger credits this month: ${used}; cap set to ${used}`)

  resetCalls()
  let thrown: unknown = null
  try {
    await getCompanyDiscoveryProvider().searchCompanies(
      { country: "India", state: "Delhi", keywords: ["software"], limit: 5 },
      {}
    )
  } catch (err) {
    thrown = err
  }
  console.log(`  thrown: ${thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown)}`)
  check("typed VendorCreditCapError thrown", thrown instanceof VendorCreditCapError)
  check("zero Apollo network calls", callsTo("apollo") === 0)

  console.log("\n[caps] same cap through Stage 4, as the UI sees it")
  const { campaign: capped } = await createCampaign({ countryCode: "IN", region: "Delhi", keywords: ["software"], headcount: null })
  const result = await runStage4(capped.id)
  check("campaign failed with provider_credit_cap_reached", result.campaign.failureReason === "provider_credit_cap_reached")
  check("zero Apollo network calls", callsTo("apollo") === 0)
  delete process.env.APOLLO_MONTHLY_CREDIT_CAP
}

async function liveScenario() {
  process.env.GTM_PROVIDER_MODE = "live"
  process.env.GTM_MAX_COMPANIES_PER_RUN = "10"
  const before = await getMonthlyVendorCredits("apollo")
  console.log(`\n[live] ledger credits before: ${before}`)

  const cases = [
    { label: "Delhi, India", countryCode: "IN", region: "Delhi", fixture: null },
    { label: "Australia (no state)", countryCode: "AU", region: null, fixture: "apollo-org-search-australia.json" },
  ]
  for (const c of cases) {
    console.log(`\n[live] ${c.label}, limit 10, keyword "software"`)
    const { campaign } = await createCampaign({ countryCode: c.countryCode, region: c.region, keywords: ["software"], headcount: null })
    const { rows } = await runStage4(campaign.id)
    check("zero Firecrawl calls", callsTo("firecrawl") === 0)
    check("exactly one Apollo call", callsTo("apollo") === 1)
    check("at most 10 rows", rows.length <= 10)
    if (c.fixture && apolloBodies[0]) {
      const path = join(process.env.APOLLO_RAW_DIR ?? tmpdir(), `apollo-raw-${c.countryCode.toLowerCase()}.json`)
      writeFileSync(path, apolloBodies[0])
      console.log(`  raw response saved to ${path} (sanitize before committing as a fixture)`)
    }
  }
  const after = await getMonthlyVendorCredits("apollo")
  console.log(`\n[live] ledger credits after: ${after} (this scenario: ${after - before})`)
}

/** Records the two charged Step 0 probe calls so the cap counts them. Idempotent. */
async function seedProbeSpend() {
  const existing = await db
    .select()
    .from(gtmVendorUsage)
    .where(and(eq(gtmVendorUsage.vendor, "apollo"), eq(gtmVendorUsage.endpoint, "/api/v1/organizations/search (step-0 probe)")))
  if (existing.length > 0) {
    console.log(`probe spend already recorded (${existing.length} rows)`)
    return
  }
  for (let i = 0; i < 2; i++) {
    await db.insert(gtmVendorUsage).values({
      vendor: "apollo",
      endpoint: "/api/v1/organizations/search (step-0 probe)",
      creditsUsed: 1,
    })
  }
  console.log("recorded 2 probe credits")
}

async function cleanup() {
  if (process.argv.includes("--keep")) {
    console.log(`\nkept research runs: ${createdRunIds.join(", ")}`)
    return
  }
  for (const id of createdRunIds) {
    await db.delete(gtmResearchRun).where(eq(gtmResearchRun.id, id))
  }
  console.log(`\ncleaned up ${createdRunIds.length} test research run(s) (cascade)`)
}

async function main() {
  process.env.GTM_DISCOVERY_MODE = "database"
  const scenario = process.argv[2]
  try {
    if (scenario === "fixture") await fixtureScenario()
    else if (scenario === "caps") await capsScenario()
    else if (scenario === "live") await liveScenario()
    else if (scenario === "seed-probe") await seedProbeSpend()
    else throw new Error("usage: fixture | caps | live | seed-probe [--keep]")
  } finally {
    await cleanup()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
