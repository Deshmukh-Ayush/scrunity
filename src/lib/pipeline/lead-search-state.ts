import { and, eq, inArray, isNull, or, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  type LeadCandidate,
  type LeadSearchCampaignState,
  type LeadSearchCompanyState,
  type LeadSearchOutcome,
} from "@/db/schema"
import { cleanCompanyNameOf } from "@/inngest/functions/find-contacts-lookup"
import { getCampaignLifetimeCap, getCampaignRunCap } from "@/lib/firecrawl-spend"
import { getTargetVerifiedLeads } from "@/lib/providers/config"
import { getCampaignVendorCredits } from "@/lib/providers/vendor-usage"
import type { EmailEnrichmentProvider } from "@/lib/providers/types"
import { ledgerVendor } from "./email-lookup"
import type { LeadSearchStopReason } from "./lead-search-budget"

/**
 * Persistent state of the stepwise verified-lead search (Stage 5). Every step
 * reloads everything from the database, so a step can run in any process
 * (Inngest) and a restart resumes exactly where the last step stopped.
 */

export type Company = typeof gtmProspectCompany.$inferSelect
export type Contact = typeof gtmContact.$inferSelect

/** Settled outcomes; "not_reached" is not settled (a new attempt picks it up again). */
const SETTLED = new Set(["found", "no_decision_maker_found", "no_verified_email"])

export const isSettled = (company: Company) =>
  company.decisionMakerStatus != null && SETTLED.has(company.decisionMakerStatus)

export const companyState = (company: Company): LeadSearchCompanyState => company.leadSearchState ?? {}

/** A people search ran for this company (candidates stored), or it is waiting to retry one. */
export const wasExamined = (company: Company) => {
  const state = companyState(company)
  return isSettled(company) || state.candidates != null || state.deferredUntil != null
}

/** The vendor job of this contact is running (paid for) and has no result yet. */
export const hasOpenLookup = (contact: Contact) =>
  Boolean(contact.emailLookupRef) && (!contact.emailStatus || contact.emailStatus === "not_looked_up")

/** Counted against the per-campaign lookup budget (each could cost one credit). */
export const countsAsLookup = (contact: Contact) =>
  Boolean(contact.emailLookupRef) || Boolean(contact.emailStatus && contact.emailStatus !== "not_looked_up")

export async function loadSearchContext(campaignId: string) {
  const [ctx] = await db
    .select({ campaign: gtmOutreachCampaign, segment: gtmIcpSegment, researchRun: gtmResearchRun })
    .from(gtmOutreachCampaign)
    .innerJoin(gtmIcpSegment, eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id))
    .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
    .where(eq(gtmOutreachCampaign.id, campaignId))
  if (!ctx) throw new Error(`Outreach campaign ${campaignId} not found`)
  return ctx
}

/** Selected companies, best fit first (then discovery order), and their contacts. */
export async function loadCompaniesAndContacts(campaignId: string) {
  const companies = await db
    .select()
    .from(gtmProspectCompany)
    .where(and(eq(gtmProspectCompany.outreachCampaignId, campaignId), eq(gtmProspectCompany.selectionStatus, "selected")))
    .orderBy(sql`${gtmProspectCompany.fitScore} DESC NULLS LAST`, gtmProspectCompany.createdAt)
  const contacts = companies.length
    ? await db.select().from(gtmContact).where(inArray(gtmContact.prospectCompanyId, companies.map((c) => c.id)))
    : []
  return { companies, contacts }
}

export async function saveCompanyState(company: Company, state: LeadSearchCompanyState) {
  company.leadSearchState = state
  await db.update(gtmProspectCompany).set({ leadSearchState: state }).where(eq(gtmProspectCompany.id, company.id))
}

export async function setCompanyStatus(
  company: Company,
  status: "found" | "no_decision_maker_found" | "no_verified_email"
) {
  company.decisionMakerStatus = status
  await db.update(gtmProspectCompany).set({ decisionMakerStatus: status }).where(eq(gtmProspectCompany.id, company.id))
}

export async function saveCampaignSearchState(campaignId: string, state: LeadSearchCampaignState) {
  await db.update(gtmOutreachCampaign).set({ leadSearchState: state }).where(eq(gtmOutreachCampaign.id, campaignId))
}

/** Records the first stop reason of an attempt (later ones never overwrite it). */
export async function recordStop(campaignId: string, state: LeadSearchCampaignState, reason: LeadSearchStopReason) {
  if (state.stopReason) return
  state.stopReason = reason
  await saveCampaignSearchState(campaignId, state)
}

/** Firecrawl calls this stage attempt may still make (attempt cap and lifetime backstop). */
export async function firecrawlCallsLeft(campaignId: string) {
  const [row] = await db
    .select({ attempt: gtmOutreachCampaign.firecrawlAttemptCallCount, lifetime: gtmOutreachCampaign.firecrawlCallCount })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  return Math.min(getCampaignRunCap() - row.attempt, getCampaignLifetimeCap() - row.lifetime)
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/**
 * True when a "person" is really the company: their name equals the company
 * name or the domain label (e.g. "Carter Murray" at cartermurray.com, a firm
 * named after its founder, parsed from a page as a person).
 */
export function isCompanyNameNotPerson(personName: string, company: { name: string; domain: string }) {
  const person = normalize(personName)
  if (!person) return false
  const label = company.domain.split(".")[0] ?? ""
  return [company.name, cleanCompanyNameOf(company.name), label].some((n) => normalize(n) === person)
}

export const candidateName = (c: LeadCandidate) => `${c.firstName} ${c.lastName}`.trim()

/**
 * Ends an attempt: selected companies the search never settled are marked
 * "not_reached", and the outcome (stored for the UI) says how it ended.
 */
export async function finishLeadSearch(
  campaignId: string,
  email: Pick<EmailEnrichmentProvider, "key">
): Promise<LeadSearchOutcome> {
  const { campaign } = await loadSearchContext(campaignId)
  const state = campaign.leadSearchState ?? { attemptId: null, titles: [] }
  const { companies, contacts } = await loadCompaniesAndContacts(campaignId)
  const notReached = companies.filter((c) => !isSettled(c))
  if (notReached.length > 0) {
    await db
      .update(gtmProspectCompany)
      .set({ decisionMakerStatus: "not_reached" })
      .where(
        and(
          inArray(gtmProspectCompany.id, notReached.map((c) => c.id)),
          or(isNull(gtmProspectCompany.decisionMakerStatus), eq(gtmProspectCompany.decisionMakerStatus, "not_reached"))
        )
      )
  }
  const verified = contacts.filter((c) => c.emailStatus === "verified").length
  const goal = getTargetVerifiedLeads(campaign.targetVerifiedLeads)
  const outcome: LeadSearchOutcome = {
    result: verified >= goal ? "reached_target" : state.stopReason ? "budget_reached" : "out_of_companies",
    target: goal,
    verified,
    peopleReviewed: contacts.length,
    companiesExamined: companies.filter(wasExamined).length,
    stopReason: verified >= goal ? null : (state.stopReason ?? null),
    companiesNotReached: notReached.length,
    emailCreditsUsed: await getCampaignVendorCredits(ledgerVendor(email), campaignId),
    finishedAt: new Date().toISOString(),
  }
  await db.update(gtmOutreachCampaign).set({ leadSearchOutcome: outcome }).where(eq(gtmOutreachCampaign.id, campaignId))
  return outcome
}
