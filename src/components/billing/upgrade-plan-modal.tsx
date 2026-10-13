"use client"

import { useState } from "react"
import { Plus, ShieldCheck, Sparkles, Users, Zap } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BILLING_CONFIG, type PlanTier } from "@/config/billing"
import { cn } from "@/lib/utils"
import { ModalTrigger } from "./modal-trigger"
import { startCheckout } from "./start-checkout"

const TIERS: PlanTier[] = ["pilot", "starter", "growth", "scale"]

function PlanOption({
  tier,
  isCurrent,
  isSelected,
  disabled,
  onSelect,
  onSubscribe,
}: {
  tier: PlanTier
  isCurrent: boolean
  isSelected: boolean
  disabled: boolean
  onSelect: () => void
  onSubscribe: () => void
}) {
  const config = BILLING_CONFIG[tier]

  return (
    <div
      onClick={onSelect}
      data-selected={isSelected || undefined}
      data-current={isCurrent || undefined}
      className={cn(
        "relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all",
        // "Most popular" styling takes precedence over the selection highlight.
        config.isPopular
          ? "border-primary/60 bg-primary/5 shadow-sm"
          : isSelected
            ? "border-foreground/40 bg-muted/40"
            : "border-border/60 hover:border-border",
        isCurrent && "ring-2 ring-primary/40"
      )}
    >
      {config.isPopular && (
        <Badge className="absolute -top-2.5 right-3 h-5 bg-primary text-[10px] font-semibold text-primary-foreground">
          Most Popular
        </Badge>
      )}
      {isCurrent && (
        <Badge
          variant="secondary"
          className="absolute -top-2.5 left-3 h-5 text-[10px] font-medium"
        >
          Current Plan
        </Badge>
      )}

      <div>
        <div className="text-sm font-semibold text-foreground">
          {config.name}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground">
            ${config.priceMonthly}
          </span>
          <span className="text-[11px] text-muted-foreground">/mo</span>
        </div>

        <div className="mt-3 space-y-2 border-t border-border/40 pt-3 text-[11px]">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Zap className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" />
            <span>{config.aiCredits.toLocaleString("en-US")} AI credits</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>
              {config.includedSeats} included seat
              {config.includedSeats > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>
              {config.maxActiveCampaigns === "unlimited"
                ? "Unlimited active campaigns"
                : `${config.maxActiveCampaigns} active campaign${config.maxActiveCampaigns > 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-border/40 pt-3">
        <Button
          size="sm"
          variant={
            isCurrent ? "outline" : config.isPopular ? "default" : "secondary"
          }
          className="h-8 w-full text-xs"
          disabled={isCurrent || disabled}
          onClick={(e) => {
            e.stopPropagation()
            onSubscribe()
          }}
        >
          {isCurrent ? "Active" : `Upgrade to ${config.name}`}
        </Button>
      </div>
    </div>
  )
}

/** Plan picker (Pilot, Starter, Growth, Scale) that starts a Dodo subscription checkout. */
export function UpgradePlanModal({
  currentPlan = "free",
  trigger,
}: {
  currentPlan?: string
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    currentPlan === "free" ? "starter" : (currentPlan as PlanTier)
  )
  const [loading, setLoading] = useState(false)

  async function handleSubscribe(plan: PlanTier) {
    try {
      setLoading(true)
      const done = await startCheckout(
        { action: "subscribe", plan },
        {
          fallbackError: "Failed to initiate subscription",
          simulatedMessage: `Dev simulated: Upgraded to ${BILLING_CONFIG[plan].name} plan!`,
        }
      )
      if (done) setOpen(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ModalTrigger trigger={trigger} onOpen={() => setOpen(true)}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="gap-1.5 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Change Plan
        </Button>
      </ModalTrigger>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              Choose your GTM plan
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Scale your outreach with guaranteed prospect delivery. Stages 1-3
              research are always free & uncapped on all tiers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-3 md:grid-cols-4">
            {TIERS.map((tier) => (
              <PlanOption
                key={tier}
                tier={tier}
                isCurrent={currentPlan.toLowerCase() === tier}
                isSelected={selectedPlan === tier}
                disabled={loading}
                onSelect={() => setSelectedPlan(tier)}
                onSubscribe={() => handleSubscribe(tier)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>
                Need extra team seats? Add unlimited teammates for a flat
                +$10/mo each on any plan.
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
