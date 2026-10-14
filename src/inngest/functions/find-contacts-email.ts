import { gtmContact } from "@/db/schema"
import {
  checkDomainMxRecords,
  generateEmailGuesses,
  extractEmailsFromText,
} from "@/lib/dns-lookup"
import { findProfessionalEmail } from "@/lib/enrich"
import { checkCreditAllowance, recordCreditUsage } from "@/lib/ai/credits"
import { isValidPersonName } from "@/lib/gtm-contact-matcher"
import { checkSuppression, recordSuppressionEntry } from "@/lib/gtm-suppression"
import type { DecisionMaker } from "./find-contacts-lookup"
import type { InngestStep } from "./shared"

/** Legacy Stage 5 email finding for one decision maker. Makes no Firecrawl calls. */

export type EmailSource =
  | "found_on_site"
  | "enrich_verified"
  | "pattern_guessed_mx_valid"
  | "pattern_guessed_unverified"
  | "company_fallback"
  | "none"
export type EnrichMetadata = NonNullable<typeof gtmContact.$inferInsert.enrichMetadata>

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

/** The Stage 5 email-finding chain for one decision maker (no Firecrawl calls). */
export async function resolveContactEmail({
  person,
  domain,
  siteMarkdown,
  organizationId,
  step,
}: {
  person: DecisionMaker
  domain: string
  siteMarkdown: string
  organizationId: string
  step?: InngestStep
}): Promise<{ email: string | null; emailSource: EmailSource; enrichMetadata: EnrichMetadata | null }> {
  const { personName } = person
  let resolvedEmail: string | null = null
  let emailSource: EmailSource = "none"
  let enrichMetadata: EnrichMetadata | null = null

  // Step a: an address on the scraped homepage that matches the person's first name
  const extracted = extractEmailsFromText(siteMarkdown, domain)
  if (extracted.length > 0 && isValidPersonName(personName)) {
    const firstName = personName.split(" ")[0].toLowerCase()
    const matching = extracted.find((e) => e.includes(firstName))
    if (matching) {
      resolvedEmail = matching
      emailSource = "found_on_site"
    }
  }

  // Step b: Pattern guess + MX verification (only for validated human names)
  if (!resolvedEmail && isValidPersonName(personName)) {
    const guesses = generateEmailGuesses(personName, domain)
    if (guesses.length > 0) {
      const candidateEmail = guesses[0]
      const suppressed = await checkSuppression({ email: candidateEmail, domain })

      if (suppressed) {
        console.log(
          `[Stage 5] Contact ${candidateEmail} is previously suppressed (${suppressed.reason}). Skipping MX check and enrich.so lookup.`
        )
        resolvedEmail = candidateEmail
        emailSource = "none"
      } else {
        const hasMx = await checkDomainMxRecords(domain)
        resolvedEmail = candidateEmail
        if (!hasMx) {
          await recordSuppressionEntry({
            email: candidateEmail,
            domain,
            reason: "mx_invalid",
            sourceOrgId: organizationId,
            rawSnippet: `MX check failed for ${domain}`,
          })
        }
        emailSource = hasMx ? "pattern_guessed_mx_valid" : "pattern_guessed_unverified"
      }
    }
  }

  // Step c: paid enrich.so verification, layered over the completed free chain.
  const isSuppressedForEnrich = resolvedEmail
    ? await checkSuppression({ email: resolvedEmail, domain })
    : null

  if (!isSuppressedForEnrich && emailSource !== "none") {
    ;({ email: resolvedEmail, emailSource, enrichMetadata } = await enrichStage5Email({
      email: resolvedEmail,
      emailSource,
      personName,
      domain,
      organizationId,
      step,
    }))
  } else if (isSuppressedForEnrich) {
    console.log(
      `[Stage 5] Skipping enrich.so for ${resolvedEmail} — contact is previously suppressed (${isSuppressedForEnrich.reason}).`
    )
  }

  // Step d: Company-level fallback (info@/hello@/contact@)
  if (!resolvedEmail) {
    const fallbackEmail = `contact@${domain}`
    const fallbackSuppressed = await checkSuppression({ email: fallbackEmail, domain })

    if (fallbackSuppressed) {
      console.log(
        `[Stage 5] Fallback contact ${fallbackEmail} is previously suppressed (${fallbackSuppressed.reason}). Skipping MX check.`
      )
      resolvedEmail = fallbackEmail
      emailSource = "none"
    } else {
      const hasMx = await checkDomainMxRecords(domain).catch(() => false)
      resolvedEmail = fallbackEmail
      emailSource = hasMx ? "company_fallback" : "pattern_guessed_unverified"
    }
  }

  return { email: resolvedEmail, emailSource, enrichMetadata }
}
