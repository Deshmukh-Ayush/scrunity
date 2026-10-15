"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Zap } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { BILLING_HREF, NAV_ITEMS, isNavItemActive } from "./nav-config"
import { SidebarChats } from "./sidebar-chats"
import { SidebarItem } from "./sidebar-item"
import { WorkspaceMenu } from "./workspace-menu"

/**
 * Sidebar contents, top to bottom: workspace menu, main nav (NAV_ITEMS),
 * the collapsible Chats group, and the credits pill pinned at the bottom.
 * Used by the desktop column and the mobile drawer alike.
 */
export function SidebarContent({
  userId,
  userEmail,
  workspaceName,
  creditsRemaining,
}: {
  userId: string
  userEmail: string
  workspaceName: string
  creditsRemaining: number | null
}) {
  const pathname = usePathname()
  const tab = useSearchParams().get("tab")

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pt-2.5 pb-2">
        <WorkspaceMenu workspaceName={workspaceName} userEmail={userEmail} />
      </div>

      <div className="flex min-h-0 flex-1 scrollbar-thin flex-col gap-5 overflow-y-auto px-3 pt-2 pb-4">
        <nav aria-label="Main">
          <ul role="list" className="flex flex-col gap-px">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <SidebarItem
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  tone="nav"
                  current={isNavItemActive(item, pathname, tab)}
                />
              </li>
            ))}
          </ul>
        </nav>

        <SidebarChats userId={userId} />
      </div>

      {creditsRemaining !== null && (
        <div className="shrink-0 px-3 pt-2 pb-3">
          <CreditsPill credits={creditsRemaining} />
        </div>
      )}
    </div>
  )
}

export function CreditsPill({
  credits,
  "data-force": dataForce,
}: {
  credits: number
  "data-force"?: "hover" | "focus-visible"
}) {
  return (
    <Link
      href={BILLING_HREF}
      data-force={dataForce}
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-transparent bg-surface px-2.5 text-meta text-fg-default shadow-raised outline-none",
        "transition-[background-color,color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
        "ui-hover:bg-muted ui-focus:focus-ring"
      )}
    >
      <Zap className="size-3.5 text-fg-muted" />
      <span className="truncate tabular-nums">
        {credits.toLocaleString("en-US")} {credits === 1 ? "credit" : "credits"}{" "}
        left
      </span>
    </Link>
  )
}
