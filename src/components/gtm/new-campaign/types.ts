import type { SynthesizedProfile } from "../company-profile-confirmation"
import type { MarketContextFields } from "../market-context"
import type { Currency } from "@/lib/geo/countries"

export type FlowStep =
  | "FORM"
  | "RUNNING"
  | "PROFILE_CONFIRMATION"
  | "SEGMENT_SELECTION"
  | "COMPLETED"

export type CompanySize = "1-10" | "11-50" | "51-200" | "200+"

export interface CompanyFormValues {
  websiteUrl: string
  companyName: string
  companyDescription: string
  companySize: CompanySize
  contextDoc: string
  fileName: string
  /** Country name as typed or picked; mapped to its ISO code on submit. */
  targetCountry: string
  targetRegion: string
  /** Kept as typed so the input can be cleared; parsed on submit. */
  arrAmount: string
  arrCurrency: Currency
  tamAmount: string
  tamCurrency: Currency
}

export interface IcpSegment {
  id: string
  name: string
  painPoint: string
  criteria: string[]
  exampleCompanies: Array<{ name: string; domain: string }>
  estimatedSizeLabel?: string | null
}

export interface Competitor {
  id: string
  name: string
  domain: string
  description: string
  logoUrl?: string | null
}

export interface ResearchRunDetails extends MarketContextFields {
  id: string
  companyName: string
  websiteUrl: string
  companyDescription: string
  logoUrl?: string | null
  status: string
  currentStage: string
  failureReason?: string | null
  firecrawlCallCount?: number
  synthesizedProfile?: SynthesizedProfile | null
  createdAt?: string
  stageStartedAt?: string | null
  lastProgressAt?: string | null
}
