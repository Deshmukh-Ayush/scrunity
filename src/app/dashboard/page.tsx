import * as React from "react";
import { Suspense } from "react";
import { CampaignsList } from "@/components/gtm/campaigns-list";
import { Skeleton } from "@/components/ui/skeleton";

function CampaignsListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto h-full">
      <Suspense fallback={<CampaignsListSkeleton />}>
        <CampaignsList />
      </Suspense>
    </div>
  );
}
