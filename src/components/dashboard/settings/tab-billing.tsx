"use client"

import { BillingPlans } from "@/components/dashboard/billing-plans"

interface TabBillingProps {
  orgId: string
  currentPlan: string
}

export function TabBilling({ orgId, currentPlan }: TabBillingProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Billing & Subscription Plans
        </h2>
        <p className="text-xs text-muted-foreground">
          Manage your workspace subscription tier, plan features, and billing limits.
        </p>
      </div>

      <BillingPlans orgId={orgId} currentPlan={currentPlan} />
    </div>
  )
}
