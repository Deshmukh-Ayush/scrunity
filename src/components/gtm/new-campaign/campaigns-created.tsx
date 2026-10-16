import Link from "next/link"
import { CheckCircleSolid } from "@/components/icons/status"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

const campaigns = (n: number) =>
  new Intl.PluralRules("en").select(n) === "one" ? "1 campaign" : `${n} campaigns`

const surface = "rounded-xl border border-transparent bg-surface shadow-surface"

/**
 * Final step: a calm confirmation (completed, so the one emerald check),
 * what happens next in one sentence, and two ways on. If some segments
 * couldn't start, the first reason the server gave is shown as is.
 */
export function CampaignsCreated({
  campaignIds,
  requested,
  firstError,
}: {
  campaignIds: string[]
  requested: number
  firstError: string | null
}) {
  const started = campaignIds.length
  const notStarted = Math.max(0, requested - started)
  const viewCampaigns = (
    <Link href="/dashboard/campaigns" className={buttonVariants()}>
      View campaigns
    </Link>
  )

  if (started === 0) {
    return (
      <div className={surface}>
        <EmptyState
          role="alert"
          title="No campaigns were started"
          description={firstError ?? "The campaigns couldn't start. Try again from Research, or contact support."}
          actions={viewCampaigns}
        />
      </div>
    )
  }

  return (
    <div className={surface}>
      <EmptyState
        role="status"
        illustration={
          <span className="flex size-10 items-center justify-center rounded-full bg-success-tint text-success">
            <CheckCircleSolid className="size-5" />
          </span>
        }
        title={`${campaigns(started)} started`}
        description={
          notStarted > 0
            ? `${campaigns(notStarted)} couldn't start: ${firstError ?? "try it again from Research."}`
            : "Each one now finds companies in its segment, checks decision makers' emails and writes drafts for you to review. Nothing is sent until you approve it."
        }
        actions={
          <>
            {viewCampaigns}
            <Link href={`/dashboard/campaigns/${campaignIds[0]}`} className={buttonVariants()}>
              {started === 1 ? "Open campaign" : "Open the first campaign"}
            </Link>
          </>
        }
      />
    </div>
  )
}
