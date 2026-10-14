import { and, asc, eq, inArray } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  type LeadSearchOutcome,
} from "@/db/schema"
import { deriveTargetJobFunction } from "@/lib/gtm-ai"
import { countryNameFromCode } from "@/lib/geo/countries"
import { checkLinkedInProfileGate } from "@/lib/gtm-qualification-gates"
import { isValidPersonName, scoreTitleMatch } from "@/lib/gtm-contact-matcher"
import { checkSuppression } from "@/lib/gtm-suppression"
import { isAggregatorOrReviewDomain } from "@/lib/firecrawl"
import { RETRY_PASS_COOLDOWN_MS } from "@/inngest/functions/find-contacts-lookup"
import { getEmailEnrichmentProvider, getLeadSearchPeopleProvider } from "@/lib/providers/registry"
import type {
  EmailEnrichmentProvider,
  NormalizedPerson,
  PeopleDiscoveryProvider,
} from "@/lib/providers/types"
import { LeadSearchStop, ledgerVendor, lookupContactEmail } from "./email-lookup"
import { leadSearchBudget, type LeadSearchBudget, type LeadSearchStopReason } from "./lead-search-budget"
import { touchCampaignProgress } from "./stage-state"
import { getCampaignVendorCredits } from "@/lib/providers/vendor-usage"

type Company = typeof gtmProspectCompany.$inferSelect
type Contact = typeof gtmContact.$inferSelect

/** Injectable for scripts: stub providers, fixed titles, short polling. */
export interface LeadSearchDeps {
  people?: PeopleDiscoveryProvider
  email?: EmailEnrichmentProvider
  titles?: string[]
  budget?: Partial<LeadSearchBudget> & { pollIntervalMs?: number }
  /** Skip the one-minute cooldown before retrying rate-limited people lookups. */
  retryCooldownMs?: number
  log?: (line: string) => void
}

/**
 * Stage 5: find up to N leads whose email a vendor verified at mailbox level.
 *
 * Companies are taken in Stage 4 order (best fit first). For each, decision
 * makers come from the people provider, best title match first; each gets at
 * most one email lookup. A verified address is accepted and counted; otherwise
 * the next person is tried (up to GTM_MAX_CANDIDATES_PER_COMPANY), then the next
 * company. The search stops at the target or at the first exhausted budget,
 * keeping what it found, and never invents or guesses an address.
 *
 * Restart-safe: every person tried is stored before their lookup, with the
 * vendor job ref saved before polling, so a restart, retry or second trigger
 * resumes those jobs and never looks anyone up (or pays) twice. Companies
 * already settled keep their decisionMakerStatus and are skipped.
 */
