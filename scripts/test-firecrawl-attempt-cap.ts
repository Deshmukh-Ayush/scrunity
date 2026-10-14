/**
 * Verifies the Firecrawl per-attempt cap and lifetime backstop against the real
 * DB with a stubbed network: Firecrawl and Groq are answered locally and every
 * other non-database host is refused, so no vendor credits can be spent.
 *
 *   npx tsx scripts/test-firecrawl-attempt-cap.ts
 *
 * Creates a throwaway user + org + research run + campaign (so no real org's
 * Firecrawl metering is touched) and deletes them at the end.
 */
import "dotenv/config"

// Must be set before any pipeline code reads them.
process.env.FIRECRAWL_API_KEY = "stub-key-not-real"
process.env.GROQ_API_KEY = "stub-key-not-real"
process.env.GTM_DISCOVERY_MODE = "legacy"
// The network is stubbed, so pace the shared limiter fast (default is 8/min).
process.env.FIRECRAWL_REQUESTS_PER_MINUTE ??= "600"
delete process.env.RESEND_API_KEY
for (const name of [
  "FIRECRAWL_CAMPAIGN_RUN_CAP",
  "FIRECRAWL_CAMPAIGN_LIFETIME_CAP",
]) {
  delete process.env[name]
}

import { eq } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "../src/utils/db"
import {
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  member,
  organization,
  user,
} from "../src/db/schema"
import {
  FirecrawlCallCapExceededError,
  searchFirecrawl,
} from "../src/lib/firecrawl"
import { runCampaignStage } from "../src/lib/pipeline/runner"
import { claimCampaignStage } from "../src/lib/pipeline/stage-state"

// ---------------------------------------------------------------------------
// Network stub
// ---------------------------------------------------------------------------
let firecrawlCalls = 0
const blockedHosts: string[] = []
const realFetch = globalThis.fetch

function chatCompletion(content: string) {
  return Response.json({
    id: "stub",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "stub",
    choices: [
      { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  })
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  )
  if (url.host.endsWith("neon.tech")) return realFetch(input, init)

  if (url.host === "api.firecrawl.dev") {
    firecrawlCalls++
    const n = firecrawlCalls
    // Five distinct, non-aggregator domains per search.
    const data = Array.from({ length: 5 }, (_, i) => ({
      title: `Stub Company ${n}-${i} | Platform`,
      description: `Stub result ${n}-${i}`,
      url: `https://stub-${n}-${i}.example`,
    }))
    return Response.json({ success: true, data })
  }

  if (url.host === "api.groq.com") {
    const body = String(init?.body ?? "")
    if (body.includes("targeted search queries")) {
      return chatCompletion(
        JSON.stringify({
          queries: ["stub query one", "stub query two", "stub query three", "stub query four", "stub query five"],
        })
      )
    }
    return chatCompletion("{}")
  }

  blockedHosts.push(url.host)
  throw new Error(`[stub] blocked network call to ${url.host}`)
}) as typeof fetch

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

async function counters(campaignId: string) {
  const [c] = await db
    .select({
      attempt: gtmOutreachCampaign.firecrawlAttemptCallCount,
      lifetime: gtmOutreachCampaign.firecrawlCallCount,
      stage: gtmOutreachCampaign.currentStage,
      status: gtmOutreachCampaign.status,
      failureReason: gtmOutreachCampaign.failureReason,
    })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  return c
}

/** Calls Firecrawl in an unbounded loop until the cap stops it. */
async function runaway(campaignId: string, organizationId: string) {
  const before = firecrawlCalls
  for (let i = 0; i < 1000; i++) {
    try {
      await searchFirecrawl(`runaway ${i}`, 5, { runContext: { campaignId, organizationId } })
    } catch (err) {
      return { err, networkCalls: firecrawlCalls - before }
    }
  }
  return { err: null, networkCalls: firecrawlCalls - before }
}

