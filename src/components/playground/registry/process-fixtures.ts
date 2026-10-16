import type { CampaignData, Draft, MailboxInfo } from "@/components/gtm/campaign-detail/types"
import type {
  Competitor,
  IcpSegment,
  ResearchRunDetails,
} from "@/components/gtm/new-campaign/types"

/**
 * Fixtures for the research flow and campaign page demos on the testing
 * route. Product-shaped and fictional; nothing here is read from or written
 * to the database, and no request is made with it.
 */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export const FIXTURE_RUN: ResearchRunDetails = {
  id: "fixture-run",
  companyName: "Tiffin Route",
  websiteUrl: "https://tiffinroute.in",
  companyDescription:
    "Route-planning software that helps tiffin and meal-delivery kitchens in Indian cities cut delivery time and fuel.",
  logoUrl: null,
  status: "in_progress",
  currentStage: "research_competitors",
  failureReason: null,
  createdAt: minutesAgo(2),
  stageStartedAt: minutesAgo(1),
  lastProgressAt: minutesAgo(0.2),
  targetCountryCode: "IN",
  targetRegion: "Maharashtra",
  ownArrAmount: 180000,
  ownArrCurrency: "USD",
  ownTamAmount: 42000000,
  ownTamCurrency: "USD",
  synthesizedProfile: {
    summary:
      "Tiffin Route sells route-planning software to tiffin services and cloud kitchens in Indian cities. It groups orders into delivery runs and gives riders a turn-by-turn route, so kitchens deliver more meals per rider with less fuel.",
    industry: "Logistics software",
    productFocus: "Delivery route planning for food businesses",
    targetCustomerLanguage: "Kitchen owners and operations managers",
    signals: [
      "Pricing per rider per month",
      "Customers in Pune and Mumbai",
      "Hindi and Marathi rider app",
      "Free trial for 14 days",
    ],
  },
}

export const FIXTURE_COMPETITORS: Competitor[] = [
  { id: "c1", name: "Shipday", domain: "shipday.com", description: "Delivery management for restaurants." },
  { id: "c2", name: "Locus", domain: "locus.sh", description: "Route optimisation for logistics fleets." },
  { id: "c3", name: "Zeo Route Planner", domain: "zeoauto.com", description: "Multi-stop route planning." },
  { id: "c4", name: "Upper", domain: "upperinc.com", description: "Route planning for delivery teams." },
  { id: "c5", name: "Routific", domain: "routific.com", description: "Delivery route optimisation." },
]

export const FIXTURE_SEGMENTS: IcpSegment[] = [
  {
    id: "s1",
    name: "Tiffin services with 10 to 40 riders",
    painPoint:
      "Lunch orders arrive in a two-hour window, so riders overlap routes and the last meals arrive cold. Owners plan runs by hand on WhatsApp every morning.",
    criteria: ["10–40 delivery riders", "Daily subscription orders", "Pune, Mumbai or Nashik"],
    exampleCompanies: [
      { name: "Annapurna Tiffins", domain: "annapurnatiffins.in" },
      { name: "Ghar Ka Khana Pune", domain: "gharkakhanapune.com" },
    ],
    estimatedSizeLabel: "About 1,200 companies",
  },
  {
    id: "s2",
    name: "Cloud kitchens running their own delivery",
    painPoint:
      "Aggregator commissions push cloud kitchens to deliver themselves, but they have no tool to batch orders by area.",
    criteria: ["Own delivery fleet", "3 or more brands from one kitchen", "Mumbai metro region"],
    exampleCompanies: [{ name: "Bombay Bowl Co", domain: "bombaybowl.co" }],
    estimatedSizeLabel: "About 450 companies",
  },
  {
    id: "s3",
    name: "Corporate meal caterers",
    painPoint:
      "Caterers deliver to office parks on fixed schedules and pay riders overtime when routes run long.",
    criteria: ["Office or factory clients", "More than 500 meals a day"],
    exampleCompanies: [],
    estimatedSizeLabel: "About 300 companies",
  },
]

/** A research run in each state the progress screen can show. */
export const RESEARCH_RUN_STATES: Record<string, { run: ResearchRunDetails; competitors: Competitor[]; segments: IcpSegment[] }> = {
  "step 1 running": {
    run: { ...FIXTURE_RUN, currentStage: "research_company", synthesizedProfile: null },
    competitors: [],
    segments: [],
  },
  "step 2 running": { run: FIXTURE_RUN, competitors: FIXTURE_COMPETITORS.slice(0, 2), segments: [] },
  "step 3 running": {
    run: { ...FIXTURE_RUN, currentStage: "define_segments" },
    competitors: FIXTURE_COMPETITORS,
    segments: [],
  },
  stalled: {
    run: { ...FIXTURE_RUN, stageStartedAt: minutesAgo(9), lastProgressAt: minutesAgo(7) },
    competitors: FIXTURE_COMPETITORS.slice(0, 2),
    segments: [],
  },
  failed: {
    run: { ...FIXTURE_RUN, status: "failed", failureReason: "web_search_attempt_limit" },
    competitors: FIXTURE_COMPETITORS.slice(0, 2),
    segments: [],
  },
  done: {
    run: { ...FIXTURE_RUN, status: "done", currentStage: "done" },
    competitors: FIXTURE_COMPETITORS,
    segments: FIXTURE_SEGMENTS,
  },
  "no segments": {
    run: { ...FIXTURE_RUN, status: "done", currentStage: "done" },
    competitors: FIXTURE_COMPETITORS,
    segments: [],
  },
}

