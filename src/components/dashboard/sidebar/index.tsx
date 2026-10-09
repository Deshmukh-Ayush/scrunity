"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
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
import { Target, Sparkles } from "lucide-react"
import { AgentConversationNav } from "@/components/chat/agent-chat-sidebar"

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
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Target },
  { name: "Settings", href: "/dashboard/settings", icon: Gear },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
]

export function DashboardSidebar({
  isMobile = false,
  org,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { isCollapsed } = useSidebarCollapse(false)
  const canWhitelabel = org?.plan === "agency"
  const orgName = org?.name || "Workspace"

  // Mode switcher: "campaigns" vs "agent"
  const [mode, setMode] = React.useState<"campaigns" | "agent">(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/dashboard/chat")) {
        return "agent"
      }
      const saved = localStorage.getItem("scrunity:dashboard-mode")
      if (saved === "agent" || saved === "campaigns") {
        return saved
      }
    }
    return "campaigns"
  })

  // Sync mode with current pathname
  React.useEffect(() => {
    if (pathname.startsWith("/dashboard/chat")) {
      setMode("agent")
    }
  }, [pathname])

  // Track active conversation ID from search params
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("id")
    }
    return null
  })

  React.useEffect(() => {
    const updateActiveId = () => {
      if (typeof window !== "undefined") {
        const id = new URLSearchParams(window.location.search).get("id")
        setActiveConversationId(id)
      }
    }

    updateActiveId()
    window.addEventListener("popstate", updateActiveId)
    window.addEventListener("gtm:conversation-selected", updateActiveId as EventListener)
    return () => {
      window.removeEventListener("popstate", updateActiveId)
      window.removeEventListener("gtm:conversation-selected", updateActiveId as EventListener)
    }
  }, [pathname])

  const handleModeChange = (newMode: "campaigns" | "agent") => {
    setMode(newMode)
    try {
      localStorage.setItem("scrunity:dashboard-mode", newMode)
    } catch {}

    if (newMode === "agent") {
      if (!pathname.startsWith("/dashboard/chat")) {
        router.push("/dashboard/chat")
      }
    } else {
      if (pathname.startsWith("/dashboard/chat")) {
        router.push("/dashboard")
      }
    }
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed }}>
      <aside
        aria-label="Dashboard Sidebar"
        className={cn(
          "z-10 shrink-0 bg-background",
          isMobile
            ? "block min-h-svh w-full"
            : cn(
                "sticky top-0 hidden h-svh overflow-hidden border-r border-border/40 md:flex flex-col",
                "py-2 transition-[width] duration-200",
                isCollapsed ? "w-18" : mode === "agent" ? "w-72" : "w-63"
              )
        )}
        style={!isMobile ? { transitionTimingFunction: EASE_OUT } : undefined}
      >
        <div className="flex h-full w-full flex-col overflow-hidden">
          {/* PostHog-style Top-Level Mode Switcher */}
          <div className={cn("shrink-0", isCollapsed ? "px-2 pt-1 pb-2" : "px-3 pt-1 pb-2")}>
            {isCollapsed ? (
              <div className="flex flex-col gap-1 items-center bg-muted/60 p-1 rounded-xl border border-border/40">
                <button
                  type="button"
                  onClick={() => handleModeChange("campaigns")}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    mode === "campaigns"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Campaigns mode"
                >
                  <Target className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("agent")}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    mode === "agent"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Agent mode"
                >
                  <Sparkles className="size-4 text-primary" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/40 text-xs font-medium text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleModeChange("campaigns")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all",
                    mode === "campaigns"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "hover:text-foreground"
                  )}
                  title="Switch to Campaigns navigation"
                >
                  <Target className="size-3.5" />
                  <span>Campaigns</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("agent")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all",
                    mode === "agent"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "hover:text-foreground"
                  )}
                  title="Switch to Agent navigation"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Agent</span>
                </button>
              </div>
            )}
          </div>

          {/* Workspace Brand / Header */}
          <Link
            href="/dashboard"
            title="Go to Dashboard"
            className={cn(
              "flex h-12 shrink-0 cursor-pointer items-center justify-between gap-2 px-3 hover:bg-muted/50 transition-colors rounded-md mx-2 mb-1 active:scale-[0.96] origin-center",
              isCollapsed && "justify-center px-0 mx-1"
            )}
          >
            <SidebarBrand
              projectName={orgName}
              org={org}
              canWhitelabel={canWhitelabel}
            />
            {!isCollapsed && <CaretUpDownIcon size={16} className="shrink-0 text-muted-foreground" />}
          </Link>

          {/* Dynamic Nav List Swapped by Mode */}
          {mode === "campaigns" ? (
            /* Campaigns Mode: Original Navigation */
            <nav
              aria-label="Main Navigation"
              className="custom-scrollbar flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 py-4"
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
          ) : (
            /* Agent Mode: Unified Conversation History */
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
              <AgentConversationNav
                isCollapsed={isCollapsed}
                activeConversationId={activeConversationId}
                onSelectConversation={(id) => {
                  setActiveConversationId(id)
                  router.push(`/dashboard/chat?id=${id}`)
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("gtm:conversation-selected", { detail: { id } }))
                  }
                }}
                onNewChat={() => {
                  setActiveConversationId(null)
                  router.push("/dashboard/chat")
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("gtm:conversation-selected", { detail: { id: null } }))
                  }
                }}
              />

              <div className="mt-auto px-3 py-3 border-t border-border/40 shrink-0">
                <ProfileMenu />
              </div>
            </div>
          )}

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