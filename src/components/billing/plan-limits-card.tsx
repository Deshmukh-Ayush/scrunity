import * as React from "react";
import { getTenantContext } from "@/lib/tenant-context";
import { db } from "@/utils/db";
import {
  organization,
  member,
  gtmOutreachCampaign,
  gtmResearchRun,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPlanLimits, getTotalAllowedSeats, getMaxActiveCampaigns, type PlanTier } from "@/config/billing";
import { AddSeatsModal, UpgradePlanModal } from "./billing-modals";
import { Target, Users, Search, CheckCircle2, ShieldCheck, Plus } from "lucide-react";

export async function PlanLimitsCard() {
  const { organizationId } = await getTenantContext();

  const [org] = await db
    .select({
      id: organization.id,
      plan: organization.plan,
      extraSeats: organization.extraSeats,
    })
    .from(organization)
    .where(eq(organization.id, organizationId));

  const planKey = (org?.plan || "free") as PlanTier;
  const planConfig = getPlanLimits(planKey);
  const maxActiveCampaigns = getMaxActiveCampaigns(planKey);
  const extraSeats = org?.extraSeats || 0;
  const totalSeats = getTotalAllowedSeats(planKey, extraSeats);

  // 1. Count currently active campaigns
  const activeCampaigns = await db
    .select({ id: gtmOutreachCampaign.id })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(
      and(
        eq(gtmResearchRun.organizationId, organizationId),
        inArray(gtmOutreachCampaign.status, ["in_progress", "awaiting_approval"])
      )
    );

  const activeCampaignsCount = activeCampaigns.length;

  // 2. Count active team members
  const members = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.organizationId, organizationId));

  const membersCount = members.length;

  return (
    <Card className="border-border/70 p-6">
      <CardHeader className="p-0 pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold break-words">Plan Limits at a Glance</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">
              Current operational capacities under the {planConfig.name} plan
            </p>
          </div>
          <div className="shrink-0">
            <UpgradePlanModal
              currentPlan={planKey}
              trigger={
                <button className="text-xs text-primary hover:underline font-medium">
                  View all tiers →
                </button>
              }
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
        {/* Active Campaigns */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Active Campaigns</span>
              <Target className="h-4 w-4 text-primary shrink-0" />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground">
                {activeCampaignsCount}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                / {maxActiveCampaigns === "unlimited" ? "Unlimited" : maxActiveCampaigns} allowed
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 break-words">
              Simultaneous in-flight or review outreach campaigns
            </p>
          </div>
          {maxActiveCampaigns !== "unlimited" && activeCampaignsCount >= maxActiveCampaigns && (
            <div className="mt-3 pt-2 border-t border-border/40 text-[11px] text-amber-500 font-medium break-words">
              {maxActiveCampaigns === 0
                ? "Subscribe to a plan to launch active outreach campaigns."
                : "Capacity reached. Upgrade to launch more."}
            </div>
          )}
        </div>

        {/* Team Seats */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Team Seats</span>
              <Users className="h-4 w-4 text-primary shrink-0" />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground">
                {membersCount}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                / {totalSeats >= 9999 ? "Unlimited" : totalSeats} total seat{totalSeats === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 break-words">
              {planConfig.includedSeats} included + {extraSeats} extra paid (+ $10/mo each)
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Add teammates</span>
            <AddSeatsModal currentExtraSeats={extraSeats} />
          </div>
        </div>

        {/* Stages 1-3 Research */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Stages 1-3 Research</span>
              <Search className="h-4 w-4 text-emerald-500 shrink-0" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold text-foreground">Unlimited</span>
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-semibold whitespace-nowrap">
                Free & Uncapped
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 break-words">
              Company research, competitor scans & ICP segmentation are never billed or credit-gated
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-border/40 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="break-words">Always available even with 0 credits</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
