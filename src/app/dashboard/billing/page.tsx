import * as React from "react";
import { Suspense } from "react";
import { BillingHeader } from "@/components/billing/billing-header";
import { PlanSubscriptionCard } from "@/components/billing/plan-subscription-card";
import { AiCreditBalanceCard } from "@/components/billing/ai-credit-balance-card";
import { PlanLimitsCard } from "@/components/billing/plan-limits-card";
import { CreditUsageSection } from "@/components/billing/credit-usage-section";
import { BillingInvoicesCard } from "@/components/billing/billing-invoices-card";
import {
  BillingHeaderSkeleton,
  PlanCardSkeleton,
  CreditBalanceSkeleton,
  PlanLimitsSkeleton,
  UsageChartSkeleton,
  InvoicesSkeleton,
} from "@/components/billing/billing-skeletons";

export const metadata = {
  title: "Billing & AI Credits | Scrunity",
  description: "Manage subscription plans, monitor AI credits, and view payment history.",
};

export default function BillingPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6 lg:p-8 overflow-y-auto h-full min-w-0">
      <Suspense fallback={<BillingHeaderSkeleton />}>
        <BillingHeader />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<PlanCardSkeleton />}>
          <PlanSubscriptionCard />
        </Suspense>
        <Suspense fallback={<CreditBalanceSkeleton />}>
          <AiCreditBalanceCard />
        </Suspense>
      </div>

      <Suspense fallback={<PlanLimitsSkeleton />}>
        <PlanLimitsCard />
      </Suspense>

      <Suspense fallback={<UsageChartSkeleton />}>
        <CreditUsageSection />
      </Suspense>

      <Suspense fallback={<InvoicesSkeleton />}>
        <BillingInvoicesCard />
      </Suspense>
    </div>
  );
}
