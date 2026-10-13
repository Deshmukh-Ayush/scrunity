/** Inngest event that starts each pipeline stage (see inngest/client.ts GtmEvents). */
export const RESEARCH_STAGE_EVENTS = {
  research_company: "gtm/research.requested",
  research_competitors: "gtm/research.explore_competitors",
  define_segments: "gtm/research.define_segments",
} as const

export const CAMPAIGN_STAGE_EVENTS = {
  find_companies: "gtm/campaign.find_companies",
  find_contacts: "gtm/campaign.find_contacts",
  write_emails: "gtm/campaign.write_emails",
} as const