export const FIXTURE_MAILBOX: MailboxInfo = {
  id: "fixture-mailbox",
  email: "priya@tiffinroute.in",
  provider: "gmail",
  status: "connected",
  dailySendCount: 2,
  lastSendResetDate: null,
}

const baseCampaign: CampaignData = {
  campaign: {
    id: "fixture-campaign",
    status: "awaiting_company_selection",
    currentStage: "awaiting_company_selection",
    failureReason: null,
    discoveryNote:
      "No companies matched these filters in Madhya Pradesh, India. Nothing was fetched or charged.",
    leadSearchOutcome: null,
    targetCountryCode: "IN",
    targetRegion: "Madhya Pradesh",
    createdAt: minutesAgo(30),
    stageStartedAt: minutesAgo(29),
    lastProgressAt: minutesAgo(28),
  },
  segment: { id: "s1", name: "Tiffin services with 10 to 40 riders", painPoint: FIXTURE_SEGMENTS[0].painPoint },
  researchRun: { id: "fixture-run", companyName: "Tiffin Route", websiteUrl: "https://tiffinroute.in" },
  usesCompanyDatabase: true,
  companies: [],
  contacts: [],
  skippedContacts: [],
  leadSummary: { reviewed: 0, verified: 0 },
  snapshots: [],
}

/** Find companies came back empty (the known Madhya Pradesh case). */
export const ZERO_COMPANIES_CAMPAIGN: CampaignData = baseCampaign

/** Companies were chosen, but no decision maker had a verified email. */
export const ZERO_VERIFIED_CAMPAIGN: CampaignData = {
  ...baseCampaign,
  campaign: {
    ...baseCampaign.campaign,
    status: "awaiting_approval",
    currentStage: "awaiting_approval",
    discoveryNote: null,
    targetRegion: "Maharashtra",
    leadSearchOutcome: {
      result: "out_of_companies",
      target: 10,
      verified: 0,
      peopleReviewed: 7,
      companiesExamined: 5,
      companiesNotReached: 0,
    },
  },
  usesCompanyDatabase: false,
  companies: [
    { id: "p1", name: "Annapurna Tiffins", domain: "annapurnatiffins.in", location: "Pune, Maharashtra", description: "" },
    { id: "p2", name: "Ghar Ka Khana Pune", domain: "gharkakhanapune.com", location: "Pune, Maharashtra", description: "" },
    { id: "p3", name: "Dabba Express", domain: "dabbaexpress.in", location: "Mumbai, Maharashtra", description: "" },
  ],
  skippedContacts: [
    { id: "k1", name: "Rohan Kulkarni", title: "Founder", companyName: "Annapurna Tiffins", reason: "No verified email" },
    { id: "k2", name: "Meera Shah", title: "Operations Head", companyName: "Dabba Express", reason: "No verified email" },
    { id: "k3", name: "Amit Joshi", title: "Owner", companyName: "Ghar Ka Khana Pune", reason: "Name couldn't be confirmed" },
  ],
  leadSummary: { reviewed: 7, verified: 0 },
}

/** Find companies stopped before or during the people search. Codes are the public (neutral) ones. */
const searchStopped = (failureReason: string): CampaignData => ({
  ...baseCampaign,
  campaign: {
    ...baseCampaign.campaign,
    id: `fixture-campaign-${failureReason}`,
    status: "failed",
    currentStage: "find_companies",
    failureReason,
    discoveryNote: null,
  },
})

export const SEARCH_STOPPED_CAMPAIGNS: Array<{ label: string; data: CampaignData }> = [
  { label: "A data source needs approval", data: searchStopped("data_source_needs_approval") },
  { label: "Out of data credits", data: searchStopped("data_credits_used_up") },
  { label: "Search is busy (rate-limited)", data: searchStopped("provider_rate_limited") },
  { label: "Campaign data limit reached", data: searchStopped("campaign_data_limit") },
  { label: "Search filters could not be built", data: searchStopped("search_filters_failed") },
]

export const NO_DRAFTS: Draft[] = []
