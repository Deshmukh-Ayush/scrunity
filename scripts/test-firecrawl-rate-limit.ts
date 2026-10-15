/**
 * Verifies the shared Firecrawl limiter and Stage 5's handling of rate-limited
 * lookups (legacy/web discovery mode, verified-lead search), against the real
 * DB with a stubbed network: Firecrawl answers from a local stub that returns
 * 429s on a schedule, FullEnrich answers from a local stub (through the real
 * adapter, with one IN_PROGRESS poll per job), Groq is stubbed, and any other
 * host is refused. No vendor credits are spent.
 *
 *   npx tsx scripts/test-firecrawl-rate-limit.ts      (takes ~2 minutes: one 60s retry cooldown)
 *
 * Part 1 checks the limiter alone. Part 2 runs Stage 5 for four campaigns at
 * once (one process, one limiter), then Stage 5.5 + write_emails. Creates a
 * throwaway user/org and deletes it, plus the suppression rows it caused.
 */
import "dotenv/config"

process.env.FIRECRAWL_API_KEY = "stub-key-not-real"
process.env.GROQ_API_KEY = "stub-key-not-real"
process.env.GTM_DISCOVERY_MODE = "legacy"
process.env.FULLENRICH_API_KEY = "stub-key-not-real"
process.env.GTM_EMAIL_POLL_INTERVAL_MS = "50"
delete process.env.GTM_PROVIDER_MODE
delete process.env.ENRICH_API_KEY
delete process.env.RESEND_API_KEY
delete process.env.FIRECRAWL_CAMPAIGN_RUN_CAP
delete process.env.FIRECRAWL_CAMPAIGN_LIFETIME_CAP

import { eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { db } from "../src/utils/db"
import {
  gtmContact,
  gtmEmailDraft,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  gtmSuppressionEntry,
  gtmVendorUsage,
  member,
  organization,
  user,
} from "../src/db/schema"
import { FirecrawlLimiter, getFirecrawlLimiterConfig } from "../src/lib/firecrawl-limiter"
import { runCampaignStage } from "../src/lib/pipeline/runner"

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Firecrawl stub with a 429 schedule
// ---------------------------------------------------------------------------
const STUB_LATENCY_MS = 250
/**
 * Each distinct rl-recover-* request is answered 429 for its first 2 attempts:
 * exactly what the first pass makes (maxRetries 1), so it can only succeed in
 * the end-of-stage retry pass (maxRetries 3).
 */
const RECOVER_AFTER_ATTEMPTS = 2
const attemptsByRequest = new Map<string, number>()

const stats = { requests: 0, inFlight: 0, peakInFlight: 0, starts: [] as number[], transient429: 0, scheduled429: 0 }
const blockedHosts: string[] = []
const realFetch = globalThis.fetch

const json429 = () =>
  new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": "1" },
  })

/** Which fixture company a request is about, from its domain or company name (LinkedIn queries use the name). */
function kindOf(target: string) {
  if (/rl-forever-|Forever Corp/.test(target)) return "rl-forever"
  if (/rl-recover-|Recover Corp/.test(target)) return "rl-recover"
  if (/none-|Nobody Corp/.test(target)) return "none"
  return "ok"
}

