"use client"

import * as React from "react"
import { List } from "@phosphor-icons/react"
import Link from "next/link"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { CollapseToggle } from "@/components/sidebar/collapse-toggle"
import Image from "next/image"
import { cn } from "@/lib/utils"

type OrgLike = {
  plan?: string | null
  name?: string | null
  logoUrl?: string | null
  subscriptionStatus?: string | null
}

interface DashboardTopbarProps {
  org?: OrgLike
  hasClientProjects?: boolean
  firstClientProjectId?: string
}

const EASE_DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)"

export function DashboardTopbar({
  org,
  hasClientProjects,
  firstClientProjectId,
}: DashboardTopbarProps) {
  const [open, setOpen] = React.useState(false)
  const canWhitelabel = org?.plan === "agency"
  const orgName = org?.name || "Workspace"

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [open])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs animate-in fade-in duration-200 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-65 flex-col bg-background shadow-2xl transition-transform duration-300 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ transitionTimingFunction: EASE_DRAWER }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div onClick={() => setOpen(false)} className="h-full w-full">
          <DashboardSidebar isMobile={true} org={org} />
        </div>
      </div>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="Toggle navigation menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] md:hidden"
          >
            <List className="h-5 w-5" />
          </button>
          <div className="hidden md:flex">
            <CollapseToggle />
          </div>
        </div>

        <div className="ml-1 flex min-w-0 flex-1 items-center md:hidden">
          {canWhitelabel && org?.logoUrl ? (
            <Image
              height={28}
              width={28}
              src={org.logoUrl}
              alt={orgName}
              className="h-6 w-auto max-w-24 rounded-sm object-contain"
            />
          ) : (
            <div className="flex items-center gap-2">
              <Image
                height={28}
                width={28}
                src="/logo/scrunity_logo_svg.svg"
                alt="Scrunity"
                className="h-4 w-auto object-contain dark:invert"
              />
              <h1 className="truncate text-sm font-semibold text-foreground">
                {orgName}
              </h1>
            </div>
          )}
        </div>

        <div className="hidden flex-1 md:flex items-center justify-end">
          {org?.subscriptionStatus === "past_due" && (
            <Link
              href="/dashboard/billing"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Payment past due — update billing</span>
            </Link>
          )}
        </div>
      </header>
    </>
  )
}