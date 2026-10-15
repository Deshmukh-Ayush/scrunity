"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import posthog from "posthog-js"
import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronUpDown, CreditCard, Settings } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { sidebarItemClassName } from "./sidebar-item"
import { BILLING_HREF, SETTINGS_HREF } from "./nav-config"

/**
 * The top of the sidebar: the workspace name, opening a menu with Settings,
 * Billing and Sign out. Each user has one workspace today, so this is a
 * menu, not a switcher.
 */
export function WorkspaceMenu({
  workspaceName,
  userEmail,
}: {
  workspaceName: string
  userEmail: string
}) {
  const router = useRouter()
  const initial = workspaceName.trim().charAt(0).toUpperCase() || "W"

  const signOut = async () => {
    posthog.reset()
    await authClient.signOut()
    router.push("/sign-in")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(sidebarItemClassName, "h-9 aria-expanded:bg-muted")}
      >
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-primary text-meta leading-none font-semibold text-primary-foreground"
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1 truncate">{workspaceName}</span>
        <ChevronUpDown className="text-fg-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        {userEmail && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">
              {userEmail}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
        <DropdownMenuItem render={<Link href={SETTINGS_HREF} />}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={BILLING_HREF} />}>
          <CreditCard />
          Billing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
