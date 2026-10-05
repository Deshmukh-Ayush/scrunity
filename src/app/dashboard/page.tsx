import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedTenant } from "@/utils/cached-tenant";
import { getCachedOrg } from "@/utils/cached-org-queries";
import Link from "next/link";
import { ArrowRight, CreditCard, Gear } from "@phosphor-icons/react/dist/ssr";

async function DashboardOverviewData() {
  const { user, organizationId } = await getCachedTenant();
  const org = organizationId ? await getCachedOrg(organizationId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border/40 bg-card p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Welcome back, {user?.name || "Workspace Member"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organization: <span className="font-medium text-foreground">{org?.name || "Workspace"}</span> · Plan:{" "}
              <span className="font-medium capitalize text-foreground">{org?.plan || "Free"}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-xs transition-transform hover:bg-muted active:scale-[0.96]"
            >
              <CreditCard className="h-4 w-4 text-brand" />
              <span>Billing & Plans</span>
            </Link>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-transform hover:bg-brand-hover active:scale-[0.96]"
            >
              <Gear className="h-4 w-4" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 bg-card p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription</span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 capitalize">
                {org?.subscriptionStatus || "Active"}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground capitalize">
              {org?.plan || "Free"} Tier
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Access billing management, invoices, and checkout settings.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/30">
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              Manage subscription <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace Hub</span>
              <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                Ready
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
              Organization Settings
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure team members, organization branding, and preferences.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border/30">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              Open settings <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace dashboard and account management.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-[240px] w-full rounded-xl" />}>
        <DashboardOverviewData />
      </Suspense>
    </div>
  );
}
