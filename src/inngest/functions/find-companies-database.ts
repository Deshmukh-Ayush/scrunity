import { eq } from "drizzle-orm"
import { outreachCampaignChannel } from "../client"
import { db } from "@/utils/db"
import {
  gtmCompanyMetricSnapshot,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"
import { advanceCampaign, touchCampaignProgress } from "@/lib/pipeline/stage-state"
import { extractDomain } from "@/lib/firecrawl"
import { checkSuppression } from "@/lib/gtm-suppression"
import { countryNameFromCode, formatTargetMarket } from "@/lib/geo/countries"
import { getMaxCompaniesPerRun } from "@/lib/providers/config"
import { getCompanyDiscoveryProvider } from "@/lib/providers/registry"
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
  return [company.city, company.state, company.country].filter(Boolean).join(", ") || "Unknown"
}

/** Explains a short result in plain words; null when the full count came back. */
function buildDiscoveryNote({
  stored,
  requested,
  market,
  skippedNoDomain,
  skippedSuppressed,
}: {
  stored: number
  requested: number
  market: string
  skippedNoDomain: number
  skippedSuppressed: number
}): string | null {
  if (stored >= requested) return null
  const head =
    stored === 0
      ? `No companies matched these filters in ${market}.`
      : `Only ${stored} ${stored === 1 ? "company" : "companies"} matched these filters in ${market}.`
  const skipped = [
    skippedNoDomain > 0 ? `${skippedNoDomain} had no website` : null,
    skippedSuppressed > 0 ? `${skippedSuppressed} are on the suppression list` : null,
  ].filter(Boolean)
  const skippedText = skipped.length > 0 ? ` Skipped: ${skipped.join(", ")}.` : ""
  return `${head}${skippedText} Try widening the region or the segment's size band.`
}

/**
 * Stage 4 (GTM_DISCOVERY_MODE=database): one company-database search built from
 * the segment's filters and the campaign's target market. No Firecrawl calls and
 * no LLM fallback; whatever the provider returns is all that gets stored.
 */
export async function executeFindCompaniesFromDatabase(
  outreachCampaignId: string
): Promise<FindCompaniesResult> {
  const [context] = await db
    .select({ campaign: gtmOutreachCampaign, segment: gtmIcpSegment, researchRun: gtmResearchRun })
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

  // Segments from before database mode have no keyword tags; the name is the best filter left.
  const keywords = segment.targetKeywords?.length ? segment.targetKeywords : [segment.name]
  const headcountRange =
    segment.headcountMin != null && segment.headcountMax != null
      ? { min: segment.headcountMin, max: segment.headcountMax }
      : null
  const limit = getMaxCompaniesPerRun()

  const provider = getCompanyDiscoveryProvider()
  const result = await provider.searchCompanies(
    { country, state: region, keywords, headcountRange, limit },
    {
      organizationId: researchRun.organizationId,
      researchRunId: researchRun.id,
      campaignId: outreachCampaignId,
    }
  )
  await touchCampaignProgress(outreachCampaignId)

  const ownDomain = extractDomain(researchRun.websiteUrl)
  const seenDomains = new Set<string>()
  let skippedNoDomain = 0
  let skippedSuppressed = 0
  const accepted: Array<NormalizedCompany & { domain: string }> = []

  for (const company of result.companies) {
    const domain = company.domain
    if (!domain) {
      skippedNoDomain++
      continue
    }
    if (domain === ownDomain || seenDomains.has(domain)) continue
    seenDomains.add(domain)
    if (await checkSuppression({ domain })) {
      skippedSuppressed++
      continue
    }
    accepted.push({ ...company, domain })
  }

  const insertedCompanies: ProspectCompanyData[] = []
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
        employeeCountLabel: `${company.headcount.toLocaleString("en-US")} employees (${company.source})`,
      })
    }
    insertedCompanies.push({
      id: inserted.id,
      name: inserted.name,
      domain: inserted.domain,
      description: inserted.description,
    })
  }

  const discoveryNote = buildDiscoveryNote({
    stored: insertedCompanies.length,
    requested: limit,
    market,
    skippedNoDomain,
    skippedSuppressed,
  })

  await advanceCampaign(outreachCampaignId, "find_companies", {
    currentStage: "find_contacts",
    discoveryNote,
  })

  await safeRealtimePublish(outreachCampaignChannel(outreachCampaignId).completed, {
    stage: "find_companies",
    summary: discoveryNote ?? `Found ${insertedCompanies.length} companies in ${market}.`,
  })

  return { companies: insertedCompanies }
}
