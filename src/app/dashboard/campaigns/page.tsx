import type { Metadata } from "next"
import { Container } from "@/components/layout/container"
import { CampaignsOverview } from "@/components/gtm/campaigns-overview/campaigns-overview"

export const metadata: Metadata = {
  title: "Campaigns | Scrunity",
}

export default function CampaignsPage() {
  return (
    <Container width="full" className="py-6 md:py-8">
      <CampaignsOverview />
    </Container>
  )
}
