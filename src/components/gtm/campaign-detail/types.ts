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
  decisionMakerStatus?: "found" | "no_decision_maker_found" | null
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
    firecrawlCallCount?: number
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
  contacts: Contact[]
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