function firecrawlAnswer(path: string, body: { query?: string; url?: string }): Response {
  const target = body.query ?? body.url ?? ""
  const kind = kindOf(target)
  const domain = /([a-z0-9-]+\.example)/.exec(target)?.[1] ?? "unknown.example"

  if (kind === "rl-forever") {
    stats.scheduled429++
    return json429()
  }
  if (kind === "rl-recover") {
    const key = `${path} ${target}`
    const attempt = (attemptsByRequest.get(key) ?? 0) + 1
    attemptsByRequest.set(key, attempt)
    if (attempt <= RECOVER_AFTER_ATTEMPTS) {
      stats.scheduled429++
      return json429()
    }
  } else if (stats.requests % 5 === 0) {
    // Every 5th ok/none request gets one transient 429; its retry succeeds.
    stats.transient429++
    return json429()
  }

  const found = kind !== "none"
  if (path.endsWith("/search")) {
    const isLinkedin = target.includes("linkedin.com/in")
    const data = !found
      ? []
      : isLinkedin
        ? [{ title: `Jane Doe - Head of Sales at ${domain} | LinkedIn`, description: "Head of Sales", url: `https://www.linkedin.com/in/jane-doe-${domain}` }]
        : [{ title: "About us", description: "Our company", url: `https://${domain}/about` }]
    return Response.json({ success: true, data })
  }
  return Response.json({ success: true, data: { markdown: "Welcome to our site.", metadata: { title: domain }, links: [] } })
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)
  if (url.host.endsWith("neon.tech")) return realFetch(input, init)

  if (url.host === "api.firecrawl.dev") {
    stats.requests++
    stats.starts.push(Date.now())
    stats.inFlight++
    stats.peakInFlight = Math.max(stats.peakInFlight, stats.inFlight)
    try {
      await sleep(STUB_LATENCY_MS)
      return firecrawlAnswer(url.pathname, JSON.parse(String(init?.body ?? "{}")))
    } finally {
      stats.inFlight--
    }
  }
  if (url.host === "app.fullenrich.com") return fullEnrichAnswer(url.pathname, init)
  if (url.host === "api.groq.com") {
    // One answer that satisfies both the role-derivation and the draft schema.
    const content = JSON.stringify({
      jobFunctions: ["Head of Sales"], searchKeyword: "Head of Sales",
      subject: "Quick question", body: "Hi Jane. We help sales teams prospect faster. Would a short call next week work?",
    })
    return Response.json({
      id: "stub", object: "chat.completion", created: Math.floor(Date.now() / 1000), model: "stub",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })
  }
  if (url.host === "cloudflare-dns.com") return Response.json({ Status: 3, Answer: [] })

  blockedHosts.push(url.host)
  throw new Error(`[stub] blocked network call to ${url.host}`)
}) as typeof fetch

/** FullEnrich stub: one job per POST; the first GET says IN_PROGRESS, then a DELIVERABLE address. */
const fullEnrich = { posts: [] as string[], polls: new Map<string, number>() }
function fullEnrichAnswer(path: string, init?: RequestInit): Response {
  if (init?.method === "POST") {
    const body = JSON.parse(String(init.body)) as { data: Array<{ first_name: string; last_name: string; domain: string }> }
    const p = body.data[0]
    const jobId = `job-${fullEnrich.posts.length}`
    fullEnrich.posts.push(`${p.first_name} ${p.last_name}@${p.domain}`)
    fullEnrich.polls.set(jobId, 0)
    return Response.json({ enrichment_id: jobId })
  }
  const jobId = path.split("/").pop()!
  const seen = (fullEnrich.polls.get(jobId) ?? 0) + 1
  fullEnrich.polls.set(jobId, seen)
  if (seen === 1) return Response.json({ id: jobId, status: "IN_PROGRESS", data: [] })
  const person = fullEnrich.posts[Number(jobId.split("-")[1])]
  const [name, domain] = person.split("@")
  const email = `${name.toLowerCase().replace(" ", ".")}@${domain}`
  return Response.json({ id: jobId, status: "FINISHED", cost: { credits: 1 },
    data: [{ contact_info: { most_probable_work_email: { email, status: "DELIVERABLE" } } }] })
}

