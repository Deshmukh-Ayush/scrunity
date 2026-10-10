"use client";

import * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BILLING_CONFIG,
  TOPUP_CONFIG,
  EXTRA_SEAT_CONFIG,
  type PlanTier,
} from "@/config/billing";
import {
  Zap,
  CheckCircle2,
  ExternalLink,
  Plus,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Modal to buy top-up credits (Step 1.4: 100 credits for $12 one-time).
 */
export function BuyCreditsModal({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [packs, setPacks] = useState(1);
  const [loading, setLoading] = useState(false);

  const totalCredits = packs * TOPUP_CONFIG.credits;
  const totalPrice = packs * TOPUP_CONFIG.priceUsd;

  async function handleCheckout() {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "topup", quantity: packs }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate top-up checkout");
      }
      if (data.devSimulated) {
        toast.success(`Dev simulated: Added ${totalCredits} credits to current period!`);
        setOpen(false);
        window.location.reload();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process top-up");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
          {trigger}
        </span>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5 font-medium">
          <Zap className="h-4 w-4 fill-amber-400 text-amber-500" />
          Buy Credits
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Zap className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Instant AI Credit Top-Up
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Credited immediately to your current period. No renewal date change.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Top-Up Pack:</span>
              <span className="font-medium text-foreground">
                100 credits for ${TOPUP_CONFIG.priceUsd}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-sm font-medium">Number of packs:</span>
              <div className="flex items-center gap-2">
                {[1, 2, 5].map((count) => (
                  <Button
                    key={count}
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

            <div className="border-t border-border/40 pt-3 flex justify-between items-baseline">
              <div>
                <div className="text-lg font-bold text-foreground">
                  +{totalCredits.toLocaleString()} AI Credits
                </div>
                <div className="text-[11px] text-muted-foreground">
                  = {totalCredits.toLocaleString()} additional prospect outreach sends
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-foreground">${totalPrice}</div>
                <div className="text-[11px] text-muted-foreground">one-time charge</div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Stages 1-3 (research, competitors, ICPs) remain free and unlimited</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Credits are available instantly upon successful payment</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCheckout} disabled={loading} className="gap-1.5">
            {loading ? "Redirecting..." : `Pay $${totalPrice} with Dodo`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/**
 * Modal to upgrade or switch plans (Step 2: Pilot, Starter, Growth, Scale).
 */
export function UpgradePlanModal({
  currentPlan = "free",
  trigger,
}: {
  currentPlan?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(
    currentPlan === "free" ? "starter" : (currentPlan as PlanTier)
  );
  const [loading, setLoading] = useState(false);

  const tiers: PlanTier[] = ["pilot", "starter", "growth", "scale"];

  async function handleSubscribe(plan: PlanTier) {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate subscription");
      }
      if (data.devSimulated) {
        toast.success(`Dev simulated: Upgraded to ${BILLING_CONFIG[plan].name} plan!`);
        setOpen(false);
        window.location.reload();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
          {trigger}
        </span>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Change Plan
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Choose your GTM plan</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Scale your outreach with guaranteed prospect delivery. Stages 1-3 research are always free & uncapped on all tiers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-3">
          {tiers.map((tierKey) => {
            const config = BILLING_CONFIG[tierKey];
            const isCurrent = currentPlan.toLowerCase() === tierKey;
            const isSelected = selectedPlan === tierKey;

            return (
              <div
                key={tierKey}
                onClick={() => setSelectedPlan(tierKey)}
                className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all ${
                  config.isPopular
                    ? "border-primary/60 bg-primary/5 shadow-sm"
                    : isSelected
                    ? "border-foreground/40 bg-muted/40"
                    : "border-border/60 hover:border-border"
                } ${isCurrent ? "ring-2 ring-primary/40" : ""}`}
              >
                {config.isPopular && (
                  <Badge className="absolute -top-2.5 right-3 text-[10px] h-5 bg-primary text-primary-foreground font-semibold">
                    Most Popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge variant="secondary" className="absolute -top-2.5 left-3 text-[10px] h-5 font-medium">
                    Current Plan
                  </Badge>
                )}

                <div>
                  <div className="font-semibold text-sm text-foreground">{config.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">
                      ${config.priceMonthly}
                    </span>
                    <span className="text-[11px] text-muted-foreground">/mo</span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-[11px]">
                    <div className="font-medium text-foreground flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      <span>{config.aiCredits.toLocaleString()} AI credits</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span>{config.includedSeats} included seat{config.includedSeats > 1 ? "s" : ""}</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {config.maxActiveCampaigns === "unlimited"
                          ? "Unlimited active campaigns"
                          : `${config.maxActiveCampaigns} active campaign${config.maxActiveCampaigns > 1 ? "s" : ""}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40">
                  <Button
                    size="sm"
                    variant={isCurrent ? "outline" : config.isPopular ? "default" : "secondary"}
                    className="w-full text-xs h-8"
                    disabled={isCurrent || loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubscribe(tierKey);
                    }}
                  >
                    {isCurrent ? "Active" : `Upgrade to ${config.name}`}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            <span>Need extra team seats? Add unlimited teammates for a flat +$10/mo each on any plan.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

/**
 * Modal to add extra teammate seats (Step 2: +$10/mo flat on any plan).
 */
export function AddSeatsModal({
  currentExtraSeats = 0,
  trigger,
}: {
  currentExtraSeats?: number;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const price = quantity * EXTRA_SEAT_CONFIG.priceMonthlyUsd;

  async function handleAddSeats() {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extra_seat", quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add seats");
      }
      if (data.devSimulated) {
        toast.success(`Dev simulated: Added ${quantity} extra teammate seat(s)!`);
        setOpen(false);
        window.location.reload();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process seat addition");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
          {trigger}
        </span>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" />
          Add Seats
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
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
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Currently active extra seats:</span>
              <span className="font-semibold text-foreground">{currentExtraSeats}</span>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-sm font-medium">Seats to add:</span>
              <div className="flex items-center gap-2">
                {[1, 2, 5].map((cnt) => (
                  <Button
                    key={cnt}
                    variant={quantity === cnt ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setQuantity(cnt)}
                  >
                    +{cnt} seat{cnt > 1 ? "s" : ""}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t border-border/40 pt-3 flex justify-between items-baseline">
              <div>
                <div className="text-lg font-bold text-foreground">
                  +{quantity} Team Seat{quantity > 1 ? "s" : ""}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Invite {quantity} more teammate{quantity > 1 ? "s" : ""} to your workspace
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-foreground">${price}/mo</div>
                <div className="text-[11px] text-muted-foreground">added to monthly billing</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleAddSeats} disabled={loading}>
            {loading ? "Redirecting..." : `Confirm +${quantity} Seat ($${price}/mo)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

/**
 * Direct link or trigger to open Dodo Payments customer portal.
 */
export function ManagePortalButton() {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    try {
      setLoading(true);
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load customer portal");
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to open billing portal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={openPortal}
      disabled={loading}
      className="gap-1.5 text-xs"
    >
      <CreditCard className="h-3.5 w-3.5" />
      {loading ? "Loading..." : "Manage in Dodo Portal"}
    </Button>
  );
}
