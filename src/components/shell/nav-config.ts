import { Home, Mail, Target, Users } from "@/components/ui/icons"

/**
 * The sidebar's main navigation. Only routes that exist and work today belong
 * here: no placeholders, no "coming soon". A new section (Inbox, Tasks,
 * Companies, People, Deals, Lists) is added with one line once its route ships.
 */
export interface NavItemConfig {
  label: string
  href: string
  icon: typeof Home
  /** Also selected on these path prefixes (sub-pages). */
  matchPrefix?: boolean
}

export const NAV_ITEMS: NavItemConfig[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  {
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: Target,
    matchPrefix: true,
  },
  { label: "Leads", href: "/dashboard/leads", icon: Users, matchPrefix: true },
  { label: "Mailbox", href: "/dashboard/mailbox", icon: Mail },
]

/** Where the workspace menu sends people (not part of the main nav). */
export const SETTINGS_HREF = "/dashboard/mailbox?tab=settings"
export const BILLING_HREF = "/dashboard/billing"

export function isNavItemActive(
  item: NavItemConfig,
  pathname: string,
  tab: string | null
) {
  // Settings lives on the mailbox route; while it is open, Mailbox is not the current page.
  if (item.href === "/dashboard/mailbox")
    return pathname === item.href && tab !== "settings"
  if (pathname === item.href) return true
  return Boolean(item.matchPrefix && pathname.startsWith(`${item.href}/`))
}

/**
 * Breadcrumb trail for the top bar: the current page, plus its parent where
 * one exists. Unknown paths fall back to Home.
 */
export interface Crumb {
  label: string
  href?: string
}

export function breadcrumbsFor(pathname: string, tab: string | null): Crumb[] {
  const campaigns = { label: "Campaigns", href: "/dashboard/campaigns" }
  if (pathname === "/dashboard/campaigns/new")
    return [campaigns, { label: "New campaign" }]
  if (pathname.startsWith("/dashboard/campaigns/"))
    return [campaigns, { label: "Campaign" }]
  if (pathname === "/dashboard/campaigns") return [{ label: "Campaigns" }]
  if (pathname.startsWith("/dashboard/leads")) return [{ label: "Leads" }]
  if (pathname === "/dashboard/mailbox")
    return [{ label: tab === "settings" ? "Settings" : "Mailbox" }]
  if (pathname === "/dashboard/chat") return [{ label: "Chat" }]
  if (pathname === "/dashboard/billing") return [{ label: "Billing" }]
  if (pathname === "/dashboard/admin") return [{ label: "Platform admin" }]
  return [{ label: "Home" }]
}
