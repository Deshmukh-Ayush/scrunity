/**
 * Verifies that legacy Stage 4 (find_companies) does not duplicate companies
 * when the stage is restarted after a partial run. Exercises the persistence
 * step (replaceLegacyProspectCompanies) against the real DB on a throwaway
 * org; no Firecrawl or LLM calls.
 *
 *   npx tsx scripts/test-find-companies-idempotent.ts
 */
import "dotenv/config"
import crypto from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "../src/utils/db"
import {
  gtmContact, gtmIcpSegment, gtmOutreachCampaign, gtmProspectCompany, gtmResearchRun, organization, user,
} from "../src/db/schema"
import { replaceLegacyProspectCompanies } from "../src/inngest/functions/find-companies"

const tag = crypto.randomBytes(4).toString("hex")
const orgId = `fc-test-org-${tag}`
const userId = `fc-test-user-${tag}`

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

const prospect = (d: string) => ({ name: d, domain: `${d}-${tag}.example`, description: "x", location: "IN" })

async function companies(campaignId: string) {
  return db.select().from(gtmProspectCompany).where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
}

async function main() {
  await db.insert(user).values({ id: userId, name: "FC Test", email: `${userId}@scrunity-test.invalid`, emailVerified: true })
  await db.insert(organization).values({ id: orgId, name: "FC Test", slug: orgId })
  const [run] = await db.insert(gtmResearchRun).values({
    organizationId: orgId, createdBy: userId, websiteUrl: "https://fc-test.example", companyName: "FC",
    companyDescription: "x", companySize: "11-50", status: "done", currentStage: "done",
  }).returning()
  const [segment] = await db.insert(gtmIcpSegment).values({
    researchRunId: run.id, name: "seg", painPoint: "x", criteria: ["x"], exampleCompanies: [], targetKeywords: ["x"],
  }).returning()
  const [campaign] = await db.insert(gtmOutreachCampaign).values({
    icpSegmentId: segment.id, researchRunId: run.id, status: "in_progress", currentStage: "find_companies",
  }).returning()

  // A partial first attempt stored 3 companies before failing.
  for (const p of ["alpha", "beta", "gamma"].map(prospect)) {
    await db.insert(gtmProspectCompany).values({ outreachCampaignId: campaign.id, ...p })
  }
  // Restart: the new attempt finds 5 prospects, two overlapping the first attempt.
  const second = ["beta", "gamma", "delta", "epsilon", "zeta"].map(prospect)
  await replaceLegacyProspectCompanies(campaign.id, second)
  let rows = await companies(campaign.id)
  const domains = rows.map((r) => r.domain)
  check("restart leaves exactly this attempt's 5 companies", rows.length === 5, `${rows.length} rows`)
  check("no duplicate domains", new Set(domains).size === domains.length)
  check("stale company from the failed attempt is gone", !domains.includes(prospect("alpha").domain))

  // Running the same attempt again (retry) changes nothing.
  await replaceLegacyProspectCompanies(campaign.id, second)
  rows = await companies(campaign.id)
  check("repeating the stage is a no-op in count", rows.length === 5, `${rows.length} rows`)

  // A company that already has contacts is kept and reused, never duplicated.
  const withContact = rows.find((r) => r.domain === prospect("delta").domain)!
  await db.insert(gtmContact).values({ prospectCompanyId: withContact.id, name: "Asha Rao", title: "CEO" })
  const stored = await replaceLegacyProspectCompanies(campaign.id, second)
  rows = await companies(campaign.id)
  check("company with contacts is reused (same id)", stored.some((s) => s.id === withContact.id))
  check("still 5 companies, no duplicates", rows.length === 5 && new Set(rows.map((r) => r.domain)).size === 5, `${rows.length} rows`)

  await db.delete(organization).where(eq(organization.id, orgId))
  await db.delete(user).where(eq(user.id, userId))
  console.log(`Cleanup: removed org ${orgId}`)
}

main().catch(async (err) => {
  console.error(err)
  await db.delete(organization).where(eq(organization.id, orgId)).catch(() => {})
  await db.delete(user).where(eq(user.id, userId)).catch(() => {})
  process.exit(1)
})
