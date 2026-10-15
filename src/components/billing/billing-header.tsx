import * as React from "react";
import { getTenantContext } from "@/lib/tenant-context";
import { db } from "@/utils/db";
import { organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { ManagePortalButton } from "./manage-portal-button";

export async function BillingHeader() {
  const { organizationId } = await getTenantContext();

  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      subscriptionStatus: organization.subscriptionStatus,
      dodoCustomerId: organization.dodoCustomerId,
    })
    .from(organization)
    .where(eq(organization.id, organizationId));

  const isPastDue = org?.subscriptionStatus === "past_due";

  return (
    <div className="flex flex-col gap-4">
      {/* Step 3.5: Amber dunning banner for past_due subscriptions */}
      {isPastDue && (
        <div className="rounded-lg border border-warning-border bg-warning-tint p-4 text-warning">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-sm">Payment Past Due</p>
                <p className="text-xs text-warning break-words">
                  Your last subscription renewal could not be processed. Please update your payment method to prevent outreach pausing.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ManagePortalButton />
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Billing & AI Credits
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your GTM subscription, monitor prospect AI credit usage, and top up balance.
        </p>
      </div>
    </div>
  );
}
