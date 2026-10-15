import { eq } from "drizzle-orm"
import { outreachCampaignChannel } from "../client"
import { db } from "@/utils/db"
import {
  gtmCompanyMetricSnapshot,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  type CompanySearchFilters,
} from "@/db/schema"
import {
  advanceCampaign,
  touchCampaignProgress,
} from "@/lib/pipeline/stage-state"
import { assertCampaignProviders } from "@/lib/pipeline/provider-check"
import { extractDomain } from "@/lib/firecrawl"
import { checkSuppression } from "@/lib/gtm-suppression"
import { countryNameFromCode, formatTargetMarket } from "@/lib/geo/countries"
import { getMaxCompaniesPerRun } from "@/lib/providers/config"
import { getCompanyDiscoveryProvider } from "@/lib/providers/registry"
import {
  FIT_PRESELECT_THRESHOLD,
  generateCompanyFitScores,
  type FitInputCompany,
} from "@/lib/gtm-company-fit"
import { generateCompanySearchFilters, matchedExcludedTerm } from "@/lib/gtm-company-search"
import type { NormalizedCompany } from "@/lib/providers/types"
import { safeRealtimePublish } from "./shared"
import type { FindCompaniesResult, ProspectCompanyData } from "./find-companies"

/** The campaign predates target-country input, so there is nothing to filter on. */
class MissingTargetCountryError extends Error {
  public readonly failureReason = "target_country_missing"
  constructor() {
    super("Campaign has no target country; database discovery needs one.")
    this.name = "MissingTargetCountryError"
  }
}

