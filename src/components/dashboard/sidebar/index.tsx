// components/dashboard/sidebar.tsx
"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ProfileMenu } from "@/components/sidebar/profile-menu"
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse"
import { SidebarBrand } from "@/components/sidebar/brand"
import { cn } from "@/lib/utils"
import {
  SidebarContext,
  NavItem,
  NavItemLabel,
} from "@/components/sidebar/nav-items"
import { 
  CaretUpDownIcon, 
  House, 
  Gear, 
  CreditCard 
} from "@phosphor-icons/react"

type OrgLike = {
  plan?: string | null
  name?: string | null
  logoUrl?: string | null
}

type DashboardSidebarProps = {
  isMobile?: boolean
  org?: OrgLike
}

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"

const dashboardNavItems = [
  { name: "Overview", href: "/dashboard", icon: House },
  { name: "Settings", href: "/dashboard/settings", icon: Gear },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
]

export function DashboardSidebar({
  isMobile = false,
  org,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { isCollapsed } = useSidebarCollapse(false)
  const canWhitelabel = org?.plan === "agency"
  const orgName = org?.name || "Workspace"

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <aside
        aria-label="Dashboard Sidebar"
        className={cn(
          "z-10 shrink-0 bg-background",
          isMobile
            ? "block min-h-svh w-full"
            : cn(
                "sticky top-0 hidden h-svh overflow-hidden border-r border-border/40 md:flex",
                "py-2 transition-[width] duration-200",
                isCollapsed ? "w-18" : "w-63"
              )
        )}
        style={!isMobile ? { transitionTimingFunction: EASE_OUT } : undefined}
      >
        <div className="flex h-full w-full flex-col overflow-hidden">
          <Link
            href="/dashboard"
            title="Go to Dashboard"
            className={cn(
              "flex h-14 shrink-0 cursor-pointer items-center justify-between gap-2 px-4 hover:bg-muted/50 transition-colors rounded-md mx-1 my-1 active:scale-[0.96] origin-center",
              isCollapsed && "justify-center px-0"
            )}
          >
            <SidebarBrand
              projectName={orgName}
              org={org}
              canWhitelabel={canWhitelabel}
            />
            {!isCollapsed && <CaretUpDownIcon size={18} className="shrink-0 text-muted-foreground" />}
          </Link>

          <nav
            aria-label="Main Navigation"
            className="custom-scrollbar flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-6"
          >
            <div>
              <ul role="list" className="space-y-0.5">
                {dashboardNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard")
                  
                  return (
                    <li key={item.name}>
                      <NavItem asChild isActive={isActive} title={item.name} className="active:scale-[0.96] transition-transform origin-center">
                        <Link href={item.href}>
                          <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                          <NavItemLabel>{item.name}</NavItemLabel>
                        </Link>
                      </NavItem>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-auto pt-4">
              <ProfileMenu />
            </div>
          </nav>

          {!canWhitelabel && (
            <div
              className={cn(
                "shrink-0 border-t border-border/40 transition-[padding] duration-200",
                isCollapsed ? "p-2" : "px-4 py-3"
              )}
            >
              {!isCollapsed && (
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/40 select-none">
                  <span>Powered by</span>
                  <Image
                    width={80}
                    height={20}
                    src="/logo/scrunity_logo_svg.svg"
                    alt="Scrunity"
                    className="h-3 w-auto object-contain opacity-60 dark:invert"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </SidebarContext.Provider>
  )
}