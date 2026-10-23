import "server-only"
import { asc, eq } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmContactImportRow,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"
import { USER_PROVIDED } from "@/lib/email-verification"
import { FIT_PRESELECT_THRESHOLD, generateCompanyFitScores, type CompanyFit } from "@/lib/gtm-company-fit"
import { advanceCampaign, touchCampaignProgress } from "@/lib/pipeline/stage-state"
import { count } from "./copy"
import { groupImportRows, personName, type ImportRowLike } from "./group"
import { IMPORT_COMPANIES_PER_CAMPAIGN } from "./limits"
import { getActiveImport, loadOrgContactChecks } from "./store"

/**
 * Stage 4 for a campaign started from an imported list: no company or people
 * search and no provider account. The list's rows become this campaign's
 * companies and people (source "csv_import", email status user_provided),
 * every company is scored for fit against the segment in batches, and the
 * campaign parks at the company-selection gate like database mode. Stage 5
 * is skipped: the people are already known.
 */

class ImportListUnavailableError extends Error {
  public readonly failureReason = "import_list_unavailable"
  constructor() {
    super("The campaign's imported list was deleted or has no rows.")
    this.name = "ImportListUnavailableError"
  }
}

const FIT_BATCH = 25

export async function isImportCampaign(campaignId: string): Promise<boolean> {
  const [row] = await db
    .select({ importId: gtmOutreachCampaign.sourceImportId })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  return Boolean(row?.importId)
}

