import * as React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { OnboardingFlowClient } from "@/components/onboarding/onboarding-flow-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Onboarding — GTM Autonomous Outreach",
  description: "Set up your company, benchmark competitors, and generate verified ICP outreach campaigns.",
  robots: {
    index: false,
    follow: false,
  },
};

function OnboardingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background py-8 sm:py-12 px-4 sm:px-6">
      <Suspense fallback={<OnboardingSkeleton />}>
        <OnboardingFlowClient />
      </Suspense>
    </main>
  );
}