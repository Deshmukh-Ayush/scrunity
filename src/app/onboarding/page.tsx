import type { Metadata } from "next"
import { OnboardingFlowClient } from "@/components/onboarding/onboarding-flow-client"

export const metadata: Metadata = {
  title: "Onboarding — GTM Autonomous Outreach",
  description:
    "Set up your company, benchmark competitors, and generate verified ICP outreach campaigns.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-12">
      <OnboardingFlowClient />
    </main>
  )
}
