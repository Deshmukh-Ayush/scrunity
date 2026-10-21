/** A lead row as returned by GET /api/gtm/leads (and rendered by LeadsSection). */
export type Lead = {
  id: string
  name: string
  title: string
  email: string | null
  verificationStatus: string
  emailSource: string
  linkedinUrl: string | null
  /** Neutral reason the verified-lead search skipped this person (skipped view). */
  skipReason?: string | null
  createdAt: string
  companyId: string
  companyName: string
  companyDomain: string | null
  campaignId: string
  campaignName: string
  status: string
  draftId?: string | null
  draftSubject?: string | null
  draftBody?: string | null
  draftStatus?: string | null
  threadId?: string | null
  rejectionReason?: string | null
}

export type LeadSummary = {
  reviewed: number
  /** Usable leads whose email a vendor verified. */
  verified: number
  /** Usable leads from the customer's imported lists (not verified). */
  fromList: number
}

export type CampaignOption = {
  id: string
  name: string
}

export const LEADS_PAGE_SIZE = 20
