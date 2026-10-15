import Link from "next/link"
import { ArrowRight, CheckCircle2, Users } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Final step: confirmation with links to the campaigns dashboard and first pipeline. */
export function CampaignsCreated({ campaignIds }: { campaignIds: string[] }) {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-6 text-center">
      <div className="flex justify-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-success-border bg-success-tint text-success">
          <CheckCircle2 className="size-7" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Campaigns Created Successfully!
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          We created {campaignIds.length} outreach campaign(s). The autonomous
          agent is now finding candidate companies, identifying decision-makers,
          and drafting cold emails for your review.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
        <Link
          href="/dashboard/campaigns"
          className={cn(
            buttonVariants({ variant: "default" }),
            "w-full gap-2 sm:w-auto"
          )}
        >
          <Users className="size-4" />
          View Campaigns Dashboard
        </Link>
        {campaignIds[0] && (
          <Link
            href={`/dashboard/campaigns/${campaignIds[0]}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full gap-2 sm:w-auto"
            )}
          >
            Open First Campaign Pipeline
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
