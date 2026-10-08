import { inngest, outreachCampaignChannel, type GtmEvents } from "../client"
import { db } from "@/utils/db"
import {
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmProspectCompany,
  gtmContact,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import {
  scrapeUrl,
  searchFirecrawl,
  FirecrawlRateLimitError,
} from "@/lib/firecrawl"
import { deriveTargetJobFunction } from "@/lib/gtm-ai"
import {
  checkDomainMxRecords,
  generateEmailGuesses,
  extractEmailsFromText,
} from "@/lib/dns-lookup"
import { findProfessionalEmail } from "@/lib/enrich"
import { checkCreditAllowance, recordCreditUsage } from "@/lib/ai/credits"
import {
  TeamCandidate,
  parseTeamFromMarkdown,
  parseCandidatesFromSnippets,
  selectMatchingDecisionMaker,
} from "@/lib/gtm-contact-matcher"
import { safeRealtimePublish, type InngestStep } from "./shared"

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

type EmailSource =
  | "found_on_site"
  | "enrich_verified"
  | "pattern_guessed_mx_valid"
  | "pattern_guessed_unverified"
  | "company_fallback"
  | "none"
type EnrichMetadata = NonNullable<typeof gtmContact.$inferInsert.enrichMetadata>

/** Isolated Stage-5 enrichment decision, with injectable dependencies for fallback tests. */
export async function enrichStage5Email({
  email,
  emailSource,
  personName,
  domain,
  organizationId,
  step,
  checkCredits = checkCreditAllowance,
  recordUsage = recordCreditUsage,
  finder = findProfessionalEmail,
}: {
  email: string | null
  emailSource: EmailSource
  personName: string
  domain: string
  organizationId: string
  step?: InngestStep
  checkCredits?: typeof checkCreditAllowance
  recordUsage?: typeof recordCreditUsage
  finder?: typeof findProfessionalEmail
}): Promise<{
  email: string | null
  emailSource: EmailSource
  enrichMetadata: EnrichMetadata | null
}> {
  if (!personName.includes(" ") || !process.env.ENRICH_API_KEY)
    return { email, emailSource, enrichMetadata: null }
  try {
    const creditCheck = await checkCredits(organizationId, "search", 10)
    if (!creditCheck.allowed)
      return { email, emailSource, enrichMetadata: null }
    await recordUsage({
      organizationId,
      toolName: "enrich.email-finder",
      metadata: { domain, contactName: personName },
      units: 10,
    })
    const enrich = await finder(personName, domain, {
      step,
      stepPrefix: `stage5-enrich-${domain}`,
    })
    if (
      !enrich ||
      enrich.confidence.toLowerCase() === "low" ||
      enrich.isCatchAll
    )
      return { email, emailSource, enrichMetadata: null }
    return {
      email: enrich.email,
      emailSource: "enrich_verified",
      enrichMetadata: {
        confidence: enrich.confidence,
        isCatchAll: enrich.isCatchAll,
        provider: enrich.provider,
        message: enrich.message,
        requestId: enrich.requestId,
        creditsUsed: enrich.creditsUsed,
        creditsRemaining: enrich.creditsRemaining,
        processingTimeMs: enrich.processingTimeMs,
      },
    }
  } catch (error) {
    console.warn(
      `[Stage 5] enrich.so lookup skipped for ${domain}:`,
      (error as Error).message
    )
    return { email, emailSource, enrichMetadata: null }
  }
}

/**
 * Stage 5 Execution Logic: Find Contacts & Decision-Makers
 */
export async function executeFindContacts(
  outreachCampaignId: string,
  step?: InngestStep
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
  let rateLimitedCalls = 0

  for (const comp of companies) {
    let personName = ""
    let personTitle = targetRole.jobFunctions[0] || "Leader"
    let linkedinUrl: string | null = null

    const cleanCompanyName = comp.name
      .replace(/\s*[-–|:].*$/, "")
      .replace(/\s+(Inc|LLC|PLLC|Services|Platform|Practice)$/i, "")
      .trim()

    const candidates: TeamCandidate[] = []

    // 1. Search site's own team/about page
    try {
      const teamQ = `site:${comp.domain} "team" OR "leadership" OR "founder" OR "clinical" OR "director"`
      const teamResults = await searchFirecrawl(teamQ, 2, {
        step,
        stepPrefix: `stage5-team-q-${comp.id}`,
      })

      const teamResult = teamResults.find((r) =>
        /(team|about|leadership|providers|staff|people)/i.test(r.url)
      )
      if (teamResult) {
        try {
          let targetUrl = teamResult.url
          try {
            const parsed = new URL(teamResult.url)
            const segments = parsed.pathname.split("/").filter(Boolean)
            if (
              segments.length >= 2 &&
              /(our-team|team|about|leadership|staff|providers)/i.test(
                segments[0]
              )
            ) {
              targetUrl = `${parsed.origin}/${segments[0]}/`
            }
          } catch {
            // keep targetUrl
          }
          const scraped = await scrapeUrl(targetUrl, {
            step,
            stepPrefix: `stage5-team-scrape-${comp.id}`,
          })
          if (scraped.markdown) {
            const parsedMembers = parseTeamFromMarkdown(scraped.markdown)
            candidates.push(...parsedMembers)
          }
        } catch (scrapeErr) {
          if (scrapeErr instanceof FirecrawlRateLimitError) {
            rateLimitedCalls++
          }
        }
      }

      candidates.push(
        ...parseCandidatesFromSnippets(teamResults, "site_search_snippet")
      )
    } catch (err) {
      if (err instanceof FirecrawlRateLimitError) {
        rateLimitedCalls++
        console.warn(
          `[Stage 5] Team search for ${comp.domain} hit rate limit after retries.`
        )
      }
    }

    // 2. Search LinkedIn snippet
    try {
      const searchQ = `"${cleanCompanyName || comp.domain}" ${targetRole.searchKeyword} site:linkedin.com/in`
      const liPeople = await searchFirecrawl(searchQ, 2, {
        step,
        stepPrefix: `stage5-li-${comp.id}`,
      })
      candidates.push(
        ...parseCandidatesFromSnippets(liPeople, "linkedin_snippet")
      )
    } catch (err) {
      if (err instanceof FirecrawlRateLimitError) {
        rateLimitedCalls++
        console.warn(
          `[Stage 5] LinkedIn snippet search for ${comp.name} hit rate limit after retries.`
        )
      }
    }

    const bestMatch = selectMatchingDecisionMaker(
      candidates,
      targetRole.jobFunctions
    )

    if (bestMatch) {
      personName = bestMatch.candidate.name
      personTitle = bestMatch.candidate.title
      linkedinUrl = bestMatch.candidate.url || null
    } else {
      personName = `${targetRole.jobFunctions[0]}`
      personTitle = targetRole.jobFunctions[0]
    }

    // Email-finding chain:
    let resolvedEmail: string | null = null
    let emailSource:
      | "found_on_site"
      | "enrich_verified"
      | "pattern_guessed_mx_valid"
      | "pattern_guessed_unverified"
      | "company_fallback"
      | "none" = "none"
    let enrichMetadata: {
      confidence?: string
      isCatchAll?: boolean
      provider?: string
      message?: string
      requestId?: string
      creditsUsed?: number
      creditsRemaining?: number
      processingTimeMs?: number
    } | null = null

    // Step a: Scrape Contact / About page
    try {
      const siteScrape = await scrapeUrl(`https://${comp.domain}`, {
        step,
        stepPrefix: `stage5-contact-scrape-${comp.id}`,
      })
      const extracted = extractEmailsFromText(
        siteScrape.markdown || "",
        comp.domain
      )
      if (extracted.length > 0) {
        const firstName = personName.split(" ")[0].toLowerCase()
        const matching = extracted.find((e) => e.includes(firstName))
        if (matching) {
          resolvedEmail = matching
          emailSource = "found_on_site"
        }
      }
    } catch (e) {
      if (e instanceof FirecrawlRateLimitError) {
        rateLimitedCalls++
      }
    }

    // Step b: Pattern guess + MX verification
    if (!resolvedEmail && personName.includes(" ")) {
      const guesses = generateEmailGuesses(personName, comp.domain)
      if (guesses.length > 0) {
        const hasMx = await checkDomainMxRecords(comp.domain)
        resolvedEmail = guesses[0]
        emailSource = hasMx
          ? "pattern_guessed_mx_valid"
          : "pattern_guessed_unverified"
      }
    }

    // Step c: paid enrich.so verification, layered over the completed free chain.
    ;({
      email: resolvedEmail,
      emailSource,
      enrichMetadata,
    } = await enrichStage5Email({
      email: resolvedEmail,
      emailSource,
      personName,
      domain: comp.domain,
      organizationId: researchRun.organizationId,
      step,
    }))

    // Step d: Company-level fallback (info@/hello@/contact@)
    if (!resolvedEmail) {
      const hasMx = await checkDomainMxRecords(comp.domain)
      if (hasMx) {
        resolvedEmail = `contact@${comp.domain}`
        emailSource = "company_fallback"
      }
    }

    const [contact] = await db
      .insert(gtmContact)
      .values({
        prospectCompanyId: comp.id,
        name: personName,
        title: personTitle,
        linkedinUrl,
        email: resolvedEmail,
        emailSource,
        verificationStatus: emailSource === "none" ? "unverified" : emailSource,
        enrichMetadata,
        geo: "United States",
      })
      .returning()

    insertedContacts.push({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      email: contact.email,
      emailSource: contact.emailSource,
      companyId: comp.id,
      companyName: comp.name,
      companyDescription: comp.description,
    })
  }

  await db
    .update(gtmOutreachCampaign)
    .set({ currentStage: "write_emails" })
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId))

  const rateLimitSummary =
    rateLimitedCalls > 0
      ? `contact discovery hit rate limits on ${rateLimitedCalls} queries/scrapes`
      : undefined

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

/**
 * Inngest Function: Stage 5 - Find Contacts
 */
export const findContactsFunction = inngest.createFunction(
  {
    id: "gtm-stage-5-find-contacts",
    name: "GTM Stage 5: Find Decision-Makers",
    triggers: [{ event: "gtm/campaign.find_contacts" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/campaign.find_contacts"]
    step: InngestStep
  }) => {
    const { outreachCampaignId } = event.data

    const result = await executeFindContacts(outreachCampaignId, step)

    // Automatically trigger Stage 6: Write Emails
    await step.sendEvent("trigger-stage-6-write-emails", {
      name: "gtm/campaign.write_emails",
      data: { outreachCampaignId },
    })

    return result
  }
)
