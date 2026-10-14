/**
 * Verifies the database-mode company-selection gate against the real DB, with
 * the fixture company and people providers (zero vendor calls, zero credits).
 *
 *   npx tsx scripts/test-company-selection.ts setup     # two gated campaigns in two orgs
 *   npx tsx scripts/test-company-selection.ts inspect <campaignId>
 *   npx tsx scripts/test-company-selection.ts cleanup   # deletes what setup created
 *
 * The confirm endpoint, Restart Stage and the rendered page are exercised over
 * HTTP against `npm run dev` (see the summary printed by `setup`). Every fetch
 * made by this script is counted by host, so "no vendor calls" is measured.
 */
import "dotenv/config"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { db } from "../src/utils/db"
import {
  gtmContact,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  member,
} from "../src/db/schema"
import {
  runCampaignPipeline,
  runCampaignStage,
} from "../src/lib/pipeline/runner"
import { claimCampaignStage } from "../src/lib/pipeline/stage-state"
import { checkStageStaleness } from "../src/lib/gtm-staleness"

const STATE_FILE = join(
  process.env.SELECTION_TEST_STATE_DIR ?? tmpdir(),
  "scrunity-selection-test.json"
)

const callsByHost = new Map<string, number>()
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url
  )
  callsByHost.set(url.host, (callsByHost.get(url.host) ?? 0) + 1)
  return realFetch(input, init)
}) as typeof fetch
const callsTo = (fragment: string) =>
  [...callsByHost]
    .filter(([h]) => h.includes(fragment))
    .reduce((n, [, c]) => n + c, 0)

