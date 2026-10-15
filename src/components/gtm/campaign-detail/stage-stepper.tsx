"use client"

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  Users,
} from "@/components/ui/icons"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useCampaignDetail } from "./campaign-detail-root"

// The two database-mode stops sit where they happen; neither has its own step.
const STAGE_ORDER = [
  "find_companies",
  "awaiting_company_selection",
  "find_contacts",
  "done_for_now",
  "write_emails",
  "awaiting_approval",
  "send_emails",
  "done",
]

const STEPS = [
  { id: "find_companies", label: "1. Find Companies", icon: Building2 },
  { id: "find_contacts", label: "2. Verified Contacts", icon: Users },
  { id: "write_emails", label: "3. Write Emails", icon: Mail },
  { id: "awaiting_approval", label: "4. Human Review", icon: CheckCircle2 },
  { id: "send_emails", label: "5. Throttled Sending", icon: Send },
]

/** Five-step pipeline progress; each step is past, current (running or stalled) or upcoming. */
export function StageStepper() {
  const { data, staleness } = useCampaignDetail()
  const { campaign } = data
  const currentIndex = STAGE_ORDER.indexOf(campaign.currentStage)
  const isDone = campaign.status === "done"

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <ol className="grid grid-cols-2 gap-3 text-center text-xs md:grid-cols-5">
          {STEPS.map((step, i) => {
            const state =
              campaign.currentStage === step.id && !isDone
                ? staleness.isStalled
                  ? "stalled"
                  : "current"
                : currentIndex > i || isDone
                  ? "past"
                  : "upcoming"
            const Icon = step.icon
            const isSpinning =
              state === "current" && campaign.status === "in_progress"

            return (
              <li
                key={step.id}
                data-state={state}
                aria-current={
                  state === "current" || state === "stalled"
                    ? "step"
                    : undefined
                }
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all",
                  "data-[state=current]:border-primary data-[state=current]:bg-primary/5 data-[state=current]:font-medium data-[state=current]:text-primary data-[state=current]:ring-1 data-[state=current]:ring-primary/20",
                  "data-[state=stalled]:border-warning-border data-[state=stalled]:bg-warning-tint data-[state=stalled]:font-medium data-[state=stalled]:text-warning data-[state=stalled]:ring-1 data-[state=stalled]:ring-warning-border",
                  "data-[state=past]:border-border data-[state=past]:bg-muted/30 data-[state=past]:text-foreground",
                  "data-[state=upcoming]:border-dashed data-[state=upcoming]:text-muted-foreground data-[state=upcoming]:opacity-60"
                )}
              >
                <div className="flex items-center gap-1.5">
                  {state === "stalled" && campaign.status === "in_progress" ? (
                    <AlertCircle className="size-4 text-warning" />
                  ) : isSpinning ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                <span>{step.label}</span>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
