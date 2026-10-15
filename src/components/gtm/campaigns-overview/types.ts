import type { CampaignItem } from "../campaigns-list-client"
import type { MarketContextFields } from "../market-context"

export type { CampaignItem }

/** A research run row as returned by GET /api/gtm/research-runs. */
export interface ResearchRunItem extends MarketContextFields {
  logoUrl?: string | null
  // Display-only: number of ICP segments the run produced.
  segmentCount?: number
  id: string
  companyName: string
  websiteUrl: string
  companyDescription: string
  status: string
  currentStage: string
  createdAt: string
  stageStartedAt?: string | null
  lastProgressAt?: string | null
}

export interface CompetitorItem {
  id: string
  name: string
  domain: string
  description: string
}

export interface IcpSegmentItem {
  id: string
  name: string
  painPoint: string
  estimatedSizeLabel?: string | null
  criteria?: string[] | null
  exampleCompanies?: Array<{ name: string }> | null
}

/** GET /api/gtm/research-runs/[id] payload, as used by the overview. */
export interface ResearchRunDetail {
  researchRun: ResearchRunItem
  competitors: CompetitorItem[]
  segments: IcpSegmentItem[]
}

/** A campaign row as returned by GET /api/gtm/campaigns, with the table's display extras. */
export interface CampaignRow {
  campaign: CampaignItem["campaign"] & {
    targetVerifiedLeads?: number | null
    leadSearchOutcome?: { verified: number; target: number } | null
  }
  researchRun: CampaignItem["researchRun"]
  segmentName: string | null
  stats: { drafts: number; sent: number; replies: number }
}
