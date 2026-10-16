import {
  CampaignFixtureDemo,
  ResearchDoneDemo,
  ResearchFormDemo,
  ResearchProfileDemo,
  ResearchProgressDemo,
  ResearchSegmentsDemo,
} from "./flow-demos"
import { ProcessCardStates } from "./process-demos"
import { SEARCH_STOPPED_CAMPAIGNS, ZERO_COMPANIES_CAMPAIGN, ZERO_VERIFIED_CAMPAIGN } from "./process-fixtures"
import type { ShowcaseEntry } from "./types"

export const processCardEntry: ShowcaseEntry = {
  id: "process-card",
  name: "Process card",
  group: "Display",
  description:
    "A multi-stage process in one card: title, count pill and timer, a track of N stage tiles, honest progress (determinate only with real counts), a bounded activity log of real facts, one status sentence and real controls. States: idle, running, stalled, failed, done, no results, paused. Next state steps through a real sequence to show the motion; the checkbox turns all motion off.",
  render: () => <ProcessCardStates />,
}

export const researchFormEntry: ShowcaseEntry = {
  id: "research-form",
  name: "New research run: company form",
  group: "Flows",
  description:
    "Three sections, inline errors beside the field (submit with empty fields to see them), one brand button. The fixture never posts.",
  render: () => <ResearchFormDemo />,
}

export const researchProgressEntry: ShowcaseEntry = {
  id: "research-progress",
  name: "New research run: research in progress",
  group: "Flows",
  description: "The research run on the ProcessCard, from fixture rows: each step running, stalled, failed, done and no segments.",
  render: () => <ResearchProgressDemo />,
}

export const researchProfileEntry: ShowcaseEntry = {
  id: "research-profile",
  name: "New research run: confirm profile",
  group: "Flows",
  description: "Summary, two-column details, quiet signal chips. Edit description opens the field and the re-run action.",
  render: () => <ResearchProfileDemo />,
}

export const researchSegmentsEntry: ShowcaseEntry = {
  id: "research-segments",
  name: "New research run: choose segments",
  group: "Flows",
  description:
    "Rows with a native checkbox (Space toggles) and a separate expand button. Outer: name, size estimate, one line of pain. Opened: full pain, criteria, examples. Sticky footer with the count and the one brand action.",
  render: () => <ResearchSegmentsDemo />,
}

export const researchDoneEntry: ShowcaseEntry = {
  id: "research-done",
  name: "New research run: campaigns started",
  group: "Flows",
  description: "Calm confirmation with the emerald check, plus the partial and failed endings.",
  render: () => <ResearchDoneDemo />,
}

export const campaignZeroCompaniesEntry: ShowcaseEntry = {
  id: "campaign-zero-companies",
  name: "Campaign page: no companies found",
  group: "Flows",
  description: "The real campaign parts on a fixture where Find companies returned nothing. Fixture mode: no polling, every action is a no-op.",
  render: () => <CampaignFixtureDemo data={ZERO_COMPANIES_CAMPAIGN} />,
}

export const campaignSearchStoppedEntry: ShowcaseEntry = {
  id: "campaign-search-stopped",
  name: "Campaign page: search stopped",
  group: "Flows",
  description:
    "Find companies failed before anything was found: a data source needs approval, out of data credits, rate-limited, the campaign's data limit, and filters that could not be built. Zero results is the 'no companies found' entry.",
  render: () => (
    <div className="flex w-full flex-col gap-10">
      {SEARCH_STOPPED_CAMPAIGNS.map(({ label, data }) => (
        <div key={data.campaign.id} className="flex flex-col gap-2" data-demo-state={data.campaign.failureReason}>
          <p className="text-meta text-fg-muted">{label}</p>
          <CampaignFixtureDemo data={data} />
        </div>
      ))}
    </div>
  ),
}

export const campaignZeroVerifiedEntry: ShowcaseEntry = {
  id: "campaign-zero-verified",
  name: "Campaign page: no verified contacts",
  group: "Flows",
  description: "Found 0 of 10: people were checked, none had a verified email. Shows the reviewed count and the Skipped list.",
  render: () => <CampaignFixtureDemo data={ZERO_VERIFIED_CAMPAIGN} />,
}
