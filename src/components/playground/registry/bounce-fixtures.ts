import type { CampaignData, Company, Contact, Draft } from "@/components/gtm/campaign-detail/types"

/**
 * An imported-list campaign paused for bounces: 23 emails sent, 3 bounced
 * (13%, over the 5% rule), 2 approved emails waiting. Invented people at
 * .example domains only. One address is long, for the 320px check.
 */

const PEOPLE: Array<[string, string, string]> = [
  ["Ana Ortiz", "ana.ortiz@northwind.example", "Northwind Studio"],
  ["Ben Lee", "ben@harbor-labs.example", "Harbor Labs"],
  ["Dev Rao", "dev@quartz.example", "Quartz Analytics"],
  ["Eli Moss", "eli.moss@lumen.example", "Lumen Works"],
  ["Fay Chen", "fay@orbit.example", "Orbit Freight"],
  ["Hana Ito", "hana.ito@meadow.example", "Meadow Health"],
  ["Ivo Novak", "ivo@delta-forge.example", "Delta Forge"],
  ["Jo Kim", "jo.kim@cedar.example", "Cedar Legal"],
  ["Kai Ward", "kai@birch.example", "Birch Dental"],
  ["Lena Fox", "lena.fox@aster.example", "Aster Freight"],
  ["Max Roy", "max@linden.example", "Linden Labs"],
  ["Nia Cole", "nia.cole@maple.example", "Maple Clinics"],
  ["Omar Haddad", "omar@spruce.example", "Spruce Logistics"],
  ["Pia Lund", "pia.lund@willow.example", "Willow Studio"],
  ["Raj Iyer", "raj@hazel.example", "Hazel Foods"],
  ["Sara Holm", "sara.holm@juniper.example", "Juniper Care"],
  ["Tom Berg", "tom@alder.example", "Alder Works"],
  ["Uma Shah", "uma.shah@poplar.example", "Poplar Health"],
  ["Vik Das", "vik@rowan.example", "Rowan Freight"],
  ["Wen Liu", "wen.liu@yew.example", "Yew Analytics"],
  ["Xan Pope", "xan@elm.example", "Elm Partners"],
  ["Yara Nasr", "yara.nasr@fir.example", "Fir Dental"],
  ["Zed Hart", "maximilian.hartmann-oberstrasse@very-long-company-domain-name.example", "Hartmann Oberstrasse Logistik"],
  ["Ada Moon", "ada@larch.example", "Larch Studio"],
  ["Bo Grant", "bo.grant@oak.example", "Oak Clinics"],
]
const BOUNCED = new Set([2, 9, 22])

const company = (name: string, email: string, i: number): Company => ({
  id: `bc${i}`,
  name,
  domain: email.slice(email.indexOf("@") + 1),
  location: "Berlin, Germany",
  description: "",
})
const contact = (name: string, email: string, i: number): Contact => ({
  id: `bp${i}`,
  name,
  title: "Founder",
  email,
  emailSource: "user_provided",
  linkedinUrl: null,
  prospectCompanyId: `bc${i}`,
})

export const BOUNCE_DRAFTS: Draft[] = PEOPLE.map(([name, email, org], i) => {
  const sent = i < 23
  return {
    id: `bd${i}`,
    subject: `A shorter route for ${org}`,
    body: "Fixture body.",
    status: !sent ? "approved" : BOUNCED.has(i) ? "failed" : "sent",
    sentAt: sent ? `2026-10-22T0${Math.floor(i / 10)}:${String((i % 10) * 5).padStart(2, "0")}:00.000Z` : null,
    hasBounced: BOUNCED.has(i),
    errorMessage: BOUNCED.has(i) ? "Email bounced (recipient address not found)." : null,
    createdAt: "2026-10-21T18:00:00.000Z",
    reviewedBy: "fixture-user",
    reviewedAt: "2026-10-21T19:00:00.000Z",
    contact: contact(name, email, i),
    company: company(org, email, i),
  }
})

export const BOUNCE_PAUSED_CAMPAIGN: CampaignData = {
  campaign: {
    id: "fixture-bounce-paused",
    status: "paused_bounce_rate",
    currentStage: "send_emails",
    failureReason: "paused_bounce_rate",
    discoveryNote: "25 people at 25 companies from conference-leads-q4.csv.",
    leadSearchOutcome: null,
    targetCountryCode: "DE",
    targetRegion: "Berlin",
    bounceGuardSince: null,
    createdAt: "2026-10-21T17:00:00.000Z",
    stageStartedAt: "2026-10-22T00:00:00.000Z",
    lastProgressAt: "2026-10-22T02:10:00.000Z",
  },
  segment: { id: "bs1", name: "Logistics firms with 20 to 200 staff", painPoint: "Manual route planning." },
  researchRun: { id: "bounce-run", companyName: "Route Example", websiteUrl: "https://route.example" },
  usesCompanyDatabase: true,
  companies: PEOPLE.map(([, email, org], i) => ({ ...company(org, email, i), selectionStatus: "selected" as const, fitScore: 70 })),
  contacts: PEOPLE.filter((_, i) => !BOUNCED.has(i)).map(([name, email], i) => contact(name, email, i)),
  skippedContacts: [...BOUNCED].map((i) => ({ id: `bp${i}`, name: PEOPLE[i][0], title: "Founder", companyName: PEOPLE[i][2], reason: "Email bounced" })),
  leadSummary: { reviewed: 25, verified: 0, fromList: 22 },
  snapshots: [],
}
