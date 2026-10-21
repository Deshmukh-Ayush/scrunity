import type { CompanySearchFilters } from "@/db/schema"
import type { InngestConnectivityStatus } from "@/lib/inngest-connectivity"

/** JSON shapes from GET /api/gtm/campaigns/[id], /drafts and /api/gtm/mailbox. */

export interface Contact {
  id: string
  name: string
  title: string
  email: string | null
  emailSource: string
  linkedinUrl: string | null
  /** Present on campaign-detail contacts (not on draft contacts). */
  prospectCompanyId?: string
  geo?: string | null
  /** "not_looked_up" for database-mode decision makers; null for legacy contacts. */
  emailStatus?: string | null
}

export interface Company {
  id: string
  name: string
  domain: string
  location: string
  description: string
  // Company-database fields (database mode); absent or null on legacy rows.
  website?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  industry?: string | null
  headcount?: number | null
  revenueRange?: string | null
  selectionStatus?: "selected" | "excluded"
  fitNote?: string | null
  /** 0-100 fit with the segment; companies below the threshold start unselected. */
  fitScore?: number | null
  decisionMakerStatus?: "found" | "no_decision_maker_found" | "no_verified_email" | "not_reached" | null
}

export type DraftStatus = "draft" | "approved" | "rejected" | "sent" | "failed"

export interface Draft {
  id: string
  subject: string
  body: string
  status: DraftStatus
  providerMessageId?: string | null
  sentAt?: string | null
  errorMessage?: string | null
  hasBounced?: boolean
  createdAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  contact: Contact
  company: Company
}

export interface CampaignData {
  campaign: {
    id: string
    status: string
    currentStage: string
    failureReason?: string | null
    discoveryNote?: string | null
    /** The company search Stage 4 ran (database mode). */
    searchFilters?: CompanySearchFilters | null
    /** How the verified-lead search ended (vendor credits and stop codes removed). */
    leadSearchOutcome?: {
      result: "reached_target" | "budget_reached" | "out_of_companies"
      target: number
      verified: number
      peopleReviewed: number
      companiesExamined: number
      stopReason?: string | null
      companiesNotReached?: number
    } | null
    targetCountryCode?: string | null
    targetRegion?: string | null
    /** Imported lists: the bounce-rate pause counts only emails sent since this time. */
    bounceGuardSince?: string | null
    createdAt: string
    stageStartedAt?: string | null
    lastProgressAt?: string | null
  }
  inngestConnectivity?: InngestConnectivityStatus
  segment: {
    id: string
    name: string
    painPoint: string
  }
  researchRun: {
    id: string
    companyName: string
    websiteUrl: string
  }
  /** True when this campaign's companies came from the company database (selection gate). */
  usesCompanyDatabase?: boolean
  decisionMakersPerCompany?: number
  companies: Company[]
  /** Usable leads only: mailbox-verified or from an imported list, not rejected, never bounced. */
  contacts: Contact[]
  /** Everyone else the campaign reviewed, with a neutral reason. */
  skippedContacts?: Array<{ id: string; name: string; title: string; companyName: string; reason: string }>
  leadSummary?: { reviewed: number; verified: number; fromList?: number }
  snapshots: Array<{
    prospectCompanyId: string
    employeeCountLabel: string | null
    linkedinFollowerCount: number | null
  }>
}

export interface MailboxInfo {
  id: string
  email: string
  provider: string
  status: string
  dailySendCount: number
  lastSendResetDate: string | null
}
