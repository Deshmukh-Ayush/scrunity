import type { Metadata } from "next"
import { Onboard } from "@/components/onboarding/onboard"

export const metadata: Metadata = {
  title: "Create your organization",
  description: "Name your workspace to start using Scrunity.",
  robots: {
    index: false,
    follow: false,
  },
}

// Access is decided in src/proxy.ts: signed-out users go to /sign-in and users
// who already belong to an organization go to /dashboard.
export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background">
      <Onboard />
    </main>
  )
}
