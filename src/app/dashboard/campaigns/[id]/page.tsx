import * as React from "react"
import { Suspense } from "react"
import { CampaignDetail } from "@/components/gtm/campaign-detail/campaign-detail"
import { Container } from "@/components/layout/container"
import { Skeleton } from "@/components/ui/skeleton"

function CampaignDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-96" />
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
    <Container width="page" className="max-w-5xl py-6 md:py-8">
      <Suspense fallback={<CampaignDetailSkeleton />}>
        <CampaignDetail campaignId={id} />
      </Suspense>
    </Container>
  )
}
