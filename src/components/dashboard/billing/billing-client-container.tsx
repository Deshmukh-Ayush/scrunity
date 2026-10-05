"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { PlanConfig, PlanTier } from "@/config/billing";

import { toast } from "sonner";

interface BillingClientContainerProps {
  organization: {
    id: string;
    name: string;
    plan: string;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
  };
  config: Record<PlanTier, PlanConfig>;
  userEmail: string;
}

export function BillingClientContainer({ organization, config, userEmail }: BillingClientContainerProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleCheckout = async (planKey: string) => {
    setIsLoading(planKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, organizationId: organization.id, email: userEmail }),
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || "Failed to initiate checkout");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Something went wrong initiating checkout");
    } finally {
      setIsLoading(null);
    }
  };

  const handlePortal = async () => {
    setIsLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id }),
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to load customer portal");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan: {config[organization.plan as PlanTier]?.name || "Free"}</CardTitle>
          <CardDescription>
            Status: {organization.subscriptionStatus || "Active"}
            {organization.currentPeriodEnd && (
              <span className="ml-2">• Renews: {new Date(organization.currentPeriodEnd).toLocaleDateString()}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You are currently on the {organization.plan} plan. 
          </p>
        </CardContent>
        {organization.plan !== "free" && (
          <CardFooter>
            <Button variant="outline" onClick={handlePortal} disabled={isLoading === "portal"}>
              {isLoading === "portal" ? "Loading..." : "Manage Subscription"}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(Object.entries(config) as [PlanTier, PlanConfig][]).map(([key, plan]) => {
          if (key === "free") return null; // Skip free in the upgrade grid

          const isCurrentPlan = organization.plan === key;

          return (
            <Card key={key} className={isCurrentPlan ? "border-primary shadow-sm" : ""}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription className="text-2xl font-bold text-foreground mt-2">
                  {plan.priceMonthly === 0 ? "Custom" : `$${plan.priceMonthly}/mo`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrentPlan ? (
                  <Button className="w-full" variant="outline" disabled>Current Plan</Button>
                ) : key === "enterprise" ? (
                  <Button className="w-full" variant="outline" onClick={() => window.location.href = "mailto:sales@scrunity.com"}>
                    Contact Sales
                  </Button>
                ) : (
                  <Button 
                    className="w-full" 
                    onClick={() => handleCheckout(key)}
                    disabled={!!isLoading}
                  >
                    {isLoading === key ? "Loading..." : "Upgrade"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
