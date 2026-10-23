import type { Metadata } from "next"
import { NewResearchRun } from "@/components/gtm/new-campaign/new-research-run"

export const metadata: Metadata = {
  title: "New research run | Scrunity",
}

/** Each step sets its own Container width inside the flow. */
export default function NewCampaignPage() {
  return <NewResearchRun />
}
