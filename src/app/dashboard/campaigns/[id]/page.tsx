import * as React from "react";
import { Suspense } from "react";
import { CampaignDetailClient } from "@/components/gtm/campaign-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

function CampaignDetailSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-8 animate-pulse max-w-5xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <div className="p-6 md:p-8">
      <Suspense fallback={<CampaignDetailSkeleton />}>
        <CampaignDetailClient />
      </Suspense>
    </div>
  );
}
