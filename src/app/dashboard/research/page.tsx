import type { Metadata } from "next"
import { Container } from "@/components/layout/container"
import { ResearchOverview } from "@/components/gtm/research/research-overview"

export const metadata: Metadata = {
  title: "Research | Scrunity",
}

export default function ResearchPage() {
  return (
    <Container width="full" className="py-6 md:py-8">
      <ResearchOverview />
    </Container>
  )
}
