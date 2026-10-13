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
import {
  scrapeUrl,
  searchFirecrawl,
  FirecrawlRateLimitError,
  FirecrawlCallCapExceededError,
  FirecrawlSpendPausedError,
  isAggregatorOrReviewDomain,
} from "@/lib/firecrawl"
import { checkSuppression, recordSuppressionEntry } from "@/lib/gtm-suppression"
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
  isValidPersonName,
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
  let rateLimitedCalls = 0

  const runContext = {
    campaignId: outreachCampaignId,
    organizationId: researchRun.organizationId,
  }

  for (const comp of companies) {
    await touchCampaignProgress(outreachCampaignId)
    const cleanCompanyName = comp.name
      .replace(/\s*[-–|:].*$/, "")
      .replace(/\s+(Inc|LLC|PLLC|Services|Platform|Practice)$/i, "")
      .trim()

    // 0. Platform-Wide Domain Suppression & Aggregator Check
    const domainSuppressed = await checkSuppression({ domain: comp.domain })
    const isAggregator = isAggregatorOrReviewDomain(comp.domain)

    if (domainSuppressed || isAggregator) {
      if (isAggregator && !domainSuppressed) {
        await recordSuppressionEntry({
          email: null,
          domain: comp.domain,
          reason: "aggregator_domain",
          sourceOrgId: researchRun.organizationId,
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
      continue
    }

    let personName = ""
    let personTitle = targetRole.jobFunctions[0] || "Leader"
    let linkedinUrl: string | null = null

    const candidates: TeamCandidate[] = []

    // 1. Search site's own team/about page
    try {
      const teamQ = `site:${comp.domain} "team" OR "leadership" OR "founder" OR "clinical" OR "director"`
      const teamResults = await searchFirecrawl(teamQ, 2, {
        step,
        stepPrefix: `stage5-team-q-${comp.id}`,
        maxRetries: 1,
        runContext,
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
            runContext,
          })
          if (scraped.markdown) {
            const parsedMembers = parseTeamFromMarkdown(scraped.markdown)
            candidates.push(...parsedMembers)
          }
        } catch (scrapeErr) {
          if (
            scrapeErr instanceof FirecrawlCallCapExceededError ||
            scrapeErr instanceof FirecrawlSpendPausedError
          ) {
            throw scrapeErr
          }
          if (scrapeErr instanceof FirecrawlRateLimitError) {
            rateLimitedCalls++
          }
        }
      }

      candidates.push(
        ...parseCandidatesFromSnippets(teamResults, "site_search_snippet")
      )
    } catch (err) {
      if (
        err instanceof FirecrawlCallCapExceededError ||
        err instanceof FirecrawlSpendPausedError
      ) {
        throw err
      }
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
        maxRetries: 1,
        runContext,
      })
      candidates.push(
        ...parseCandidatesFromSnippets(liPeople, "linkedin_snippet")
      )
    } catch (err) {
      if (
        err instanceof FirecrawlCallCapExceededError ||
        err instanceof FirecrawlSpendPausedError
      ) {
        throw err
      }
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

    if (bestMatch && isValidPersonName(bestMatch.candidate.name)) {
      personName = bestMatch.candidate.name
      personTitle = bestMatch.candidate.title
      linkedinUrl = bestMatch.candidate.url || null
    } else {
      personName = `${cleanCompanyName} Team`
      personTitle = targetRole.jobFunctions[0] || "Leadership"
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
        runContext,
      })
      const extracted = extractEmailsFromText(
        siteScrape.markdown || "",
        comp.domain
      )
      if (extracted.length > 0 && isValidPersonName(personName)) {
        const firstName = personName.split(" ")[0].toLowerCase()
        const matching = extracted.find((e) => e.includes(firstName))
        if (matching) {
          resolvedEmail = matching
          emailSource = "found_on_site"
        }
      }
    } catch (e) {
      if (
        e instanceof FirecrawlCallCapExceededError ||
        e instanceof FirecrawlSpendPausedError
      ) {
        throw e
      }
      if (e instanceof FirecrawlRateLimitError) {
        rateLimitedCalls++
      }
    }

    // Step b: Pattern guess + MX verification (only for validated human names)
    if (!resolvedEmail && isValidPersonName(personName)) {
      const guesses = generateEmailGuesses(personName, comp.domain)
      if (guesses.length > 0) {
        const candidateEmail = guesses[0]
        const suppressed = await checkSuppression({
          email: candidateEmail,
          domain: comp.domain,
        })

        if (suppressed) {
          console.log(
            `[Stage 5] Contact ${candidateEmail} is previously suppressed (${suppressed.reason}). Skipping MX check and enrich.so lookup.`
          )
          resolvedEmail = candidateEmail
          emailSource = "none"
        } else {
          const hasMx = await checkDomainMxRecords(comp.domain)
          resolvedEmail = candidateEmail
          if (!hasMx) {
            await recordSuppressionEntry({
              email: candidateEmail,
              domain: comp.domain,
              reason: "mx_invalid",
              sourceOrgId: researchRun.organizationId,
              rawSnippet: `MX check failed for ${comp.domain}`,
            })
          }
          emailSource = hasMx
            ? "pattern_guessed_mx_valid"
            : "pattern_guessed_unverified"
        }
      }
    }

    // Step c: paid enrich.so verification, layered over the completed free chain.
    const isSuppressedForEnrich = resolvedEmail
      ? await checkSuppression({ email: resolvedEmail, domain: comp.domain })
      : null

    if (!isSuppressedForEnrich && emailSource !== "none") {
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
    } else if (isSuppressedForEnrich) {
      console.log(
        `[Stage 5] Skipping enrich.so for ${resolvedEmail} — contact is previously suppressed (${isSuppressedForEnrich.reason}).`
      )
    }

    // Step d: Company-level fallback (info@/hello@/contact@)
    if (!resolvedEmail) {
      const fallbackEmail = `contact@${comp.domain}`
      const fallbackSuppressed = await checkSuppression({
        email: fallbackEmail,
        domain: comp.domain,
      })

      if (fallbackSuppressed) {
        console.log(
          `[Stage 5] Fallback contact ${fallbackEmail} is previously suppressed (${fallbackSuppressed.reason}). Skipping MX check.`
        )
        resolvedEmail = fallbackEmail
        emailSource = "none"
      } else {
        const hasMx = await checkDomainMxRecords(comp.domain).catch(() => false)
        resolvedEmail = fallbackEmail
        emailSource = hasMx ? "company_fallback" : "pattern_guessed_unverified"
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

  await advanceCampaign(outreachCampaignId, "find_contacts", {
    currentStage: "write_emails",
  })

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
