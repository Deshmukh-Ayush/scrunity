"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { ChevronRight, Menu, X } from "@/components/ui/icons"
import { breadcrumbsFor } from "./nav-config"

/**
 * The authenticated app frame (CSS grid): a fixed 240px sidebar column, a
 * 48px top bar with breadcrumbs, and the main region, which is the only part
 * that scrolls. Sidebar and main both sit on the canvas, split by a
 * single-side divider. Below 768px the sidebar moves into a drawer opened
 * from the top bar (Base UI Dialog: focus trapped, Escape closes, focus goes
 * back to the trigger). `sidebar` is a server-rendered slot.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[48px_minmax(0,1fr)] bg-canvas md:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-2 focus:z-50 focus:rounded-md focus:border focus:border-transparent focus:bg-surface focus:px-3 focus:py-1.5 focus:text-body focus:font-medium focus:text-fg-strong focus:shadow-floating ui-focus:focus-ring"
      >
        Skip to content
      </a>

      <aside
        aria-label="Sidebar"
        className="hidden min-h-0 border-e border-border md:col-start-1 md:row-span-2 md:row-start-1 md:flex md:flex-col"
      >
        {sidebar}
      </aside>

      <header className="flex h-12 min-w-0 items-center gap-1 px-2 md:col-start-2 md:row-start-1 md:px-6">
        <MobileNav>{sidebar}</MobileNav>
        <Breadcrumbs />
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="min-h-0 min-w-0 overflow-y-auto outline-none md:col-start-2 md:row-start-2"
      >
        {children}
      </main>
    </div>
  )
}

function MobileNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  // The drawer is open for the route it was opened on, so following a link
  // inside it (a new route) closes it without an effect.
  const route = `${pathname}?${search}`
  const [openOn, setOpenOn] = React.useState<string | null>(null)
  const open = openOn === route
  const setOpen = (next: boolean) => setOpenOn(next ? route : null)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="md:hidden"
            aria-label="Open menu"
          />
        }
      >
        <Menu />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="t-modal-backdrop fixed inset-0 z-50 bg-black/40 md:hidden" />
        <DialogPrimitive.Popup
          aria-label="Menu"
          className="t-drawer fixed inset-y-0 start-0 z-50 flex w-[min(280px,85vw)] flex-col border border-transparent bg-canvas shadow-floating outline-none md:hidden"
        >
          <div className="flex shrink-0 justify-end px-2 pt-2">
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon" aria-label="Close menu" />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Breadcrumbs() {
  const pathname = usePathname()
  const tab = useSearchParams().get("tab")
  const crumbs = breadcrumbsFor(pathname, tab)

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 px-2 md:px-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-body">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={crumb.label} className="flex min-w-0 items-center gap-1.5">
              {isLast || !crumb.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={
                    isLast
                      ? "truncate font-medium text-fg-strong"
                      : "truncate text-fg-muted"
                  }
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-fg-muted transition-colors hover:text-fg-strong"
                >
                  {crumb.label}
                </Link>
              )}
              {!isLast && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-fg-subtle"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