function locationLabel(company: NormalizedCompany): string {
  return (
    [company.city, company.state, company.country].filter(Boolean).join(", ") ||
    "Unknown"
  )
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The selection gate's note, telling the truth about the search: how many
 * companies matched in the database, how many were fetched, what was skipped
 * and how many were pre-selected as good fits.
 */
export function buildDiscoveryNote({
  totalMatches,
  fetched,
  stored,
  market,
  skippedNoDomain,
  skippedSuppressed,
  skippedExcluded,
  preselected,
  scored,
}: {
  totalMatches: number | null
  fetched: number
  stored: number
  market: string
  skippedNoDomain: number
  skippedSuppressed: number
  skippedExcluded: number
  preselected: number
  scored: boolean
}): string {
  const head =
    totalMatches == null
      ? `${plural(fetched, "company", "companies")} found in ${market}.`
      : totalMatches === 0
        ? `No companies matched these filters in ${market}.`
        : totalMatches <= fetched
          ? `Only ${plural(totalMatches, "company", "companies")} matched these filters in ${market}.`
          : `${totalMatches.toLocaleString("en-US")} companies matched these filters in ${market}; showing the first ${fetched}.`
  const skipped = [
    skippedNoDomain > 0 ? `${skippedNoDomain} had no website` : null,
    skippedSuppressed > 0 ? `${skippedSuppressed} are on the suppression list` : null,
    skippedExcluded > 0 ? `${skippedExcluded} matched an excluded term` : null,
  ].filter(Boolean)
  const skippedText = skipped.length > 0 ? ` Skipped: ${skipped.join(", ")}.` : ""
  const fitText =
    stored === 0
      ? ""
      : !scored
        ? " Fit scores aren't available, so every company is selected."
        : preselected === 0
          ? ` None scored ${FIT_PRESELECT_THRESHOLD}+ for this segment, so none are pre-selected.`
          : ` ${preselected} of ${stored} scored ${FIT_PRESELECT_THRESHOLD}+ and are pre-selected.`
  const widen =
    totalMatches != null && totalMatches <= fetched
      ? " Try widening the region or the segment's size band."
      : ""
  return `${head}${skippedText}${fitText}${widen}`
}

/**
 * Stage 4 (GTM_DISCOVERY_MODE=database): one company-database search built from
 * the segment (LLM-generated include/exclude keywords and industries, the size
 * band) and the campaign's target market. No Firecrawl calls. Every company is
 * scored 0-100 for fit; the good fits are pre-selected at the gate.
 */
export async function executeFindCompaniesFromDatabase(
  outreachCampaignId: string
): Promise<FindCompaniesResult> {
  // A missing provider stops here, before any vendor or LLM call.
  assertCampaignProviders()

  const [context] = await db
    .select({
      campaign: gtmOutreachCampaign,
      segment: gtmIcpSegment,
      researchRun: gtmResearchRun,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(gtmIcpSegment, eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id))
    .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId))

  if (!context) throw new Error(`Outreach campaign ${outreachCampaignId} not found`)
  const { campaign, segment, researchRun } = context

  const countryCode = campaign.targetCountryCode ?? researchRun.targetCountryCode
  const region = campaign.targetCountryCode ? campaign.targetRegion : researchRun.targetRegion
  const country = countryNameFromCode(countryCode)
  if (!country) throw new MissingTargetCountryError()
  const market = formatTargetMarket(countryCode, region) ?? country

  await safeRealtimePublish(outreachCampaignChannel(outreachCampaignId).started, {
    stage: "find_companies",
    message: `Searching the company database for ${segment.name} in ${market}...`,
  })
  await touchCampaignProgress(outreachCampaignId)

  // Filters are generated once and stored, so a restart searches the same way.
  const filters: CompanySearchFilters =
    campaign.searchFilters ??
    (await generateCompanySearchFilters({
      segment,
      sellerDescription: researchRun.companyDescription,
      market,
    }))
  if (!campaign.searchFilters) {
    await db
      .update(gtmOutreachCampaign)
      .set({ searchFilters: filters })
      .where(eq(gtmOutreachCampaign.id, outreachCampaignId))
  }
  await touchCampaignProgress(outreachCampaignId)

  const headcountRange =
    filters.headcountMin != null && filters.headcountMax != null
      ? { min: filters.headcountMin, max: filters.headcountMax }
      : null
  const limit = getMaxCompaniesPerRun()
  const result = await getCompanyDiscoveryProvider().searchCompanies(
    {
      country,
      state: region,
      keywords: filters.includeKeywords,
      excludeKeywords: filters.excludeKeywords,
      industries: filters.industries,
      headcountRange,
      limit,
    },
    {
      organizationId: researchRun.organizationId,
      researchRunId: researchRun.id,
      campaignId: outreachCampaignId,
    }
  )
  await touchCampaignProgress(outreachCampaignId)

  const ownDomain = extractDomain(researchRun.websiteUrl)
  const seenDomains = new Set<string>()
  const skipped = { noDomain: 0, suppressed: 0, excluded: 0 }
  const accepted: Array<NormalizedCompany & { domain: string }> = []
  for (const company of result.companies) {
    const domain = company.domain
    if (!domain) {
      skipped.noDomain++
      continue
    }
    if (domain === ownDomain || seenDomains.has(domain)) continue
    seenDomains.add(domain)
    if (matchedExcludedTerm(company, filters.excludeKeywords)) {
      skipped.excluded++
      continue
    }
    if (await checkSuppression({ domain })) {
      skipped.suppressed++
      continue
    }
    accepted.push({ ...company, domain })
  }

  const insertedCompanies: ProspectCompanyData[] = []
  const fitInputs: FitInputCompany[] = []
  for (const company of accepted) {
    const [inserted] = await db
      .insert(gtmProspectCompany)
      .values({
        outreachCampaignId,
        name: company.name,
        domain: company.domain,
        description: company.description ?? "",
        location: locationLabel(company),
        linkedinUrl: company.linkedinUrl,
        source: company.source,
        providerId: company.providerId,
        website: company.website,
        country: company.country,
        state: company.state,
        city: company.city,
        industry: company.industry,
        headcount: company.headcount,
        revenueRange: company.revenueRange,
      })
      .returning()

    if (company.headcount != null) {
      await db.insert(gtmCompanyMetricSnapshot).values({
        prospectCompanyId: inserted.id,
        employeeCountLabel: `${company.headcount.toLocaleString("en-US")} employees`,
      })
    }
    insertedCompanies.push({
      id: inserted.id,
      name: inserted.name,
      domain: inserted.domain,
      description: inserted.description,
    })
    fitInputs.push({
      id: inserted.id,
      name: inserted.name,
      industry: inserted.industry,
      headcount: inserted.headcount,
      revenueRange: inserted.revenueRange,
      location: inserted.location,
      description: inserted.description,
    })
  }

  // One batched LLM call: a 0-100 fit score and a reason per company. Only good
  // fits start selected; the rest stay visible, unticked.
  await touchCampaignProgress(outreachCampaignId)
  // Scored against the same size band the search filtered on.
  const fits = await generateCompanyFitScores({
    segment: { ...segment, headcountMin: filters.headcountMin, headcountMax: filters.headcountMax },
    companies: fitInputs,
  })
  const scored = fits.size > 0
  let preselected = 0
  for (const company of insertedCompanies) {
    const fit = fits.get(company.id)
    const selected = !scored || (fit != null && fit.score >= FIT_PRESELECT_THRESHOLD)
    if (selected && scored) preselected++
    await db
      .update(gtmProspectCompany)
      .set({
        fitScore: fit?.score ?? null,
        fitNote: fit?.reason || null,
        selectionStatus: selected ? "selected" : "excluded",
      })
      .where(eq(gtmProspectCompany.id, company.id))
  }

  const discoveryNote = buildDiscoveryNote({
    totalMatches: result.totalAvailable,
    fetched: result.companies.length,
    stored: insertedCompanies.length,
    market,
    skippedNoDomain: skipped.noDomain,
    skippedSuppressed: skipped.suppressed,
    skippedExcluded: skipped.excluded,
    preselected,
    scored,
  })

  // Database mode waits for the user to pick companies. The status leaves
  // in_progress, so the runner stops here and staleness never flags the wait.
  await advanceCampaign(outreachCampaignId, "find_companies", {
    currentStage: "awaiting_company_selection",
    status: "awaiting_company_selection",
    discoveryNote,
    searchFilters: { ...filters, totalMatches: result.totalAvailable, fetched: result.companies.length },
  })

  await safeRealtimePublish(outreachCampaignChannel(outreachCampaignId).completed, {
    stage: "find_companies",
    summary: discoveryNote,
  })

  return { companies: insertedCompanies }
}
