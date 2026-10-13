"use client"

import { useState } from "react"
import { CheckCircle2, Zap } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TOPUP_CONFIG } from "@/config/billing"
import { ModalTrigger } from "./modal-trigger"
import { startCheckout } from "./start-checkout"

const PACK_OPTIONS = [1, 2, 5]

/** One-time AI credit top-up (100 credits per pack), credited to the current period. */
export function BuyCreditsModal({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [packs, setPacks] = useState(1)
  const [loading, setLoading] = useState(false)

  const totalCredits = packs * TOPUP_CONFIG.credits
  const totalPrice = packs * TOPUP_CONFIG.priceUsd

  async function handleCheckout() {
    try {
      setLoading(true)
      const done = await startCheckout(
        { action: "topup", quantity: packs },
        {
          fallbackError: "Failed to initiate top-up checkout",
          simulatedMessage: `Dev simulated: Added ${totalCredits} credits to current period!`,
        }
      )
      if (done) setOpen(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to process top-up")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <ModalTrigger trigger={trigger} onOpen={() => setOpen(true)}>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 font-medium"
        >
          <Zap className="h-4 w-4 fill-amber-400 text-amber-500" />
          Buy Credits
        </Button>
      </ModalTrigger>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                <Zap className="h-5 w-5 fill-amber-500" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Instant AI Credit Top-Up
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Credited immediately to your current period. No renewal date
                  change.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Top-Up Pack:</span>
                <span className="font-medium text-foreground">
                  100 credits for ${TOPUP_CONFIG.priceUsd}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-sm font-medium">Number of packs:</span>
                <div
                  className="flex items-center gap-2"
                  role="radiogroup"
                  aria-label="Number of packs"
                >
                  {PACK_OPTIONS.map((count) => (
                    <Button
                      key={count}
                      role="radio"
                      aria-checked={packs === count}
                      variant={packs === count ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setPacks(count)}
                    >
                      {count}x ({count * 100})
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-baseline justify-between border-t border-border/40 pt-3">
                <div>
                  <div className="text-lg font-bold text-foreground">
                    +{totalCredits.toLocaleString("en-US")} AI Credits
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    = {totalCredits.toLocaleString("en-US")} additional prospect
                    outreach sends
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-foreground">
                    ${totalPrice}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    one-time charge
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>
                  Stages 1-3 (research, competitors, ICPs) remain free and
                  unlimited
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>
                  Credits are available instantly upon successful payment
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCheckout}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? "Redirecting..." : `Pay $${totalPrice} with Dodo`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
