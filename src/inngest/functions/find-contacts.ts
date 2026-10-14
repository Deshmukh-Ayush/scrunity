import { outreachCampaignChannel } from "../client"
import { db } from "@/utils/db"
import {
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmProspectCompany,
  gtmContact,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { advanceCampaign, touchCampaignProgress } from "@/lib/pipeline/stage-state"
import { isAggregatorOrReviewDomain } from "@/lib/firecrawl"
import { checkSuppression, recordSuppressionEntry } from "@/lib/gtm-suppression"
import { deriveTargetJobFunction } from "@/lib/gtm-ai"
import { enrichStage5Email, resolveContactEmail } from "./find-contacts-email"
import {
  type CompanyLookup,
  type LookupOptions,
  cleanCompanyNameOf,
  newCompanyLookup,
  pickDecisionMaker,
  retryIncompleteLookups,
  runLookupParts,
} from "./find-contacts-lookup"
import { safeRealtimePublish, type InngestStep } from "./shared"
import { getDiscoveryMode } from "@/lib/providers/config"
import { executeFindContactsFromDatabase } from "./find-contacts-database"

export { enrichStage5Email }

export interface ContactData {
  id: string
  name: string
  title: string
  email: string | null
  emailSource: string
  companyId: string
  companyName: string
  companyDescription: string
}

export interface FindContactsResult {
  contacts: ContactData[]
  rateLimitSummary?: string
}

/**
 * Stage 5 Execution Logic: Find Contacts & Decision-Makers
 */
export async function executeFindContacts(
  outreachCampaignId: string,
  step?: InngestStep
): Promise<FindContactsResult> {
  if (getDiscoveryMode() === "database") {
    return executeFindContactsFromDatabase(outreachCampaignId)
  }

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

  if (!context) {
    throw new Error(`Outreach campaign ${outreachCampaignId} not found`)
  }

  const { segment, researchRun } = context

  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).started,
    {
      stage: "find_contacts",
      message: "Searching decision-makers and verifying email patterns...",
    }
  )

  await db
    .update(gtmOutreachCampaign)
    .set({ lastProgressAt: new Date() })
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId))

  const targetRole = await deriveTargetJobFunction({
    segmentName: segment.name,
    painPoint: segment.painPoint,
    criteria: segment.criteria,
  })

  const companies = await db
    .select()
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, outreachCampaignId))

  const insertedContacts: ContactData[] = []
  const organizationId = researchRun.organizationId
  const lookupOptions: LookupOptions = {
    runContext: { campaignId: outreachCampaignId, organizationId },
    targetRole,
    maxRetries: 1,
  }
  // Lookups that were still rate-limited, with the contact row written for them.
  const incompleteLookups: Array<{ lookup: CompanyLookup; contactId: string; personName: string }> = []
  let rateLimitedCalls = 0

  for (const comp of companies) {
    await touchCampaignProgress(outreachCampaignId)
    const cleanCompanyName = cleanCompanyNameOf(comp.name)

    // 0. Platform-Wide Domain Suppression & Aggregator Check
    const domainSuppressed = await checkSuppression({ domain: comp.domain })
    const isAggregator = isAggregatorOrReviewDomain(comp.domain)

    if (domainSuppressed || isAggregator) {
      if (isAggregator && !domainSuppressed) {
        await recordSuppressionEntry({
          email: null,
          domain: comp.domain,
          reason: "aggregator_domain",
          sourceOrgId: organizationId,
          rawSnippet: `Aggregator domain ${comp.domain}`,
        })
      }
      console.log(
        `[Stage 5] Domain ${comp.domain} is suppressed (${domainSuppressed?.reason || "aggregator_domain"}). Skipping external Firecrawl and enrich.so lookups.`
      )
      const [contact] = await db
        .insert(gtmContact)
        .values({
          prospectCompanyId: comp.id,
          name: `${cleanCompanyName} Team`,
          title: targetRole.jobFunctions[0] || "Leadership",
          linkedinUrl: null,
          email: null,
          emailSource: "none",
          verificationStatus: "unverified",
          enrichMetadata: null,
          geo: "United States",
        })
        .returning()
      insertedContacts.push(toContactData(contact, comp))
      continue
    }

    // 1-2. Firecrawl lookups: team page, LinkedIn snippets, homepage (for emails).
    const lookup = newCompanyLookup(comp)
    await runLookupParts(lookup, lookupOptions)
    rateLimitedCalls += lookup.rateLimitedCalls
    const person = pickDecisionMaker(lookup, targetRole.jobFunctions)

    // 3. Email chain (on-site match, pattern + MX, enrich.so, company fallback).
    const email = await resolveContactEmail({
      person,
      domain: comp.domain,
      siteMarkdown: lookup.siteMarkdown,
      organizationId,
      step,
    })

    const lookupStatus = lookup.incomplete.size > 0 ? "lookup_incomplete" : "complete"
    const [contact] = await db
      .insert(gtmContact)
      .values({
        prospectCompanyId: comp.id,
        name: person.personName,
        title: person.personTitle,
        linkedinUrl: person.linkedinUrl,
        email: email.email,
        emailSource: email.emailSource,
        verificationStatus: email.emailSource === "none" ? "unverified" : email.emailSource,
        enrichMetadata: email.enrichMetadata,
        geo: "United States",
        lookupStatus,
      })
      .returning()
    insertedContacts.push(toContactData(contact, comp))
    if (lookupStatus === "lookup_incomplete") {
      incompleteLookups.push({ lookup, contactId: contact.id, personName: person.personName })
    }
  }

  // 4. Slower retry pass for lookups that were still rate-limited.
  const recovered = await retryIncompleteLookups(
    incompleteLookups.map((i) => i.lookup),
    lookupOptions,
    () => touchCampaignProgress(outreachCampaignId)
  )
  for (const lookup of recovered) {
    const entry = incompleteLookups.find((i) => i.lookup === lookup)!
    await applyRecoveredLookup({ entry, jobFunctions: targetRole.jobFunctions, organizationId, step })
  }
  const stillIncomplete = incompleteLookups.length - recovered.length

  await advanceCampaign(outreachCampaignId, "find_contacts", {
    currentStage: "write_emails",
  })

  const notes = [
    rateLimitedCalls > 0 ? `contact discovery hit rate limits on ${rateLimitedCalls} lookups` : null,
    recovered.length > 0 ? `${recovered.length} recovered on retry` : null,
    stillIncomplete > 0 ? `${stillIncomplete} left as lookup incomplete` : null,
  ].filter(Boolean)
  const rateLimitSummary = notes.length > 0 ? notes.join(", ") : undefined

  const summary = rateLimitSummary
    ? `Identified ${insertedContacts.length} contacts and completed MX validations (${rateLimitSummary}).`
    : `Identified ${insertedContacts.length} contacts and completed MX validations.`

  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).completed,
    {
      stage: "find_contacts",
      summary,
    }
  )

  return {
    contacts: insertedContacts,
    rateLimitSummary,
  }
}