export async function executeVerifiedLeadSearch(campaignId: string, deps: LeadSearchDeps = {}) {
  const startedAt = Date.now()
  const log = deps.log ?? ((line: string) => console.log(`[Lead search ${campaignId}] ${line}`))
  const [ctx] = await db
    .select({ campaign: gtmOutreachCampaign, segment: gtmIcpSegment, researchRun: gtmResearchRun })
    .from(gtmOutreachCampaign)
    .innerJoin(gtmIcpSegment, eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id))
    .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
    .where(eq(gtmOutreachCampaign.id, campaignId))
  if (!ctx) throw new Error(`Outreach campaign ${campaignId} not found`)
  const { campaign, segment, researchRun } = ctx

  // Both fail the stage with a plain reason before any spend; no guessing fallback.
  const email = deps.email ?? getEmailEnrichmentProvider()
  const people = deps.people ?? getLeadSearchPeopleProvider()
  const budget = leadSearchBudget(campaign.targetVerifiedLeads, startedAt, deps.budget)
  const spend = { organizationId: researchRun.organizationId, researchRunId: researchRun.id, campaignId }
  const heartbeat = () => touchCampaignProgress(campaignId)
  await heartbeat()

  const titles =
    deps.titles ??
    (await deriveTargetJobFunction({
      segmentName: segment.name,
      painPoint: segment.painPoint,
      criteria: segment.criteria,
    })).jobFunctions.filter(Boolean)
  const countryCode = campaign.targetCountryCode ?? researchRun.targetCountryCode
  const country = countryNameFromCode(countryCode) ?? ""
  const region = campaign.targetCountryCode ? campaign.targetRegion : researchRun.targetRegion

  const companies = await db
    .select()
    .from(gtmProspectCompany)
    .where(and(eq(gtmProspectCompany.outreachCampaignId, campaignId), eq(gtmProspectCompany.selectionStatus, "selected")))
    .orderBy(asc(gtmProspectCompany.createdAt))
  const loadContacts = async (): Promise<Contact[]> =>
    companies.length
      ? db.select().from(gtmContact).where(inArray(gtmContact.prospectCompanyId, companies.map((c) => c.id)))
      : []
  let existing = await loadContacts()

  const state = {
    verified: existing.filter((c) => c.emailStatus === "verified").length,
    lookups: existing.filter((c) => c.emailLookupRef || (c.emailStatus && c.emailStatus !== "not_looked_up")).length,
    examined: companies.filter((c) => c.decisionMakerStatus).length,
    stop: null as LeadSearchStopReason | null,
  }
  const lookupOf = (contact: Contact, company: Company) => ({
    contactId: contact.id,
    input: {
      firstName: contact.name.split(/\s+/)[0],
      lastName: contact.name.split(/\s+/).slice(1).join(" "),
      domain: company.domain,
      companyName: company.name,
      linkedinUrl: contact.linkedinUrl,
    },
    provider: email,
    spend,
    timing: budget.timing,
    heartbeat,
  })
  const onStop = (err: unknown) => {
    if (!(err instanceof LeadSearchStop)) throw err
    state.stop ??= err.stopReason as LeadSearchStopReason
    log(`stopping: ${err.stopReason} (${err.message})`)
  }

  /**
   * Finishes lookups an earlier pass or attempt left open: a started vendor job
   * is polled again (already paid for, polling is free); a lookup that was
   * rate-limited before it was submitted is submitted now, within budget.
   */
  async function resumeOpenLookups(contacts: Contact[]) {
    const open = contacts.filter(
      (c) =>
        (c.emailLookupRef && (!c.emailStatus || c.emailStatus === "not_looked_up")) ||
        (!c.emailLookupRef && c.lookupStatus === "lookup_incomplete")
    )
    for (const contact of open) {
      if (state.stop || state.verified >= budget.target || Date.now() >= budget.timing.deadline) break
      const company = companies.find((c) => c.id === contact.prospectCompanyId)!
      if (!contact.emailLookupRef) {
        if (state.lookups >= budget.maxEmailLookups) {
          state.stop ??= "email_run_budget"
          break
        }
        state.lookups++
      }
      log(`resuming lookup for ${contact.name} (${company.domain})`)
      try {
        const outcome = await lookupContactEmail({
          ...lookupOf(contact, company),
          existing: contact.emailLookupRef
            ? { ref: contact.emailLookupRef, metadata: contact.enrichMetadata as never }
            : undefined,
        })
        if (outcome.kind === "done" && outcome.result.status === "verified") {
          state.verified++
          await setCompanyStatus(company.id, "found")
        }
      } catch (err) {
        onStop(err)
      }
    }
  }

  // 1. Lookups a previous attempt (restart, retry, crash) left open.
  await resumeOpenLookups(existing)
  existing = await loadContacts()

  // 2. Companies in fit order, a few at a time. Each company yields at most one
  // verified lead, and no more companies run than leads still needed, so the
  // search never pays for leads beyond the target.
  const deferred: Company[] = []
  const pending = companies.filter((c) => !c.decisionMakerStatus)

  async function processCompany(company: Company, patient = false) {
    await heartbeat()
    const tried = existing.filter((c) => c.prospectCompanyId === company.id)
    if (tried.some((c) => c.emailStatus === "verified")) return setCompanyStatus(company.id, "found")
    // Directories and review sites: their "people" work elsewhere. No search, no lookup.
    if (isAggregatorOrReviewDomain(company.domain)) {
      log(`${company.domain}: aggregator or review site, skipped`)
      return setCompanyStatus(company.id, "no_decision_maker_found")
    }
    let found: { people: NormalizedPerson[]; incomplete?: boolean }
    try {
      found = await people.findDecisionMakers(
        {
          company: { name: company.name, domain: company.domain, providerId: company.providerId },
          titles,
          country,
          state: region,
          limit: budget.maxCandidatesPerCompany * 2,
          patient,
        },
        spend
      )
    } catch (err) {
      const reason = (err as { failureReason?: string }).failureReason
      if (reason?.startsWith("firecrawl_") || reason === "paused_firecrawl_allotment_exhausted") {
        throw new LeadSearchStop("people_search_failed", (err as Error).message)
      }
      throw err
    }
    if (found.people.length === 0) {
      if (found.incomplete && !patient) return void deferred.push(company)
      if (found.incomplete) {
        // Still rate-limited after the patient retry: unknown, not "nobody".
        // Left unsettled, so a restart searches this company again.
        log(`${company.domain}: people lookup still rate-limited, left for a later attempt`)
        return
      }
      log(`${company.domain}: nobody found`)
      return setCompanyStatus(company.id, "no_decision_maker_found")
    }

    const ranked = [...found.people].sort(
      (a, b) => scoreTitleMatch(b.title ?? "", titles).score - scoreTitleMatch(a.title ?? "", titles).score
    )
    let lookupsHere = tried.filter((c) => c.emailLookupRef || c.emailStatus === "not_found" || c.emailStatus === "unverified").length
    const domainBlocked = await checkSuppression({ domain: company.domain })

    for (const person of ranked) {
      if (state.stop || state.verified >= budget.target || lookupsHere >= budget.maxCandidatesPerCompany) break
      const name = `${person.firstName} ${person.lastName}`.trim()
      if (tried.some((c) => c.providerPersonId === person.providerPersonId || c.name.toLowerCase() === name.toLowerCase())) continue

      // Checks that need no lookup, so no credit is spent on someone who could never qualify.
      const skipReason = !isValidPersonName(name)
        ? "Not a person's name"
        : !checkLinkedInProfileGate({ linkedinUrl: person.linkedinUrl }).passed
          ? "No LinkedIn profile found"
          : domainBlocked
            ? "Company cannot be contacted"
            : null
      if (!skipReason && state.lookups >= budget.maxEmailLookups) {
        state.stop ??= "email_run_budget"
        break
      }
      if (!skipReason && Date.now() >= budget.timing.deadline) {
        state.stop ??= "wall_clock_budget"
        break
      }
      if (!skipReason) state.lookups++ // counted before any await, so concurrent companies can't overshoot

      const [contact] = await db
        .insert(gtmContact)
        .values({
          prospectCompanyId: company.id,
          name,
          title: person.title ?? "",
          linkedinUrl: person.linkedinUrl,
          email: null,
          emailSource: "none",
          verificationStatus: "unverified",
          geo: person.location,
          source: person.source,
          providerPersonId: person.providerPersonId,
          emailStatus: "not_looked_up",
          skipReason,
        })
        .returning()
      tried.push(contact)
      if (skipReason) {
        log(`${name} (${company.domain}): skipped, ${skipReason}`)
        continue
      }

      lookupsHere++
      const outcome = await lookupContactEmail(lookupOf(contact, company))
      log(
        `${name} (${company.domain}): ${outcome.kind === "done" ? `${outcome.result.status}${outcome.result.note ? ` (${outcome.result.note})` : ""}, ${outcome.result.creditsUsed} credit(s)` : `incomplete (${outcome.reason})`}`
      )
      if (outcome.kind === "done" && outcome.result.status === "verified") {
        state.verified++
        return setCompanyStatus(company.id, "found")
      }
    }
    const allTried = !state.stop && state.verified < budget.target
    if (allTried && lookupsHere > 0) await setCompanyStatus(company.id, "no_verified_email")
    else if (allTried) await setCompanyStatus(company.id, "no_decision_maker_found")
  }

  const running = new Set<Promise<void>>()
  let next = 0
  let fatal: unknown = null
  for (;;) {
    while (
      !state.stop &&
      next < pending.length &&
      running.size < budget.concurrency &&
      state.verified + running.size < budget.target
    ) {
      if (state.examined >= budget.maxCompaniesExamined) {
        state.stop = "companies_examined_budget"
        break
      }
      if (Date.now() >= budget.timing.deadline) {
        state.stop = "wall_clock_budget"
        break
      }
      state.examined++
      const task: Promise<void> = processCompany(pending[next++])
        .catch((err) => {
          if (err instanceof LeadSearchStop) return onStop(err)
          // Let the companies already running finish (and record what they paid for).
          fatal ??= err
          state.stop ??= "people_search_failed"
        })
        .finally(() => running.delete(task))
      running.add(task)
    }
    if (running.size === 0) break
    await Promise.race(running)
  }
  if (fatal) throw fatal

  // 3. Companies whose people lookup was still rate-limited: one patient retry,
  // after the existing cooldown, while leads are still needed and time remains.
  if (deferred.length && !state.stop && state.verified < budget.target) {
    log(`retrying ${deferred.length} rate-limited compan${deferred.length === 1 ? "y" : "ies"}`)
    await heartbeat()
    await new Promise((r) => setTimeout(r, deps.retryCooldownMs ?? RETRY_PASS_COOLDOWN_MS))
    for (const company of deferred) {
      if (state.stop || state.verified >= budget.target || Date.now() >= budget.timing.deadline) break
      await processCompany(company, true).catch(onStop)
    }
  }

  // 4. One more chance for lookups left open in this attempt (timeouts, rate limits).
  if (!state.stop && state.verified < budget.target) await resumeOpenLookups(await loadContacts())

  const outcome: LeadSearchOutcome = {
    result:
      state.verified >= budget.target ? "reached_target" : state.stop ? "budget_reached" : "out_of_companies",
    target: budget.target,
    verified: state.verified,
    peopleReviewed: await countReviewed(companies.map((c) => c.id)),
    companiesExamined: state.examined,
    stopReason: state.verified >= budget.target ? null : state.stop,
    emailCreditsUsed: await getCampaignVendorCredits(ledgerVendor(email), campaignId),
    finishedAt: new Date().toISOString(),
  }
  await db.update(gtmOutreachCampaign).set({ leadSearchOutcome: outcome }).where(eq(gtmOutreachCampaign.id, campaignId))
  log(`done: ${JSON.stringify(outcome)} in ${Math.round((Date.now() - startedAt) / 1000)}s`)
  return outcome
}

async function setCompanyStatus(companyId: string, status: "found" | "no_decision_maker_found" | "no_verified_email") {
  await db.update(gtmProspectCompany).set({ decisionMakerStatus: status }).where(eq(gtmProspectCompany.id, companyId))
}

async function countReviewed(companyIds: string[]) {
  if (companyIds.length === 0) return 0
  const rows = await db.select({ id: gtmContact.id }).from(gtmContact).where(inArray(gtmContact.prospectCompanyId, companyIds))
  return rows.length
}
