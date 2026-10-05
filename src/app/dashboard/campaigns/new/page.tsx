import * as React from "react";
import { Suspense } from "react";
import { NewCampaignClient } from "@/components/gtm/new-campaign-client";
import { Skeleton } from "@/components/ui/skeleton";

function NewCampaignSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <div className="p-6 md:p-8">
      <Suspense fallback={<NewCampaignSkeleton />}>
        <NewCampaignClient />
      </Suspense>
    </div>
  );
}
