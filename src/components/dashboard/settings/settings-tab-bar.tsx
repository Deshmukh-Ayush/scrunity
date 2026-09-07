"use client"

import { UserIcon, UsersIcon, PaintBrushIcon, CreditCardIcon, BellIcon } from "@phosphor-icons/react"
import { SlidingPillTabs } from "@/components/dashboard/shared/sliding-pill-tabs"

export type SettingsTab = "general" | "team" | "branding" | "billing" | "notifications"

interface SettingsTabBarProps {
  activeTab: SettingsTab
  setActiveTab: (tab: SettingsTab) => void
}

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: UserIcon },
  { id: "team", label: "Team", icon: UsersIcon },
  { id: "branding", label: "Branding", icon: PaintBrushIcon },
  { id: "billing", label: "Billing", icon: CreditCardIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
]

export function SettingsTabBar({ activeTab, setActiveTab }: SettingsTabBarProps) {
  return (
    <SlidingPillTabs
      layoutId="activeSettingsTabPill"
      tabs={tabs}
      activeTab={activeTab}
      onChange={setActiveTab}
    />
  )
}