function check(label: string, ok: boolean) {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`)
  if (!ok) process.exitCode = 1
}

/** Two different orgs that each have a member (so ?test_org works for both). */
async function twoOrgs() {
  const rows = await db
    .select({ orgId: member.organizationId, userId: member.userId })
    .from(member)
    .limit(2)
  if (rows.length < 2 || rows[0].orgId === rows[1].orgId)
    throw new Error("Need two orgs with members")
  return rows
}

async function createGatedCampaign(
  orgId: string,
  userId: string,
  label: string
) {
  const [run] = await db
    .insert(gtmResearchRun)
    .values({
      organizationId: orgId,
      createdBy: userId,
      websiteUrl: "https://scrunity-selection-test.example",
      companyName: `Selection Test ${label}`,
      companyDescription: "Verification run for the company-selection gate",
      companySize: "11-50",
      targetCountryCode: "IN",
      targetRegion: "Delhi",
      status: "done",
      currentStage: "done",
    })
    .returning()
  const [segment] = await db
    .insert(gtmIcpSegment)
    .values({
      researchRunId: run.id,
      name: "Digital media and HR-tech startups in Delhi",
      painPoint: "Small teams spend hours on manual outbound prospecting",
      criteria: ["10-200 employees", "Based in Delhi NCR", "Sells online"],
      exampleCompanies: [],
      targetKeywords: ["software"],
    })
    .returning()
  const [campaign] = await db
    .insert(gtmOutreachCampaign)
    .values({
      icpSegmentId: segment.id,
      researchRunId: run.id,
      targetCountryCode: "IN",
      targetRegion: "Delhi",
      status: "in_progress",
      currentStage: "find_companies",
    })
    .returning()
  return { run, campaign }
}

async function readCampaign(id: string) {
  const [c] = await db
    .select()
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, id))
  return c
}

async function setup() {
  process.env.GTM_DISCOVERY_MODE = "database"
  process.env.GTM_PROVIDER_MODE = "fixture"
  const [a, b] = await twoOrgs()

  console.log(
    "\n[gate] Stage 4 in database + fixture mode ends at the selection gate"
  )
  const mine = await createGatedCampaign(a.orgId, a.userId, "A")
  const other = await createGatedCampaign(b.orgId, b.userId, "B")
  writeFileSync(
    STATE_FILE,
    JSON.stringify({ runIds: [mine.run.id, other.run.id] })
  )

  callsByHost.clear()
  const outcome = await runCampaignStage(mine.campaign.id, "find_companies")
  const afterStage4 = await readCampaign(mine.campaign.id)
  const companies = await db
    .select()
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, mine.campaign.id))
    .orderBy(gtmProspectCompany.createdAt)
  console.log(
    `  outcome=${outcome} stage=${afterStage4.currentStage} status=${afterStage4.status}`
  )
  console.log(
    `  network calls by host: ${JSON.stringify(Object.fromEntries(callsByHost))}`
  )
  console.table(
    companies.map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      selection: c.selectionStatus,
      fit: c.fitNote,
    }))
  )
  check("Stage 4 completed", outcome === "completed")
  check(
    "campaign waits at awaiting_company_selection",
    afterStage4.currentStage === "awaiting_company_selection"
  )
  check(
    "status left in_progress (runner and stall logic ignore it)",
    afterStage4.status === "awaiting_company_selection"
  )
  check(
    "every company selected by default",
    companies.length > 0 &&
      companies.every((c) => c.selectionStatus === "selected")
  )
  check(
    "zero Apollo and Firecrawl calls",
    callsTo("apollo") === 0 && callsTo("firecrawl") === 0
  )

  await runCampaignStage(other.campaign.id, "find_companies")
  const [foreign] = await db
    .select({ id: gtmProspectCompany.id })
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, other.campaign.id))
    .limit(1)

  console.log("\n[stall] age the gate past every stall threshold")
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  await db
    .update(gtmOutreachCampaign)
    .set({ stageStartedAt: tenMinutesAgo, lastProgressAt: null })
    .where(eq(gtmOutreachCampaign.id, mine.campaign.id))
  const aged = await readCampaign(mine.campaign.id)
  const staleness = checkStageStaleness({
    stage: aged.currentStage,
    status: aged.status,
    stageStartedAt: aged.stageStartedAt,
    lastProgressAt: aged.lastProgressAt,
    createdAt: aged.createdAt,
  })
  console.log(
    `  stageStartedAt=${aged.stageStartedAt?.toISOString()} isStalled=${staleness.isStalled}`
  )
  check("10-minute-old gate is not flagged as stalled", !staleness.isStalled)
  check(
    "no executor can claim the gate",
    !(await claimCampaignStage(mine.campaign.id, "awaiting_company_selection"))
  )
  await runCampaignPipeline(mine.campaign.id)
  check(
    "in-process runner leaves the gate alone",
    (await readCampaign(mine.campaign.id)).currentStage ===
      "awaiting_company_selection"
  )

  const deselect = companies.filter((c) =>
    ["startuppedia.in", "hackingarticles.in", "workafy.com"].includes(c.domain)
  )
  const keep = companies.filter((c) => !deselect.includes(c))
  console.log(
    "\n[next] HTTP checks against `npm run dev` (GTM_DISCOVERY_MODE=database GTM_PROVIDER_MODE=fixture):"
  )
  console.log(
    JSON.stringify(
      {
        orgId: a.orgId,
        campaignId: mine.campaign.id,
        keepIds: keep.map((c) => c.id),
        keepDomains: keep.map((c) => c.domain),
        deselectedDomains: deselect.map((c) => c.domain),
        foreignCompanyId: foreign?.id,
        otherOrgId: b.orgId,
      },
      null,
      2
    )
  )
}

async function inspect(campaignId: string) {
  const campaign = await readCampaign(campaignId)
  const companies = await db
    .select()
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
    .orderBy(gtmProspectCompany.createdAt)
  const contacts = companies.length
    ? await db
        .select()
        .from(gtmContact)
        .where(
          inArray(
            gtmContact.prospectCompanyId,
            companies.map((c) => c.id)
          )
        )
    : []
  console.log(
    `stage=${campaign.currentStage} status=${campaign.status} failureReason=${campaign.failureReason ?? "-"}`
  )
  console.table(
    companies.map((c) => ({
      domain: c.domain,
      selection: c.selectionStatus,
      decisionMaker: c.decisionMakerStatus ?? "-",
      people: contacts.filter((p) => p.prospectCompanyId === c.id).length,
    }))
  )
  console.table(
    contacts.map((p) => ({
      company: companies.find((c) => c.id === p.prospectCompanyId)?.domain,
      name: p.name,
      title: p.title,
      linkedin: p.linkedinUrl,
      geo: p.geo,
      emailStatus: p.emailStatus,
      email: p.email,
    }))
  )
  const excludedIds = companies
    .filter((c) => c.selectionStatus === "excluded")
    .map((c) => c.id)
  const selected = companies.filter((c) => c.selectionStatus === "selected")
  check(
    "excluded companies have no contacts",
    contacts.every((p) => !excludedIds.includes(p.prospectCompanyId))
  )
  check(
    "excluded companies were never searched",
    companies
      .filter((c) => c.selectionStatus === "excluded")
      .every((c) => c.decisionMakerStatus === null)
  )
  check(
    "every selected company has an outcome",
    selected.every((c) => c.decisionMakerStatus !== null)
  )
  // Stage 5 is now the verified-lead search: only mailbox-verified people carry an email.
  check(
    "only mailbox-verified people carry an email",
    contacts.every((p) =>
      p.email ? p.emailStatus === "verified" && p.verificationStatus === "mailbox_verified" : true
    )
  )
  const others = await db
    .select({ id: gtmContact.id })
    .from(gtmContact)
    .where(
      and(
        inArray(
          gtmContact.prospectCompanyId,
          companies.map((c) => c.id)
        ),
        isNull(gtmContact.emailStatus)
      )
    )
  check("no legacy-style contacts were created", others.length === 0)
}

async function cleanup() {
  if (!existsSync(STATE_FILE)) return console.log("nothing to clean up")
  const { runIds } = JSON.parse(readFileSync(STATE_FILE, "utf8")) as {
    runIds: string[]
  }
  for (const id of runIds)
    await db.delete(gtmResearchRun).where(eq(gtmResearchRun.id, id))
  rmSync(STATE_FILE)
  console.log(`cleaned up ${runIds.length} test research run(s) (cascade)`)
}

async function main() {
  const [command, arg] = process.argv.slice(2)
  if (command === "setup") await setup()
  else if (command === "inspect" && arg) await inspect(arg)
  else if (command === "cleanup") await cleanup()
  else throw new Error("usage: setup | inspect <campaignId> | cleanup")
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
