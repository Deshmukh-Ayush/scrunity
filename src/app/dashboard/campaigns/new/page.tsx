import type { Metadata } from "next"
import { NewCampaignFlow } from "@/components/gtm/new-campaign/new-campaign-flow"

export const metadata: Metadata = {
  title: "New research run | Scrunity",
}

/** Each step sets its own Container width inside the flow. */
export default function NewCampaignPage() {
  return <NewCampaignFlow />
}
