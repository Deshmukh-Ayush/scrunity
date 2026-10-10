import * as React from "react";
import { getTenantContext } from "@/lib/tenant-context";
import { db } from "@/utils/db";
import { organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BILLING_CONFIG, getPlanLimits, type PlanTier } from "@/config/billing";
import { UpgradePlanModal, ManagePortalButton } from "./billing-modals";
import { CreditCard, Calendar, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export async function PlanSubscriptionCard() {
  const { organizationId } = await getTenantContext();

  const [org] = await db
    .select({
      id: organization.id,
      plan: organization.plan,
      subscriptionStatus: organization.subscriptionStatus,
      currentPeriodEnd: organization.currentPeriodEnd,
      dodoCustomerId: organization.dodoCustomerId,
    })
    .from(organization)
    .where(eq(organization.id, organizationId));

  const planKey = (org?.plan || "free") as PlanTier;
  const planConfig = getPlanLimits(planKey);
  const isSubscribed = Boolean(
    org?.subscriptionStatus === "active" && planKey !== "free"
  );
  const status = org?.subscriptionStatus || (isSubscribed ? "active" : "unsubscribed");

  const statusBadge = {
    active: <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-medium">Active</Badge>,
    past_due: <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[11px] font-medium">Past Due</Badge>,
    canceled: <Badge variant="destructive" className="text-[11px] font-medium">Canceled</Badge>,
    trialing: <Badge variant="secondary" className="text-[11px] font-medium">Trialing</Badge>,
    unsubscribed: <Badge variant="secondary" className="text-[11px] font-medium">No Active Plan</Badge>,
  }[status] || <Badge variant="secondary" className="text-[11px] font-medium">{status}</Badge>;

  const renewalDateStr = org?.currentPeriodEnd
    ? new Date(org.currentPeriodEnd).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : isSubscribed
    ? "30 days from billing start"
    : "No active renewal";

  return (
    <Card className="flex flex-col justify-between border-border/70 p-6">
      <div>
        <CardHeader className="p-0 pb-4">
          <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
              <CardTitle className="text-base font-semibold break-words">Current Plan</CardTitle>
            </div>
            <div className="shrink-0">{statusBadge}</div>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1 break-words">
            Subscription billing powered by Dodo Payments.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-3 pt-1">
            <div className="min-w-0 flex-1">
              <div
                className="text-2xl font-bold tracking-tight text-foreground break-words"
                title={planConfig.name}
              >
                {planConfig.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 break-words">
                {planConfig.priceMonthly > 0
                  ? `Billed monthly ($${planConfig.priceMonthly}/mo)`
                  : "Free tier (no active subscription)"}
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1 sm:justify-end">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Renews on</span>
              </div>
              <div
                className="text-xs font-medium text-foreground mt-0.5 break-words"
                title={renewalDateStr}
              >
                {renewalDateStr}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
            <div className="flex items-start gap-2 text-foreground font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span className="break-words">
                {planConfig.aiCredits > 0
                  ? `Includes ${planConfig.aiCredits.toLocaleString()} AI prospect credits each month`
                  : "0 AI prospect credits included — subscribe to launch outreach"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span className="break-words">Stages 1-3 (research, competitors, ICPs) always free & uncapped</span>
            </div>
          </div>
        </CardContent>
      </div>

      <div className="mt-5 pt-4 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <UpgradePlanModal currentPlan={planKey} />
        <ManagePortalButton />
      </div>
    </Card>
  );
}
