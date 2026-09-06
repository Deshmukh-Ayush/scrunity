"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient, useSession } from "@/lib/auth-client"
import { MoreHorizontal, Sun, Moon, Monitor, ArrowUpRight } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import Image from "next/image"
import posthog from "posthog-js"

export function ProfileMenu() {
  const router = useRouter()
  const { data: sessionData } = useSession()
  const user = sessionData?.user

  const userName = user?.name || user?.email?.split("@")[0] || "User"
  const userEmail = user?.email || ""
  const userImage = user?.image || null

  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const handleLogout = async () => {
    posthog.reset()
    await authClient.signOut()
    router.push("/sign-in")
  }

  const getInitials = (name?: string | null) => {
    if (!name) return "U"
    const parts = name.trim().split(" ")
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.charAt(0).toUpperCase()
  }

  return (
    <div className="relative mt-auto w-full pt-4" ref={menuRef}>
      {/* Custom Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-full min-w-56 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
          role="menu"
        >
          <div className="flex flex-col gap-0.5 p-1.5">
            {/* User Info Header in Dropdown */}
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold text-muted-foreground">
                {userImage ? (
                  <Image
                    height={32}
                    width={32}
                    src={userImage}
                    alt={userName}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(userName)
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate text-xs font-semibold text-foreground">
                  {userName}
                </span>
                {userEmail && (
                  <span className="truncate text-[10px] text-muted-foreground">
                    {userEmail}
                  </span>
                )}
              </div>
            </div>

            <div className="my-1 h-px bg-border" role="separator" />

            {/* Appearance Toggles matching reference image */}
            <div className="flex items-center justify-between px-2.5 py-2 text-sm">
              <span>Appearance</span>
              <div className="flex items-center gap-1 rounded-full border bg-muted/50 p-0.5">
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "rounded-full p-1 transition-colors",
                    theme === "light"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Light theme"
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "rounded-full p-1 transition-colors",
                    theme === "dark"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Dark theme"
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={cn(
                    "rounded-full p-1 transition-colors",
                    theme === "system"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="System theme"
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="my-1 h-px bg-border" role="separator" />

            <button
              onClick={() => {
                router.push("/")
                setIsOpen(false)
              }}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              role="menuitem"
            >
              <span>Homepage</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            <div className="my-1 h-px bg-border" role="separator" />

            <button
              onClick={handleLogout}
              className="w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              role="menuitem"
            >
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Profile Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
          "hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          isOpen && "bg-muted/80"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs font-semibold text-muted-foreground">
          {userImage ? (
            <Image
              height={32}
              width={32}
              src={userImage}
              alt={userName}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(userName)
          )}
        </div>

        <div className="flex flex-1 flex-col truncate">
          <span className="truncate text-sm font-medium text-foreground">
            {userName}
          </span>
          {userEmail && (
            <span className="truncate text-[10px] text-muted-foreground">
              {userEmail}
            </span>
          )}
        </div>

        <MoreHorizontal
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
