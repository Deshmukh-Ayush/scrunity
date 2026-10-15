"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"
import { useSidebarContext } from "./nav-items"

type OrgLike = {
  name?: string | null
  logoUrl?: string | null
}

type SidebarBrandProps = {
  projectName: string
  org?: OrgLike
  canWhitelabel?: boolean
  className?: string
}

export function SidebarBrand({
  projectName,
  org,
  canWhitelabel = false,
  className,
}: SidebarBrandProps) {
  const { isCollapsed } = useSidebarContext()

  const showOrgLogo = canWhitelabel && Boolean(org?.logoUrl)
  const subtitle = canWhitelabel && org?.name ? org.name : "Workspace"

  const logoNode = showOrgLogo && org?.logoUrl ? (
    <Image
      src={org.logoUrl}
      alt={org.name || "Organization"}
      unoptimized
      width={28}
      height={28}
      className="h-7 w-auto max-w-24 rounded-[3px] bg-gray-100 object-contain p-0.5 shadow-surface dark:bg-gray-200 dark:invert shrink-0"
    />
  ) : (
    <Image
      width={28}
      height={28}
      src="/logo/scrunity_logo_svg.svg"
      alt="Scrunity Logo"
      className="h-7 w-auto max-w-24 object-contain shrink-0 dark:invert"
    />
  )

  if (isCollapsed) {
    return (
      <div className={cn("flex items-center justify-center w-full", className)}>
        {logoNode}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group flex min-w-0 flex-1 items-center gap-2.5 rounded-md transition-colors",
        className
      )}
    >
      {logoNode}
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className="truncate text-[13px] font-semibold leading-tight text-foreground"
          title={projectName}
        >
          {projectName}
        </span>
        <span
          className="truncate text-[10px] font-medium leading-tight text-muted-foreground"
          title={subtitle}
        >
          {subtitle}
        </span>
      </div>
    </div>
  )
}

