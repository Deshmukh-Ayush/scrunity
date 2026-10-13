import type { SynthesizedProfile } from "@/components/gtm/company-profile-confirmation"

/**
 * DEMO-ONLY data for the onboarding walkthrough. The onboarding flow currently
 * simulates research with timers and these fixtures instead of calling the real
 * pipeline (and never creates an organization). Replacing it with the real flow
 * is tracked separately; do not build on these values.
 */

export interface DemoSegment {
  id: string
  name: string
  painPoint: string
  criteria: string[]
  exampleCompanies: Array<{ name: string; domain: string }>
  estimatedSizeLabel: string
}

export const DEMO_SEGMENTS: DemoSegment[] = [
  {
    id: "seg-1",
    name: "Seed & Series-A FinTech Founders",
    painPoint:
      "Struggling with slow revenue reconciliation and contract scope creep while scaling early client deliverables.",
    criteria: ["FinTech", "11-50 employees", "Series A", "B2B SaaS"],
    exampleCompanies: [
      { name: "Ramp", domain: "ramp.com" },
      { name: "Mercury", domain: "mercury.com" },
      { name: "Brex", domain: "brex.com" },
    ],
    estimatedSizeLabel: "~8,000 companies in US/EU (LLM estimate)",
  },
  {
    id: "seg-2",
    name: "Digital Agency Managing Directors",
    painPoint:
      "Losing 15–20% margin to unbilled out-of-scope client revisions and manual payment follow-ups.",
    criteria: ["Creative / Dev Agency", "10-100 seats", "Retainer model"],
    exampleCompanies: [
      { name: "Huge", domain: "hugeinc.com" },
      { name: "Work & Co", domain: "work.co" },
      { name: "Fantasy", domain: "fantasy.co" },
    ],
    estimatedSizeLabel: "~12,500 agencies in US/UK (LLM estimate)",
  },
  {
    id: "seg-3",
    name: "Enterprise Legal & Procurement Ops",
    painPoint:
      "Manual SOW auditing and lack of tamper-evident signature trails across distributed contractors.",
    criteria: ["200+ employees", "Multi-vendor", "Strict compliance"],
    exampleCompanies: [
      { name: "Ironclad", domain: "ironcladapp.com" },
      { name: "ContractPodAi", domain: "contractpodai.com" },
    ],
    estimatedSizeLabel: "~4,200 enterprises (LLM estimate)",
  },
  {
    id: "seg-4",
    name: "B2B SaaS Customer Success Leads",
    painPoint:
      "High client churn caused by misaligned milestone expectations and lack of deliverable progress visibility.",
    criteria: ["High ARR accounts", "Quarterly milestones", "Customer Success"],
    exampleCompanies: [
      { name: "Gainsight", domain: "gainsight.com" },
      { name: "Vitally", domain: "vitally.io" },
      { name: "ChurnZero", domain: "churnzero.com" },
    ],
    estimatedSizeLabel: "~6,500 teams (LLM estimate)",
  },
]

export const DEMO_PROFILE: SynthesizedProfile = {
  summary:
    "Acme Software helps modern digital agencies protect revenue and keep client collaboration on track.",
  industry: "Agency operations software",
  productFocus: "Client collaboration and revenue protection",
  targetCustomerLanguage:
    "Digital agencies managing client deliverables and revisions",
  signals: ["Agency workflow", "Revenue protection", "Client collaboration"],
}

export const DEMO_COMPETITORS = [
  "Linear",
  "ClickUp",
  "Asana",
  "Monday.com",
  "Notion",
]

export const DEMO_FORM_DEFAULTS = {
  websiteUrl: "https://acme.com",
  companyName: "Acme Software",
  companySize: "11-50" as "1-10" | "11-50" | "51-200" | "200+",
  companyDescription:
    "AI-powered client collaboration and revenue protection for modern digital agencies.",
}
