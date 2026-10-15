"use client"

import { useState } from "react"
import { Plus, Users } from "lucide-react"
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
import { EXTRA_SEAT_CONFIG } from "@/config/billing"
import { ModalTrigger } from "./modal-trigger"
import { startCheckout } from "./start-checkout"

const SEAT_OPTIONS = [1, 2, 5]

/** Adds teammate seats at a flat monthly price on any plan. */
export function AddSeatsModal({
  currentExtraSeats = 0,
  trigger,
}: {
  currentExtraSeats?: number
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

  const price = quantity * EXTRA_SEAT_CONFIG.priceMonthlyUsd
  const plural = quantity > 1 ? "s" : ""

  async function handleAddSeats() {
    try {
      setLoading(true)
      const done = await startCheckout(
        { action: "extra_seat", quantity },
        {
          fallbackError: "Failed to add seats",
          simulatedMessage: `Dev simulated: Added ${quantity} extra teammate seat(s)!`,
        }
      )
      if (done) setOpen(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to process seat addition")
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
          className="gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Seats
        </Button>
      </ModalTrigger>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Add Teammate Seats
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Flat +$10/month per teammate seat on any plan.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Currently active extra seats:</span>
                <span className="font-semibold text-foreground">
                  {currentExtraSeats}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-sm font-medium">Seats to add:</span>
                <div
                  className="flex items-center gap-2"
                  role="radiogroup"
                  aria-label="Seats to add"
                >
                  {SEAT_OPTIONS.map((cnt) => (
                    <Button
                      key={cnt}
                      role="radio"
                      aria-checked={quantity === cnt}
                      variant={quantity === cnt ? "secondary" : "ghost"}
                      size="md"
                      className="px-3"
                      onClick={() => setQuantity(cnt)}
                    >
                      +{cnt} seat{cnt > 1 ? "s" : ""}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-baseline justify-between border-t border-border/40 pt-3">
                <div>
                  <div className="text-lg font-bold text-foreground">
                    +{quantity} Team Seat{plural}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Invite {quantity} more teammate{plural} to your workspace
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-foreground">
                    ${price}/mo
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    added to monthly billing
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" size="sm" onClick={handleAddSeats} disabled={loading}>
              {loading
                ? "Redirecting..."
                : `Confirm +${quantity} Seat ($${price}/mo)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