// ---------------------------------------------------------------------------
// Part 1: the limiter on its own
// ---------------------------------------------------------------------------
async function limiterUnitChecks() {
  console.log("\n1. Limiter alone")
  const saved = { rpm: process.env.FIRECRAWL_REQUESTS_PER_MINUTE, conc: process.env.FIRECRAWL_MAX_CONCURRENCY }
  delete process.env.FIRECRAWL_REQUESTS_PER_MINUTE
  delete process.env.FIRECRAWL_MAX_CONCURRENCY
  const defaults = getFirecrawlLimiterConfig()
  check("defaults are 8 req/min and 2 concurrent (Free plan: 10/min, 2 browsers)", defaults.requestsPerMinute === 8 && defaults.maxConcurrency === 2, JSON.stringify(defaults))
  process.env.FIRECRAWL_REQUESTS_PER_MINUTE = "120"
  process.env.FIRECRAWL_MAX_CONCURRENCY = "3"
  const fromEnv = getFirecrawlLimiterConfig()
  check("both are read from env", fromEnv.requestsPerMinute === 120 && fromEnv.maxConcurrency === 3, JSON.stringify(fromEnv))
  if (saved.rpm) process.env.FIRECRAWL_REQUESTS_PER_MINUTE = saved.rpm; else delete process.env.FIRECRAWL_REQUESTS_PER_MINUTE
  if (saved.conc) process.env.FIRECRAWL_MAX_CONCURRENCY = saved.conc; else delete process.env.FIRECRAWL_MAX_CONCURRENCY

  // 60 req/min (1s apart), 2 at once, each request takes 2.5s, 8 fired together.
  const limiter = new FirecrawlLimiter(() => ({ requestsPerMinute: 60, maxConcurrency: 2 }))
  let inFlight = 0
  let peak = 0
  const starts: number[] = []
  const t0 = Date.now()
  await Promise.all(
    Array.from({ length: 8 }, () =>
      limiter.run(async () => {
        starts.push(Date.now() - t0)
        peak = Math.max(peak, ++inFlight)
        await sleep(2500)
        inFlight--
      })
    )
  )
  const gaps = starts.slice(1).map((s, i) => s - starts[i])
  check("8 simultaneous callers never exceed 2 in flight", peak === 2, `peak ${peak}`)
  check("starts are at least ~1s apart at 60 req/min", Math.min(...gaps) >= 950, `min gap ${Math.min(...gaps)}ms`)

  const paused = new FirecrawlLimiter(() => ({ requestsPerMinute: 600, maxConcurrency: 2 }))
  const p0 = Date.now()
  paused.pause(1500)
  let startedAfter = 0
  await paused.run(async () => { startedAfter = Date.now() - p0 })
  check("a 429 pause delays the next request for every caller", startedAfter >= 1450, `${startedAfter}ms`)
}

// ---------------------------------------------------------------------------
// Part 2: Stage 5 for four campaigns at once
// ---------------------------------------------------------------------------
const KINDS = ["ok", "rl-recover", "rl-forever", "none"] as const
/** Company names without hyphens (Stage 5 cuts a company name at its first hyphen). */
const NAME_OF: Record<(typeof KINDS)[number], string> = {
  ok: "Okay Corp",
  "rl-recover": "Recover Corp",
  "rl-forever": "Forever Corp",
  none: "Nobody Corp",
}

async function createFixture() {
  const tag = nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, "x")
  const userId = `rl-test-user-${tag}`
  const orgId = `rl-test-org-${tag}`
  await db.insert(user).values({ id: userId, name: "RL Test", email: `rl-test-${tag}@scrunity-test.invalid`, emailVerified: false })
  await db.insert(organization).values({ id: orgId, name: "RL Test Org", slug: `rl-test-${tag}` })
  await db.insert(member).values({ id: `rl-test-mem-${tag}`, organizationId: orgId, userId, role: "owner" })
  const [run] = await db
    .insert(gtmResearchRun)
    .values({ organizationId: orgId, createdBy: userId, websiteUrl: "https://rl-test.example", companyName: "RL Test Co", companyDescription: "Rate-limit verification", companySize: "11-50", status: "done", currentStage: "done" })
    .returning()
  const [segment] = await db
    .insert(gtmIcpSegment)
    .values({ researchRunId: run.id, name: "Stub segment", painPoint: "Stub", criteria: ["stub"], exampleCompanies: [] })
    .returning()
  const campaignIds: string[] = []
  for (let c = 1; c <= 4; c++) {
    const [campaign] = await db
      .insert(gtmOutreachCampaign)
      .values({ icpSegmentId: segment.id, researchRunId: run.id, status: "in_progress", currentStage: "find_contacts" })
      .returning()
    campaignIds.push(campaign.id)
    for (const kind of KINDS) {
      await db.insert(gtmProspectCompany).values({
        outreachCampaignId: campaign.id,
        name: `${NAME_OF[kind]} ${c}`,
        domain: `${kind}-c${c}-${tag}.example`,
        description: "stub",
        location: "United States",
      })
    }
  }
  return { userId, orgId, campaignIds }
}