export async function executeFindCompaniesFromImport(campaignId: string) {
  const [context] = await db
    .select({ campaign: gtmOutreachCampaign, segment: gtmIcpSegment, researchRun: gtmResearchRun })
    .from(gtmOutreachCampaign)
    .innerJoin(gtmIcpSegment, eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id))
    .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
    .where(eq(gtmOutreachCampaign.id, campaignId))
  if (!context?.campaign.sourceImportId) throw new Error(`Campaign ${campaignId} has no imported list`)
  const { campaign, segment, researchRun } = context
  const organizationId = researchRun.organizationId
  const list = await getActiveImport(organizationId, campaign.sourceImportId!)
  if (!list) throw new ImportListUnavailableError()

  // A restart starts clean: still at Stage 4, so nothing of this campaign was drafted or sent.
  await db.delete(gtmProspectCompany).where(eq(gtmProspectCompany.outreachCampaignId, campaignId))

  const rows: ImportRowLike[] = await db
    .select({
      id: gtmContactImportRow.id,
      rowNumber: gtmContactImportRow.rowNumber,
      email: gtmContactImportRow.email,
      firstName: gtmContactImportRow.firstName,
      lastName: gtmContactImportRow.lastName,
      fullName: gtmContactImportRow.fullName,
      title: gtmContactImportRow.title,
      companyName: gtmContactImportRow.companyName,
      companyDomain: gtmContactImportRow.companyDomain,
      website: gtmContactImportRow.website,
      linkedinUrl: gtmContactImportRow.linkedinUrl,
      city: gtmContactImportRow.city,
      country: gtmContactImportRow.country,
    })
    .from(gtmContactImportRow)
    .where(eq(gtmContactImportRow.importId, list.id))
    .orderBy(asc(gtmContactImportRow.rowNumber))
  if (rows.length === 0) throw new ImportListUnavailableError()
  await touchCampaignProgress(campaignId)

  // Checked again now: another campaign may have emailed someone, or they opted out, since the upload.
  const emails = rows.flatMap((r) => (r.email ? [r.email] : []))
  const checks = await loadOrgContactChecks(organizationId, { emails, domains: [] }, { includeListRows: false })
  const skipEmails = new Set(
    emails.filter((e) => checks.existingKeys.has(`email:${e}`) || checks.doNotContact.has(e) || checks.suppressedEmails.has(e))
  )
  const { companies, skippedAlreadyUsed, leftForLater } = groupImportRows(rows, {
    maxCompanies: IMPORT_COMPANIES_PER_CAMPAIGN,
    skipEmails,
  })

  const inserted = companies.length
    ? await db
        .insert(gtmProspectCompany)
        .values(
          companies.map((c) => ({
            outreachCampaignId: campaignId,
            name: c.name,
            domain: c.domain,
            description: "",
            location: c.location,
            source: "csv_import",
            sourceImportId: list.id,
            website: c.website,
            city: c.city,
            country: c.country,
            decisionMakerStatus: "found" as const,
          }))
        )
        .returning({ id: gtmProspectCompany.id })
    : []
  const people = companies.flatMap((c, i) =>
    c.people.map((p) => ({
      prospectCompanyId: inserted[i].id,
      name: personName(p),
      title: p.title ?? "",
      linkedinUrl: p.linkedinUrl,
      email: p.email,
      emailSource: p.email ? ("user_provided" as const) : ("none" as const),
      verificationStatus: p.email ? (USER_PROVIDED as "user_provided") : ("unverified" as const),
      geo: [p.city, p.country].filter(Boolean).join(", ") || null,
      source: "csv_import",
      sourceImportId: list.id,
    }))
  )
  for (let i = 0; i < people.length; i += 500) await db.insert(gtmContact).values(people.slice(i, i + 500))
  await touchCampaignProgress(campaignId)

  // Fit against the segment, in short batches; the user can still include everyone at the gate.
  const fits = new Map<string, CompanyFit>()
  for (let i = 0; i < companies.length; i += FIT_BATCH) {
    const batch = companies.slice(i, i + FIT_BATCH).map((c, j) => ({
      id: inserted[i + j].id,
      name: c.name,
      industry: null,
      headcount: null,
      revenueRange: null,
      location: c.location,
      description: c.domain ? `Website: ${c.domain}` : "",
    }))
    for (const [id, fit] of await generateCompanyFitScores({ segment, companies: batch })) fits.set(id, fit)
    await touchCampaignProgress(campaignId)
  }
  const scored = fits.size > 0
  let preselected = 0
  for (const { id } of inserted) {
    const fit = fits.get(id)
    const selected = !scored || (fit != null && fit.score >= FIT_PRESELECT_THRESHOLD)
    if (selected && scored) preselected++
    await db
      .update(gtmProspectCompany)
      .set({ fitScore: fit?.score ?? null, fitNote: fit?.reason || null, selectionStatus: selected ? "selected" : "excluded" })
      .where(eq(gtmProspectCompany.id, id))
  }

  const discoveryNote = importDiscoveryNote({
    fileName: list.fileName,
    people: people.length,
    companies: inserted.length,
    skippedAlreadyUsed,
    leftForLater,
    preselected,
    scored,
  })
  console.log(`[Find companies ${campaignId}] import ${list.id}: ${people.length} people at ${inserted.length} companies, ${skippedAlreadyUsed} skipped, ${leftForLater} left`)
  await advanceCampaign(campaignId, "find_companies", {
    currentStage: "awaiting_company_selection",
    status: "awaiting_company_selection",
    discoveryNote,
  })
  return { companies: inserted.map(({ id }, i) => ({ id, name: companies[i].name, domain: companies[i].domain, description: "" })) }
}

/** The gate's note for an imported-list campaign. */
export function importDiscoveryNote(n: {
  fileName: string
  people: number
  companies: number
  skippedAlreadyUsed: number
  leftForLater: number
  preselected: number
  scored: boolean
}): string {
  if (n.people === 0) return `No one from ${n.fileName} is left to contact: everyone is already in another campaign or can't be contacted.`
  const parts = [`${count(n.people, "person", "people")} at ${count(n.companies, "company", "companies")} from ${n.fileName}.`]
  if (n.skippedAlreadyUsed > 0) parts.push(`Skipped ${count(n.skippedAlreadyUsed, "person", "people")} already in another campaign or who can't be contacted.`)
  if (n.leftForLater > 0) parts.push(`${count(n.leftForLater, "more person is", "more people are")} left in the list for your next campaign.`)
  parts.push(
    !n.scored
      ? "Fit scores aren't available, so every company is selected."
      : n.preselected === 0
        ? `None scored ${FIT_PRESELECT_THRESHOLD}+ for this segment. Select the companies you want to include.`
        : `${n.preselected} of ${n.companies} scored ${FIT_PRESELECT_THRESHOLD}+ and are pre-selected. You can select the rest too.`
  )
  return parts.join(" ")
}
