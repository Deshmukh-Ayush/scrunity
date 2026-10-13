import * as React from "react"
import { Suspense } from "react"
import { CampaignDetail } from "@/components/gtm/campaign-detail/campaign-detail"
import { Skeleton } from "@/components/ui/skeleton"

function CampaignDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="p-6 md:p-8">
      <Suspense fallback={<CampaignDetailSkeleton />}>
        <CampaignDetail campaignId={id} />
      </Suspense>
    </div>
  )
}
