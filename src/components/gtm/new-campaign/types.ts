import type { SynthesizedProfile } from "../company-profile-confirmation"
import type { MarketContextFields } from "../market-context"

export type FlowStep =
  | "FORM"
  | "RUNNING"
  | "PROFILE_CONFIRMATION"
  | "SEGMENT_SELECTION"
  | "COMPLETED"

// The company form is shared with onboarding and Settings; its types live with the profile.
export type { CompanySize } from "@/lib/company-profile/input"
export type { CompanyFormErrors, CompanyFormValues } from "@/lib/company-profile/form"

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