async function contactsByKind(campaignId: string) {
  const rows = await db
    .select({ id: gtmContact.id, name: gtmContact.name, linkedinUrl: gtmContact.linkedinUrl, lookupStatus: gtmContact.lookupStatus,
      emailStatus: gtmContact.emailStatus, email: gtmContact.email, domain: gtmProspectCompany.domain, companyStatus: gtmProspectCompany.decisionMakerStatus })
    .from(gtmContact)
    .innerJoin(gtmProspectCompany, eq(gtmContact.prospectCompanyId, gtmProspectCompany.id))
    .where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
  const byKind = Object.fromEntries(KINDS.map((k) => [k, rows.find((r) => r.domain.startsWith(`${k}-`))]))
  return byKind as Record<(typeof KINDS)[number], (typeof rows)[number] | undefined>
}

async function companyStatus(campaignId: string, kind: string) {
  const companies = await db.select().from(gtmProspectCompany).where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
  return companies.find((c) => c.domain.startsWith(`${kind}-`))?.decisionMakerStatus ?? null
}

async function main() {
  await limiterUnitChecks()

  process.env.FIRECRAWL_REQUESTS_PER_MINUTE = "300" // 200ms apart, so the test is quick
  process.env.FIRECRAWL_MAX_CONCURRENCY = "2"
  const { userId, orgId, campaignIds } = await createFixture()
  console.log(`\nFixture: org ${orgId}, campaigns ${campaignIds.join(", ")}`)

  try {
    console.log("\n2. Stage 5 for 4 campaigns concurrently (one shared limiter)")
    const t0 = Date.now()
    const outcomes = await Promise.all(campaignIds.map((id) => runCampaignStage(id, "find_contacts")))
    console.log(`   finished in ${Math.round((Date.now() - t0) / 1000)}s; outcomes ${outcomes.join(", ")}`)
    // Starts are timestamped inside the stub, so a few ms of async jitter is expected;
    // a burst (two requests released together) would show up as a ~0ms gap.
    const startGaps = stats.starts.slice(1).map((s, i) => s - stats.starts[i])
    const maxIn10s = Math.max(...stats.starts.map((s) => stats.starts.filter((t) => t >= s && t < s + 10_000).length))
    check("every stage 5 completed", outcomes.every((o) => o === "completed"))
    check("(a) peak Firecrawl requests in flight never exceeded FIRECRAWL_MAX_CONCURRENCY=2", stats.peakInFlight <= 2, `peak ${stats.peakInFlight} over ${stats.requests} requests`)
    check("no burst: no two starts closer than 150ms (interval 200ms)", Math.min(...startGaps) >= 150, `min gap ${Math.min(...startGaps)}ms`)
    check("pace held: at most 50 (+1 jitter) starts in any 10s window (300/min)", maxIn10s <= 51, `max ${maxIn10s}`)
    check("429s were returned and retried (transient + scheduled)", stats.transient429 > 0 && stats.scheduled429 > 0, `${stats.transient429} transient, ${stats.scheduled429} scheduled`)

    for (const [i, id] of campaignIds.entries()) {
      const c = await contactsByKind(id)
      const [camp] = await db.select({ attempt: gtmOutreachCampaign.firecrawlAttemptCallCount, stage: gtmOutreachCampaign.currentStage }).from(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, id))
      console.log(`   campaign ${i + 1}: ${KINDS.map((k) => `${k}=${c[k]?.lookupStatus}/${c[k]?.name}`).join(" | ")} | firecrawl calls this attempt ${camp.attempt}`)
      check(`c${i + 1}: normal company: decision maker found and email verified`, c.ok?.name === "Jane Doe" && c.ok?.emailStatus === "verified")
      check(`c${i + 1}: (b) rate-limited company recovered in the retry pass`, c["rl-recover"]?.name === "Jane Doe" && c["rl-recover"]?.emailStatus === "verified" && Boolean(c["rl-recover"]?.linkedinUrl))
      check(`c${i + 1}: still rate-limited after retries -> no person, marked "not reached" (picked up again by a restart)`,
        !c["rl-forever"] && (await companyStatus(id, "rl-forever")) === "not_reached")
      check(`c${i + 1}: genuinely nothing found -> settled as no decision maker`, !c.none && (await companyStatus(id, "none")) === "no_decision_maker_found")
      check(`c${i + 1}: call cap unchanged and respected (<= 35 this attempt)`, camp.attempt <= 35, `${camp.attempt}`)
    }

    console.log("\n3. Stage 5.5 + write_emails on campaign 1")
    const outcome = await runCampaignStage(campaignIds[0], "write_emails")
    const c1 = await contactsByKind(campaignIds[0])
    const drafts = await db.select({ contactId: gtmEmailDraft.contactId, status: gtmEmailDraft.status, reason: gtmEmailDraft.errorMessage }).from(gtmEmailDraft).where(eq(gtmEmailDraft.outreachCampaignId, campaignIds[0]))
    const suppressions = await db.select({ contactId: gtmSuppressionEntry.sourceContactId, reason: gtmSuppressionEntry.reason }).from(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.sourceOrgId, orgId))
    const draftOf = (id?: string) => drafts.find((d) => d.contactId === id)
    console.log(`   write_emails outcome: ${outcome}`)
    console.log("   drafts:", drafts.map((d) => `${d.status}: ${d.reason}`).join(" | "))
    check("verified leads were drafted", draftOf(c1.ok?.id)?.status === "draft" && draftOf(c1["rl-recover"]?.id)?.status === "draft")
    check("(b) the still-rate-limited company produced no draft and no suppression", drafts.length === 2 && suppressions.length === 0,
      `${drafts.length} drafts, ${suppressions.length} suppression rows`)
    check("each person was submitted to the email vendor exactly once", new Set(fullEnrich.posts).size === fullEnrich.posts.length && fullEnrich.posts.length === 8,
      `${fullEnrich.posts.length} submissions`)
    check("no other vendor host was contacted", blockedHosts.length === 0, blockedHosts.join(", "))
    console.log(`\nStub totals: ${stats.requests} Firecrawl requests, ${stats.transient429 + stats.scheduled429} answered with 429.`)
  } finally {
    const campaignContacts = await db
      .select({ id: gtmContact.id })
      .from(gtmContact)
      .innerJoin(gtmProspectCompany, eq(gtmContact.prospectCompanyId, gtmProspectCompany.id))
      .where(inArray(gtmProspectCompany.outreachCampaignId, campaignIds))
    await db.delete(gtmVendorUsage).where(inArray(gtmVendorUsage.campaignId, campaignIds))
    await db.delete(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.sourceOrgId, orgId))
    if (campaignContacts.length) {
      await db.delete(gtmSuppressionEntry).where(inArray(gtmSuppressionEntry.sourceContactId, campaignContacts.map((c) => c.id)))
    }
    await db.delete(organization).where(eq(organization.id, orgId))
    await db.delete(user).where(eq(user.id, userId))
    console.log("Cleaned up fixture and its suppression rows.")
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
