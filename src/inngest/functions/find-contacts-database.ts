import { and, eq } from "drizzle-orm"
import { outreachCampaignChannel } from "../client"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"
import {
  advanceCampaign,
  touchCampaignProgress,
} from "@/lib/pipeline/stage-state"
import { deriveTargetJobFunction } from "@/lib/gtm-ai"
import { countryNameFromCode } from "@/lib/geo/countries"
import { getDecisionMakersPerCompany } from "@/lib/providers/config"
import { getPeopleDiscoveryProvider } from "@/lib/providers/registry"
import { safeRealtimePublish } from "./shared"
import type { ContactData, FindContactsResult } from "./find-contacts"

/**
 * Stage 5 (GTM_DISCOVERY_MODE=database): decision makers for the companies the
 * user kept at the selection gate. Names, titles, LinkedIn URLs and locations
 * come only from the people provider; no Firecrawl, no LLM title-guessing, no
 * email lookups (every stored person has emailStatus `not_looked_up`). Companies
 * with nobody found are marked `no_decision_maker_found`, never dropped.
 *
 * Email lookup does not exist yet, so the campaign stops at `done_for_now`
 * instead of moving on to drafting.
 */
export async function executeFindContactsFromDatabase(
  outreachCampaignId: string
): Promise<FindContactsResult> {
  const [context] = await db
    .select({
      campaign: gtmOutreachCampaign,
      segment: gtmIcpSegment,
      researchRun: gtmResearchRun,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmIcpSegment,
      eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
    )
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId))
  if (!context)
    throw new Error(`Outreach campaign ${outreachCampaignId} not found`)
  const { campaign, segment, researchRun } = context

  // Fail before any LLM call when no people provider can serve this mode.
  const provider = getPeopleDiscoveryProvider()

  const countryCode =
    campaign.targetCountryCode ?? researchRun.targetCountryCode
  const region = campaign.targetCountryCode
    ? campaign.targetRegion
    : researchRun.targetRegion
  const country = countryNameFromCode(countryCode)
  if (!country) {
    throw Object.assign(new Error("Campaign has no target country"), {
      failureReason: "target_country_missing",
    })
  }

  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).started,
    {
      stage: "find_contacts",
      message: "Finding decision makers at the selected companies...",
    }
  )
  await touchCampaignProgress(outreachCampaignId)

  const companies = await db
    .select()
    .from(gtmProspectCompany)
    .where(
      and(
        eq(gtmProspectCompany.outreachCampaignId, outreachCampaignId),
        eq(gtmProspectCompany.selectionStatus, "selected")
      )
    )

  // A restarted stage starts clean for the companies it owns.
  for (const company of companies) {
    await db
      .delete(gtmContact)
      .where(eq(gtmContact.prospectCompanyId, company.id))
  }

  // Existing role derivation: which job titles buy for this segment.
  const role = await deriveTargetJobFunction({
    segmentName: segment.name,
    painPoint: segment.painPoint,
    criteria: segment.criteria,
  })
  const titles = role.jobFunctions.filter(Boolean)
  const perCompany = getDecisionMakersPerCompany()
  const spend = {
    organizationId: researchRun.organizationId,
    researchRunId: researchRun.id,
    campaignId: outreachCampaignId,
  }

  const contacts: ContactData[] = []
  let companiesWithNobody = 0

  for (const company of companies) {
    await touchCampaignProgress(outreachCampaignId)
    const { people } = await provider.findDecisionMakers(
      {
        company: {
          name: company.name,
          domain: company.domain,
          providerId: company.providerId,
        },
        titles,
        country,
        state: region,
        limit: perCompany,
      },
      spend
    )

    for (const person of people) {
      const [row] = await db
        .insert(gtmContact)
        .values({
          prospectCompanyId: company.id,
          name: `${person.firstName} ${person.lastName}`.trim(),
          title: person.title ?? "",
          linkedinUrl: person.linkedinUrl,
          email: null,
          emailSource: "none",
          verificationStatus: "unverified",
          geo: person.location,
          source: person.source,
          providerPersonId: person.providerPersonId,
          emailStatus: "not_looked_up",
        })
        .returning()
      contacts.push({
        id: row.id,
        name: row.name,
        title: row.title,
        email: null,
        emailSource: row.emailSource,
        companyId: company.id,
        companyName: company.name,
        companyDescription: company.description,
      })
    }

    if (people.length === 0) companiesWithNobody++
    await db
      .update(gtmProspectCompany)
      .set({
        decisionMakerStatus:
          people.length > 0 ? "found" : "no_decision_maker_found",
      })
      .where(eq(gtmProspectCompany.id, company.id))
  }

  await advanceCampaign(outreachCampaignId, "find_contacts", {
    currentStage: "done_for_now",
    status: "done_for_now",
  })

  const found = companies.length - companiesWithNobody
  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).completed,
    {
      stage: "find_contacts",
      summary: `Found ${contacts.length} decision ${contacts.length === 1 ? "maker" : "makers"} at ${found} of ${companies.length} selected companies.`,
    }
  )

  return { contacts }
}