/** What the re-run route / Restart Stage do: put the stage back for a fresh claim. */
async function resetForRetry(campaignId: string) {
  await db
    .update(gtmOutreachCampaign)
    .set({
      currentStage: "find_companies",
      status: "in_progress",
      failureReason: null,
      stageStartedAt: new Date(),
      lastProgressAt: null,
    })
    .where(eq(gtmOutreachCampaign.id, campaignId))
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
async function createFixture() {
  const tag = nanoid(8)
  const userId = `cap-test-user-${tag}`
  const orgId = `cap-test-org-${tag}`
  await db.insert(user).values({
    id: userId,
    name: "Cap Test",
    email: `cap-test-${tag}@scrunity-test.invalid`,
    emailVerified: false,
  })
  await db.insert(organization).values({ id: orgId, name: "Cap Test Org", slug: `cap-test-${tag}` })
  await db.insert(member).values({ id: `cap-test-mem-${tag}`, organizationId: orgId, userId, role: "owner" })
  const [run] = await db
    .insert(gtmResearchRun)
    .values({
      organizationId: orgId,
      createdBy: userId,
      websiteUrl: "https://scrunity-cap-test.example",
      companyName: "Cap Test Co",
      companyDescription: "Verification run for the Firecrawl attempt cap",
      companySize: "11-50",
      status: "done",
      currentStage: "done",
    })
    .returning()
  const [segment] = await db
    .insert(gtmIcpSegment)
    .values({
      researchRunId: run.id,
      name: "Stub segment",
      painPoint: "Stub pain point",
      criteria: ["stub criterion"],
      exampleCompanies: [],
    })
    .returning()
  const [campaign] = await db
    .insert(gtmOutreachCampaign)
    .values({ icpSegmentId: segment.id, researchRunId: run.id, status: "in_progress", currentStage: "find_companies" })
    .returning()
  return { userId, orgId, campaignId: campaign.id }
}

async function main() {
  const { userId, orgId, campaignId } = await createFixture()
  console.log(`Fixture: org ${orgId}, campaign ${campaignId}`)
  try {
    console.log("\n1. Runaway loop inside one stage attempt is stopped at the attempt cap")
    await claimCampaignStage(campaignId, "find_companies")
    const first = await runaway(campaignId, orgId)
    check("loop was stopped by FirecrawlCallCapExceededError", first.err instanceof FirecrawlCallCapExceededError)
    check("exactly 35 Firecrawl network calls were made", first.networkCalls === 35, `${first.networkCalls}`)
    check(
      "failure reason is the per-attempt one",
      (first.err as FirecrawlCallCapExceededError)?.failureReason === "firecrawl_call_cap_exceeded"
    )
    console.log("   counters:", await counters(campaignId))

    console.log("\n2. Founder's case: Retry after a capped attempt gets a fresh budget and stage 4 finishes")
    await db
      .update(gtmOutreachCampaign)
      .set({ status: "failed", failureReason: "firecrawl_call_cap_exceeded" })
      .where(eq(gtmOutreachCampaign.id, campaignId))
    await resetForRetry(campaignId)
    const before = firecrawlCalls
    const outcome = await runCampaignStage(campaignId, "find_companies")
    const stage4Calls = firecrawlCalls - before
    const after = await counters(campaignId)
    const companies = await db
      .select({ id: gtmProspectCompany.id })
      .from(gtmProspectCompany)
      .where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
    check("stage 4 outcome is completed", outcome === "completed", outcome)
    check("campaign advanced to find_contacts", after.stage === "find_contacts", after.stage)
    check("stage 4 made at most 7 Firecrawl calls (5 queries + 2 LinkedIn)", stage4Calls <= 7, `${stage4Calls}`)
    check("8 prospect companies stored", companies.length === 8, `${companies.length}`)
    check("lifetime count kept the earlier 35", after.lifetime === 35 + stage4Calls, `${after.lifetime}`)
    console.log("   counters:", after)

    console.log("\n3. Lifetime backstop: restarts cannot burn unbounded credits")
    await db
      .update(gtmOutreachCampaign)
      .set({ firecrawlCallCount: 118 })
      .where(eq(gtmOutreachCampaign.id, campaignId))
    await resetForRetry(campaignId)
    await claimCampaignStage(campaignId, "find_companies")
    const third = await runaway(campaignId, orgId)
    check("stopped after 2 more calls (lifetime 120)", third.networkCalls === 2, `${third.networkCalls}`)
    check(
      "failure reason is the lifetime one",
      (third.err as FirecrawlCallCapExceededError)?.failureReason === "firecrawl_lifetime_cap_exceeded"
    )
    await resetForRetry(campaignId)
    await claimCampaignStage(campaignId, "find_companies")
    const fourth = await runaway(campaignId, orgId)
    check("a further restart makes zero network calls", fourth.networkCalls === 0, `${fourth.networkCalls}`)
    console.log("   counters:", await counters(campaignId))

    check("no other vendor host was contacted", blockedHosts.length === 0, blockedHosts.join(", "))
    console.log(`\nTotal stubbed Firecrawl calls: ${firecrawlCalls}`)
  } finally {
    // Cascades to research run, segment, campaign, companies, credit period, usage events.
    await db.delete(organization).where(eq(organization.id, orgId))
    await db.delete(user).where(eq(user.id, userId))
    console.log("Cleaned up fixture.")
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