function toContactData(
  contact: typeof gtmContact.$inferSelect,
  comp: typeof gtmProspectCompany.$inferSelect
): ContactData {
  return {
    id: contact.id,
    name: contact.name,
    title: contact.title,
    email: contact.email,
    emailSource: contact.emailSource,
    companyId: comp.id,
    companyName: comp.name,
    companyDescription: comp.description,
  }
}

/**
 * Updates a contact whose rate-limited lookups completed in the retry pass. The
 * email chain is re-run only if a different person was found, so a paid
 * enrich.so lookup is never repeated for the same person.
 */
async function applyRecoveredLookup({
  entry,
  jobFunctions,
  organizationId,
  step,
}: {
  entry: { lookup: CompanyLookup; contactId: string; personName: string }
  jobFunctions: string[]
  organizationId: string
  step?: InngestStep
}) {
  const person = pickDecisionMaker(entry.lookup, jobFunctions)
  if (person.personName === entry.personName) {
    await db
      .update(gtmContact)
      .set({ lookupStatus: "complete", linkedinUrl: person.linkedinUrl, title: person.personTitle })
      .where(eq(gtmContact.id, entry.contactId))
    return
  }
  const email = await resolveContactEmail({
    person,
    domain: entry.lookup.company.domain,
    siteMarkdown: entry.lookup.siteMarkdown,
    organizationId,
    step,
  })
  await db
    .update(gtmContact)
    .set({
      name: person.personName,
      title: person.personTitle,
      linkedinUrl: person.linkedinUrl,
      email: email.email,
      emailSource: email.emailSource,
      verificationStatus: email.emailSource === "none" ? "unverified" : email.emailSource,
      enrichMetadata: email.enrichMetadata,
      lookupStatus: "complete",
    })
    .where(eq(gtmContact.id, entry.contactId))
}

