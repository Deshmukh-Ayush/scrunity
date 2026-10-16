import { db } from "@/utils/db"
import { gtmContact, type LeadSearchCampaignState } from "@/db/schema"
import { deriveTargetJobFunction } from "@/lib/gtm-ai"
import { countryNameFromCode } from "@/lib/geo/countries"
import { checkLinkedInProfileGate } from "@/lib/gtm-qualification-gates"
import { isValidPersonName, scoreTitleMatch } from "@/lib/gtm-contact-matcher"
import { checkSuppression } from "@/lib/gtm-suppression"
import { isAggregatorOrReviewDomain } from "@/lib/firecrawl"
import { RETRY_PASS_COOLDOWN_MS } from "@/inngest/functions/find-contacts-lookup"
import { getEmailEnrichmentProvider, getLeadSearchPeopleProvider } from "@/lib/providers/registry"
import type { EmailEnrichmentProvider, PeopleDiscoveryProvider } from "@/lib/providers/types"
import { LeadSearchStop, pollEmailLookup, startEmailLookup, type LookupMetadata } from "./email-lookup"
import { releaseQueued, runEmailBatch } from "./email-lookup-batch"
import {
  leadSearchBudget,
  WEB_PEOPLE_CALLS_PER_COMPANY,
  type LeadSearchBudget,
  type LeadSearchStopReason,
} from "./lead-search-budget"
import {
  candidateName,
  companyState,
  countsAsLookup,
  firecrawlCallsLeft,
  hasOpenLookup,
  isCompanyNameNotPerson,
  isSettled,
  loadCompaniesAndContacts,
  loadSearchContext,
  recordStop,
  saveCampaignSearchState,
  saveCompanyState,
  setCompanyStatus,
  wasExamined,
  type Company,
  type Contact,
} from "./lead-search-state"
import { touchCampaignAttempt } from "./stage-state"

/** Injectable for scripts: stub providers, fixed titles, short polling. */
export interface LeadSearchDeps {
  people?: PeopleDiscoveryProvider
  email?: EmailEnrichmentProvider
  titles?: string[]
  budget?: Partial<LeadSearchBudget>
  /** Wait before retrying a company whose people search was rate-limited. */
  retryCooldownMs?: number
  log?: (line: string) => void
}

export type LeadSearchStepResult = {
  status: "continue" | "waiting" | "done" | "superseded"
  /** Sleep before the next step (status "waiting"). */
  waitMs: number
  ms: number
  polled: number
  started: number
  searched: number
}

/**
 * No new company starts after this much time in one step; the step returns
 * "continue" and the next step starts at once. A company search already
 * started finishes in its step: under the 8/min Firecrawl limiter that adds
 * up to ~25 s (3 calls), so steps measured 30-40 s with a 25 s limit.
 */
const STEP_SOFT_LIMIT_MS = 15_000

class Superseded extends Error {}

/**
 * Stage 5, one step: find leads whose email a vendor verified at mailbox level.
 *
 * Companies are taken best fit first. For each, decision makers come from the
 * people provider (stored on the company), best title match first; each gets at
 * most one email lookup, started in one step and polled in later ones (the wait
 * between steps is an Inngest step sleep, or a plain sleep in-process). A
 * verified address is accepted; otherwise the next person is tried (up to
 * GTM_MAX_CANDIDATES_PER_COMPANY), then the next company. The attempt stops at
 * the target or the first exhausted budget, keeping what it found, and never
 * invents or guesses an address.
 *
 * Every step reloads its state from the database and checks that its attempt
 * still owns the stage (stage_attempt_id), so a restart or a second trigger
 * makes an older attempt stop. Every person is stored before their lookup and
 * the vendor job ref is saved before polling, so nobody is looked up (or paid
 * for) twice.
 */
