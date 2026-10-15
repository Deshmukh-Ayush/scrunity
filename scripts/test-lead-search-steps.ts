/**
 * Stage 5 (verified-lead search) as short Inngest steps, run through the
 * Inngest dev server in fixture mode: synthetic people and recorded FullEnrich
 * responses, so zero vendor calls and zero real credits.
 *
 * Start first (two terminals):
 *   PIPELINE_EXECUTOR=inngest GTM_PROVIDER_MODE=fixture GTM_DISCOVERY_MODE=database \
 *     GTM_PEOPLE_PROVIDER=fixture GTM_EMAIL_POLL_INTERVAL_MS=3000 npx next dev -p 3124
 *   npx inngest dev -u http://localhost:3124/api/inngest --no-discovery
 * Then:
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-lead-search-steps.ts
 *
 * 1. double trigger: the same Stage 5 event twice; one run claims, the other
 *    is skipped; a FullEnrich job with 2 pending polls completes through step
 *    sleeps; prints every step with its duration (from the dev server's trace).
 * 2. forced restart mid-search: while a vendor job is running, the executor is
 *    made to look dead (no heartbeat for 5 min), Restart Stage resets the stage
 *    and a new attempt claims it (its steps run in this process); the old
 *    Inngest run's next step sees it was superseded and stops; nobody is looked
 *    up or charged twice, and stage_timings keeps both attempts.
 * Creates one throwaway org and deletes it (and its fixture ledger rows) after.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { and, eq, sql } from "drizzle-orm"

process.env.GTM_PROVIDER_MODE = "fixture"
process.env.GTM_DISCOVERY_MODE = "database"
process.env.GTM_PEOPLE_PROVIDER = "fixture"
process.env.PIPELINE_EXECUTOR = "inngest"

const DEV = "http://127.0.0.1:8288"
const tag = crypto.randomBytes(3).toString("hex")
const id = (k: string) => `ls-${tag}-${k}`
let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures++
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { db } = await import("../src/utils/db")
  const { gtmOutreachCampaign } = await import("../src/db/schema")
  const { inngest } = await import("../src/inngest/client")
  const { campaignIsIdle, stageTimingAttempts } = await import("../src/lib/pipeline/stage-state")
  const q = (s: TemplateStringsArray, ...v: unknown[]) => db.execute(sql(s, ...v))
  const rows = async (s: TemplateStringsArray, ...v: unknown[]) => (await q(s, ...v)).rows as any[]

  async function setup() {
    await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("u")}, 'LS', ${`ls-${tag}@scrunity-test.invalid`}, true, now(), now())`
    await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org")}, 'LS Test', ${id("slug")}, 'pilot', now(), now())`
    await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage, target_country_code)
            values (${id("run")}, ${id("org")}, ${id("u")}, 'https://ls.example', 'LS Outbound', 'Outbound automation for B2B teams', '11-50', 'done', 'done', 'AU')`
    await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords)
            values (${id("seg")}, ${id("run")}, 'Australian software companies', 'Manual outbound prospecting wastes sales time', '["50-5000 employees","Australia"]', '[]', '["software"]')`
  }
  async function campaign(key: string, target: number, domains: string[]) {
    await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage, target_country_code, target_verified_leads, stage_started_at, lead_search_state)
            values (${id(key)}, ${id("seg")}, ${id("run")}, 'in_progress', 'find_contacts', 'AU', ${target}, now(),
                    ${JSON.stringify({ attemptId: null, titles: ["Chief Executive Officer", "Managing Director"] })}::jsonb)`
    for (const [i, domain] of domains.entries()) {
      await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location, source, fit_score, created_at)
              values (${id(`${key}-co${i}`)}, ${id(key)}, ${domain.split(".")[0]}, ${domain}, 'fixture company', 'Australia', 'fixture', ${90 - i}, now())`
    }
    return id(key)
  }
  const trigger = async (cid: string) =>
    (await inngest.send({ name: "gtm/campaign.find_contacts", data: { outreachCampaignId: cid } })).ids[0]
  async function waitFor(cid: string, stages: string[], timeoutMs = 240_000) {
    const t0 = Date.now()
    for (;;) {
      const [c] = await rows`select current_stage, status from gtm_outreach_campaign where id = ${cid}`
      if (stages.includes(c.current_stage) || c.status === "failed") return c
      if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${stages} (at ${c.current_stage}/${c.status})`)
      await sleep(1000)
    }
  }
  const ledger = async (cid: string) =>
    (await rows`select count(*)::int n, coalesce(sum(credits_used),0)::int credits from gtm_vendor_usage where campaign_id = ${cid} and vendor = 'fullenrich_fixture'`)[0]
  const lookups = async (cid: string) =>
    (await rows`select ct.name, ct.email_status, ct.email_lookup_ref ref, ct.enrich_metadata->>'creditsUsed' credits
      from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id where pc.outreach_campaign_id = ${cid} order by ct.created_at`)

  const gql = async (query: string) =>
    (await (await fetch(`${DEV}/v0/gql`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) })).json()) as any
  /** Runs started by an event (dev server REST API), each with the outcome its function returned (GraphQL). */
  async function runsOf(eventId: string, timeoutMs = 90_000) {
    const t0 = Date.now()
    for (;;) {
      const body = (await (await fetch(`${DEV}/v1/events/${eventId}/runs`)).json()) as { data?: any[] }
      const runs = body.data ?? []
      if ((runs.length > 0 && runs.every((r) => r.status !== "Running")) || Date.now() - t0 > timeoutMs) {
        const out = []
        for (const r of runs) {
          const raw = (await gql(`{ run(runID: "${r.run_id}") { output } }`)).data?.run?.output ?? "[]"
          const done = (JSON.parse(raw) as any[]).find((op) => op.op === "RunComplete")
          out.push({ run_id: r.run_id as string, status: r.status as string, outcome: done?.data?.outcome as string | undefined })
        }
        return out
      }
      await sleep(1000)
    }
  }
  /** Every step of a run with its duration (dev server GraphQL trace). */
  async function stepsOf(runId: string) {
    const body = await gql(`{ runTrace(runID: "${runId}") { name duration status childrenSpans { name duration status stepOp startedAt endedAt } } }`)
    return (body.data?.runTrace?.childrenSpans ?? []) as Array<{ name: string; duration: number | null; status: string; stepOp: string | null }>
  }
  function printSteps(label: string, steps: Awaited<ReturnType<typeof stepsOf>>) {
    console.log(`  ${label}: ${steps.length} steps`)
    console.table(steps.map((s) => ({ step: s.name, op: s.stepOp, ms: s.duration, status: s.status })))
  }

  await setup()
  try {
    console.log("1. Double trigger; a vendor job that needs several polls; step durations")
    const c1 = await campaign("steps", 3, ["fujitsu.com", "atlassian.com", "canva.com", "freelancer.com", "talentinternational.com"])
    const [e1, e2] = [await trigger(c1), await trigger(c1)]
    const end1 = await waitFor(c1, ["awaiting_approval"])
    check("campaign reached awaiting_approval through Inngest (Stage 5 -> write_emails)", end1.current_stage === "awaiting_approval", `${end1.current_stage}/${end1.status}`)
    const runs1 = [...(await runsOf(e1)), ...(await runsOf(e2))]
    const outcomes = runs1.map((r) => r.outcome).sort()
    check("one run completed, the other was skipped at its claim step", outcomes.join(",") === "completed,skipped", outcomes.join(","))
    const main = runs1.find((r) => r.outcome === "completed")
    const steps = main ? await stepsOf(main.run_id) : []
    printSteps("completed run", steps)
    const runSteps = steps.filter((s) => s.stepOp === "RUN" || /^(claim|search-|finish)/.test(s.name))
    const sleeps = steps.filter((s) => s.stepOp === "SLEEP" || /^wait-/.test(s.name))
    const longest = runSteps.reduce((m, s) => Math.max(m, s.duration ?? 0), 0)
    check("Stage 5 ran as several steps with step sleeps between them", runSteps.length >= 4 && sleeps.length >= 2, `${runSteps.length} run steps, ${sleeps.length} sleeps`)
    check("longest single step is far under the 300 s maxDuration (< 60 s)", longest > 0 && longest < 60_000, `${longest} ms`)
    const people1 = await lookups(c1)
    console.table(people1)
    const ethan = people1.find((p) => p.name === "Ethan Fixturelli")
    check("the job with 2 pending polls (Ethan, fujitsu.com) finished verified", ethan?.email_status === "verified", ethan?.email_status)
    const l1 = await ledger(c1)
    const withJob = people1.filter((p) => p.ref)
    check("each person looked up once: ledger rows == people with a job == distinct jobs", l1.n === withJob.length && new Set(withJob.map((p) => p.ref)).size === withJob.length, `${l1.n} rows, ${withJob.length} jobs`)
    const [t1] = await db.select({ t: gtmOutreachCampaign.stageTimings }).from(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, c1))
    console.log(`  stage_timings.find_contacts: ${JSON.stringify(stageTimingAttempts(t1.t, "find_contacts"))}`)

    console.log("\n2. Forced restart mid-search")
    const c2 = await campaign("restart", 3, ["fujitsu.com", "atlassian.com", "freelancer.com", "talentinternational.com"])
    const e3 = await trigger(c2)
    // Mid-search: Ethan's job (2 pending polls, 3 s apart) is running.
    for (let i = 0; i < 60 && !(await lookups(c2)).some((p) => p.name === "Ethan Fixturelli" && p.ref); i++) await sleep(500)
    const before = { ledger: await ledger(c2), people: (await lookups(c2)).length }
    console.log(`  mid-search state: ${JSON.stringify(before)}`)
    // The executor "dies" (no heartbeat for 5 minutes), Restart Stage resets the stage, and a
    // new attempt claims it at once. The old Inngest run keeps going as a zombie: its next
    // step must see that it was superseded and stop without storing or spending anything.
    // The new attempt's steps run in this process (the in-process executor).
    const { claimLeadSearch, leadSearchStep, finishLeadSearchStage } = await import("../src/lib/pipeline/lead-search-steps")
    let attempt = null as Awaited<ReturnType<typeof claimLeadSearch>>
    for (let i = 0; i < 5 && !attempt; i++) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000)
      await db.update(gtmOutreachCampaign).set({ lastProgressAt: fiveMinAgo, stageStartedAt: fiveMinAgo }).where(eq(gtmOutreachCampaign.id, c2))
      const reset = await db
        .update(gtmOutreachCampaign)
        .set({ currentStage: "find_contacts", status: "in_progress", failureReason: null, stageStartedAt: new Date(), lastProgressAt: null })
        .where(and(eq(gtmOutreachCampaign.id, c2), eq(gtmOutreachCampaign.currentStage, "find_contacts"), campaignIsIdle()))
        .returning({ id: gtmOutreachCampaign.id })
      attempt = reset.length ? await claimLeadSearch(c2) : null
    }
    check("Restart Stage accepted once the executor looked dead, and a new attempt claimed the stage", Boolean(attempt), attempt?.attemptId ?? "no claim")
    for (let i = 0; attempt && i < 100; i++) {
      const r = await leadSearchStep(c2, attempt)
      if (r.status !== "continue" && r.status !== "waiting") break
      if (r.waitMs) await sleep(r.waitMs)
    }
    const finished = attempt ? await finishLeadSearchStage(c2, attempt) : "skipped"
    check("the new attempt finished the stage", finished === "completed", finished)
    await inngest.send({ name: "gtm/campaign.write_emails", data: { outreachCampaignId: c2 } })
    const end2 = await waitFor(c2, ["awaiting_approval"])
    check("campaign still reached awaiting_approval", end2.current_stage === "awaiting_approval", `${end2.current_stage}/${end2.status}`)
    const runs2 = await runsOf(e3)
    console.log(`  old Inngest run: ${runs2.map((r) => `${r.run_id}=${r.outcome}`).join(", ")}`)
    check("the old (zombie) run stopped as skipped, without finishing", runs2.length === 1 && runs2[0].outcome === "skipped", runs2.map((r) => r.outcome).join(","))
    for (const r of runs2) printSteps(`old run ${r.run_id} (${r.outcome})`, await stepsOf(r.run_id))
    const people2 = await lookups(c2)
    console.table(people2)
    const l2 = await ledger(c2)
    const jobs2 = people2.filter((p) => p.ref)
    check("nobody looked up twice: distinct names == people, ledger rows == jobs", new Set(people2.map((p) => p.name)).size === people2.length && l2.n === jobs2.length, `${people2.length} people, ${l2.n} rows, ${jobs2.length} jobs`)
    check("Ethan's job (started before the restart) was polled to the end, not paid twice", people2.filter((p) => p.name === "Ethan Fixturelli").length === 1 && people2.find((p) => p.name === "Ethan Fixturelli")?.email_status === "verified")
    const [t2] = await db.select({ t: gtmOutreachCampaign.stageTimings }).from(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, c2))
    const attempts = stageTimingAttempts(t2.t, "find_contacts")
    console.log(`  stage_timings.find_contacts: ${JSON.stringify(attempts)}`)
    check("stage_timings keeps both attempts (superseded + completed)", attempts.length === 2 && attempts.some((a) => a.outcome === "completed") && attempts.some((a) => a.outcome === "superseded"), attempts.map((a) => a.outcome).join(","))
  } finally {
    await q`delete from gtm_vendor_usage where campaign_id like ${`ls-${tag}-%`}`
    await q`delete from organization where id = ${id("org")}`
    await q`delete from "user" where id = ${id("u")}`
    const left = (await rows`select (select count(*)::int from gtm_outreach_campaign where id like ${`ls-${tag}-%`}) campaigns,
      (select count(*)::int from gtm_vendor_usage where campaign_id like ${`ls-${tag}-%`}) ledger_rows`)[0]
    console.log(`\nCleanup: ${JSON.stringify(left)}`)
  }
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
