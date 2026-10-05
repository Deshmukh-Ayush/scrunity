import * as React from "react";
import { Suspense } from "react";
import { CampaignsOverviewClient } from "@/components/gtm/campaigns-overview-client";
import { Skeleton } from "@/components/ui/skeleton";

function CampaignsOverviewSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-8 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <div className="p-6 md:p-8">
      <Suspense fallback={<CampaignsOverviewSkeleton />}>
        <CampaignsOverviewClient />
      </Suspense>
    </div>
  );
}