export async function runLeadSearchStep(
  campaignId: string,
  attemptId: string,
  deps: LeadSearchDeps = {}
): Promise<LeadSearchStepResult> {
  const stepStart = Date.now()
  const stats = { polled: 0, started: 0, searched: 0, settled: 0 }
  const result = (status: LeadSearchStepResult["status"], waitMs = 0): LeadSearchStepResult => ({
    status, waitMs, ms: Date.now() - stepStart, polled: stats.polled, started: stats.started, searched: stats.searched,
  })
  const log = deps.log ?? ((line: string) => console.log(`[Lead search ${campaignId}] ${line}`))
  const heartbeat = async () => {
    if (!(await touchCampaignAttempt(campaignId, "find_contacts", attemptId))) throw new Superseded()
  }
  try {
    await heartbeat()
  } catch {
    return result("superseded")
  }

  const { campaign, segment, researchRun } = await loadSearchContext(campaignId)
  // Both fail the stage with a plain reason before any spend; no guessing fallback.
  const email = deps.email ?? getEmailEnrichmentProvider()
  const people = deps.people ?? getLeadSearchPeopleProvider()
  const attemptStart = campaign.stageAttemptStartedAt?.getTime() ?? stepStart
  const budget = leadSearchBudget(campaign.targetVerifiedLeads, attemptStart, deps.budget, email.maxBatchSize)
  const spend = { organizationId: researchRun.organizationId, researchRunId: researchRun.id, campaignId }

  // Target titles: derived once (one LLM call) and kept across steps and attempts.
  let state: LeadSearchCampaignState = campaign.leadSearchState ?? { attemptId: null, titles: [] }
  if (state.attemptId !== attemptId) {
    const titles =
      deps.titles ??
      (state.titles.length > 0
        ? state.titles
        : (await deriveTargetJobFunction({ segmentName: segment.name, painPoint: segment.painPoint, criteria: segment.criteria })).jobFunctions.filter(Boolean))
    state = { attemptId, titles, stopReason: null }
    await saveCampaignSearchState(campaignId, state)
  }
  const titles = deps.titles ?? state.titles
  const countryCode = campaign.targetCountryCode ?? researchRun.targetCountryCode
  const country = countryNameFromCode(countryCode) ?? ""
  const region = campaign.targetCountryCode ? campaign.targetRegion : researchRun.targetRegion

  let { companies, contacts } = await loadCompaniesAndContacts(campaignId)
  const meta = (c: Contact) => (c.enrichMetadata ?? null) as LookupMetadata | null
  const pollable = (c: Contact) => hasOpenLookup(c) && meta(c)?.gaveUpAttemptId !== attemptId
  const verifiedCount = () => contacts.filter((c) => c.emailStatus === "verified").length
  const stopped = () => Boolean(state.stopReason) || verifiedCount() >= budget.target
  let lookups = contacts.filter(countsAsLookup).length
  const stop = async (reason: LeadSearchStopReason, detail = "") => {
    if (!state.stopReason) log(`stopping: ${reason}${detail ? ` (${detail})` : ""}`)
    await recordStop(campaignId, state, reason)
  }
  const onStop = async (err: unknown) => {
    if (!(err instanceof LeadSearchStop)) throw err
    await stop(err.stopReason as LeadSearchStopReason, err.message)
  }
  const inputOf = (contact: Contact, company: Company) => ({
    firstName: contact.name.split(/\s+/)[0],
    lastName: contact.name.split(/\s+/).slice(1).join(" "),
    domain: company.domain,
    companyName: company.name,
    linkedinUrl: contact.linkedinUrl,
  })
  const companyOf = (contact: Contact) => companies.find((c) => c.id === contact.prospectCompanyId)!

  try {
    // 1. Batch providers: send one batch of queued people (or release them once stopped).
    if (email.lookupBatch) {
      const queued = contacts.filter(pollable)
      stats.polled += queued.length
      if (queued.length > 0 && (stopped() || Date.now() >= budget.deadline)) await releaseQueued(queued)
      else if (queued.length > 0) {
        try {
          const batch = queued.map((contact) => ({ contact, company: companyOf(contact), input: inputOf(contact, companyOf(contact)) }))
          const sent = await runEmailBatch({ queued: batch, provider: email, spend, attemptId, log })
          for (const company of sent.verifiedCompanies) await setCompanyStatus(company, "found")
        } catch (err) {
          await onStop(err)
        }
      }
    }
    // 1. Otherwise collect results of lookups already running (each polled once per step).
    for (const contact of email.lookupBatch ? [] : contacts.filter(pollable)) {
      const company = companyOf(contact)
      stats.polled++
      try {
        const outcome = await pollEmailLookup({
          contactId: contact.id, ref: contact.emailLookupRef!, metadata: meta(contact),
          input: inputOf(contact, company), provider: email, attemptId, maxWaitMs: budget.maxWaitMs,
        })
        if (outcome.kind === "done") {
          const r = outcome.result
          log(`${contact.name} (${company.domain}): ${r.status}${r.note ? ` (${r.note})` : ""}, ${r.creditsUsed} credit(s)`)
          if (r.status === "verified") await setCompanyStatus(company, "found")
        } else if (outcome.kind === "incomplete") {
          log(`${contact.name} (${company.domain}): no result after the maximum wait, left open`)
        }
      } catch (err) {
        await onStop(err)
      }
    }
    if (stats.polled > 0) ({ companies, contacts } = await loadCompaniesAndContacts(campaignId))

    /** Starts the next person's lookup at a company that has candidates, or settles it. */
    async function advanceCompany(company: Company) {
      const mine = contacts.filter((c) => c.prospectCompanyId === company.id)
      if (mine.some((c) => c.emailStatus === "verified")) return setCompanyStatus(company, "found")
      if (mine.some(pollable)) return // its lookup is still running
      if (stopped()) return
      const failedHere = (c: Contact) => meta(c)?.startFailedAttemptId === attemptId
      let lookupsHere = mine.filter(
        (c) => c.emailLookupRef || c.emailStatus === "not_found" || c.emailStatus === "unverified" || failedHere(c)
      ).length

      // A person stored earlier whose job was never submitted (cap or rate limit): submit it first.
      const unstarted = mine.find((c) => !c.emailLookupRef && c.lookupStatus === "lookup_incomplete" && !failedHere(c))
      if (unstarted && lookupsHere < budget.maxCandidatesPerCompany) {
        if (!(await lookupAllowed())) return
        await heartbeat()
        lookupsHere++
        if (await startLookup(unstarted, company)) return
        if (stopped()) return
      }
      const domainBlocked = await checkSuppression({ domain: company.domain })
      for (const candidate of companyState(company).candidates ?? []) {
        if (lookupsHere >= budget.maxCandidatesPerCompany) break
        const name = candidateName(candidate)
        if (mine.some((c) => c.providerPersonId === candidate.providerPersonId || c.name.toLowerCase() === name.toLowerCase())) continue
        // Checks that need no lookup, so no credit is spent on someone who could never qualify.
        const skipReason = !isValidPersonName(name)
          ? "Not a person's name"
          : !checkLinkedInProfileGate({ linkedinUrl: candidate.linkedinUrl }).passed
            ? "No LinkedIn profile found"
            : domainBlocked
              ? "Company cannot be contacted"
              : null
        if (!skipReason && !(await lookupAllowed())) return
        await heartbeat() // ownership re-checked right before anything is stored or spent
        const [contact] = await db
          .insert(gtmContact)
          .values({
            prospectCompanyId: company.id, name, title: candidate.title ?? "", linkedinUrl: candidate.linkedinUrl,
            email: null, emailSource: "none", verificationStatus: "unverified", geo: candidate.location,
            source: candidate.source, providerPersonId: candidate.providerPersonId, emailStatus: "not_looked_up", skipReason,
          })
          .returning()
        mine.push(contact)
        contacts.push(contact)
        if (skipReason) {
          log(`${name} (${company.domain}): skipped, ${skipReason}`)
          continue
        }
        lookupsHere++
        if (await startLookup(contact, company)) return
        if (stopped()) return
      }
      if (stopped()) return
      stats.settled++
      await setCompanyStatus(company, lookupsHere > 0 ? "no_verified_email" : "no_decision_maker_found")
    }

    async function lookupAllowed() {
      if (lookups >= budget.maxEmailLookups) {
        await stop("email_run_budget")
        return false
      }
      if (Date.now() >= budget.deadline) {
        await stop("wall_clock_budget")
        return false
      }
      return true
    }

    /** Starts one stored person's lookup; true when the job is running. */
    async function startLookup(contact: Contact, company: Company) {
      if (!countsAsLookup(contact)) lookups++
      try {
        const outcome = await startEmailLookup({
          contactId: contact.id, input: inputOf(contact, company), provider: email, spend, attemptId, previous: meta(contact),
        })
        stats.started++
        log(`${contact.name} (${company.domain}): lookup ${outcome.kind === "pending" ? "started" : "not started, will try the next person"}`)
        return outcome.kind === "pending"
      } catch (err) {
        await onStop(err)
        return false
      }
    }

    /** People search for one company (Firecrawl for the web provider), then its first lookup. */
    async function searchCompany(company: Company, patient: boolean) {
      await heartbeat()
      stats.searched++
      if (isAggregatorOrReviewDomain(company.domain)) {
        log(`${company.domain}: aggregator or review site, skipped`)
        return setCompanyStatus(company, "no_decision_maker_found")
      }
      let found: Awaited<ReturnType<PeopleDiscoveryProvider["findDecisionMakers"]>>
      // People search providers stored this company's people in Stage 4: no second search.
      const prefetched = companyState(company).prefetched
      try {
        found = prefetched ? { people: prefetched, creditsUsed: 0 } : await people.findDecisionMakers(
          {
            company: { name: company.name, domain: company.domain, providerId: company.providerId },
            titles, country, state: region, limit: budget.maxCandidatesPerCompany * 2, patient,
          },
          spend
        )
      } catch (err) {
        const reason = (err as { failureReason?: string }).failureReason
        if (reason?.startsWith("firecrawl_") || reason === "paused_firecrawl_allotment_exhausted") {
          return stop("web_search_budget", (err as Error).message)
        }
        throw err
      }
      const previous = companyState(company)
      if (found.people.length === 0) {
        if (found.incomplete && !patient) {
          log(`${company.domain}: people search rate-limited, retrying later`)
          return saveCompanyState(company, { ...previous, deferredUntil: new Date(Date.now() + (deps.retryCooldownMs ?? RETRY_PASS_COOLDOWN_MS)).toISOString() })
        }
        if (found.incomplete) {
          // Still rate-limited after the patient retry: unknown, not "nobody".
          log(`${company.domain}: people search still rate-limited, left for a later attempt`)
          return saveCompanyState(company, { ...previous, gaveUpAttemptId: attemptId })
        }
        log(`${company.domain}: nobody found`)
        return setCompanyStatus(company, "no_decision_maker_found")
      }
      const ranked = [...found.people].sort(
        (a, b) => scoreTitleMatch(b.title ?? "", titles).score - scoreTitleMatch(a.title ?? "", titles).score
      )
      const candidates = ranked.filter((p) => {
        const isCompany = isCompanyNameNotPerson(`${p.firstName} ${p.lastName}`, company)
        if (isCompany) log(`${p.firstName} ${p.lastName} (${company.domain}): the company's own name, not a person; skipped`)
        return !isCompany
      })
      await saveCompanyState(company, { ...previous, candidates, deferredUntil: null, gaveUpAttemptId: null })
      await advanceCompany(company)
    }

    // 2. Companies with people found: next person, or settle.
    for (const company of companies.filter((c) => !isSettled(c) && companyState(c).candidates)) {
      await advanceCompany(company)
    }

    // 3. New companies, best fit first, while leads are still needed and slots are free.
    const active = () => companies.filter((c) => !isSettled(c) && companyState(c).candidates).length
    for (;;) {
      if (stopped() || Date.now() - stepStart >= STEP_SOFT_LIMIT_MS) break
      if (verifiedCount() + active() >= budget.target || active() >= budget.concurrency) break
      const unsettled = companies.filter((c) => !isSettled(c) && !companyState(c).candidates)
      const pending = unsettled.find((c) => !companyState(c).deferredUntil)
      const ready = unsettled.find((c) => {
        const s = companyState(c)
        return s.deferredUntil && Date.parse(s.deferredUntil) <= Date.now() && s.gaveUpAttemptId !== attemptId
      })
      const next = pending ?? ready
      if (!next) break
      if (pending && companies.filter(wasExamined).length >= budget.maxCompaniesExamined) {
        await stop("companies_examined_budget")
        break
      }
      if (Date.now() >= budget.deadline) {
        await stop("wall_clock_budget")
        break
      }
      if (people.key === "web" && (await firecrawlCallsLeft(campaignId)) < WEB_PEOPLE_CALLS_PER_COMPANY) {
        await stop("web_search_budget", `fewer than ${WEB_PEOPLE_CALLS_PER_COMPANY} web search calls left in this attempt`)
        break
      }
      await searchCompany(next, !pending)
    }
  } catch (err) {
    if (err instanceof Superseded) return result("superseded")
    throw err
  }

  // 4. What next: wait for running lookups, keep going, or finish.
  ;({ companies, contacts } = await loadCompaniesAndContacts(campaignId))
  const finished = stopped() || Date.now() >= budget.deadline
  const unsettled = companies.filter((c) => !isSettled(c))
  const activeNow = unsettled.filter((c) => companyState(c).candidates).length
  const slots = verifiedCount() + activeNow < budget.target && activeNow < budget.concurrency
  const progressed = stats.polled + stats.started + stats.searched + stats.settled > 0
  const pendingLeft = unsettled.some((c) => !companyState(c).candidates && !companyState(c).deferredUntil)
  // More companies can start right now (this step ran out of time): no sleep.
  if (!finished && slots && pendingLeft && progressed) return result("continue")
  // Lookups already paid for are always collected, even after a stop.
  if (contacts.some(pollable)) return result("waiting", budget.pollIntervalMs)
  if (finished || pendingLeft) return result("done")
  const deferred = unsettled
    .map((c) => companyState(c))
    .filter((s) => !s.candidates && s.deferredUntil && s.gaveUpAttemptId !== attemptId)
    .map((s) => Date.parse(s.deferredUntil!))
  if (slots && deferred.length > 0) return result("waiting", Math.max(1000, Math.min(...deferred) - Date.now()))
  return result("done")
}
