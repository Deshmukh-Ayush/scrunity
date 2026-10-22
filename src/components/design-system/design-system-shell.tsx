"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Button } from "@/components/ui/button"
import { ChevronRight, PanelLeft, X } from "@/components/ui/icons"
import { SHOWCASE } from "@/components/playground/registry"
import { ShowcaseDetail } from "@/components/playground/testing/showcase-detail"
import { useShowcaseSelection } from "@/components/playground/testing/use-showcase-selection"
import { useStoredBoolean } from "@/components/shell/use-stored-boolean"
import { cn } from "@/lib/utils"
import { DesignSystemNav } from "./design-system-nav"

const SIDEBAR_ID = "design-system-sidebar"

/**
 * The public design system (/design-system), framed like the app shell: a
 * 240px sidebar column, a 48px top bar, and a main region that is the only
 * part that scrolls. From 768px the sidebar collapses to nothing from the top
 * bar's toggle (remembered in localStorage; the column animates only after
 * the first toggle, so a remembered state does not play on load). Below
 * 768px the same toggle opens it as a drawer, which closes on selection.
 */
export function DesignSystemShell() {
  const [entry, select] = useShowcaseSelection(SHOWCASE)
  const [sidebarOpen, setSidebarOpen] = useStoredBoolean("scrunity:design-system-sidebar", true)
  const [animate, setAnimate] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const mainRef = React.useRef<HTMLElement>(null)

  function choose(id: string) {
    select(id)
    setDrawerOpen(false)
    mainRef.current?.scrollTo({ top: 0 })
  }

  function toggleSidebar() {
    setAnimate(true)
    setSidebarOpen(!sidebarOpen)
  }

  const nav = <DesignSystemNav entries={SHOWCASE} selectedId={entry.id} onSelect={choose} />

  return (
    <div
      className={cn(
        "grid h-dvh grid-cols-1 grid-rows-[48px_minmax(0,1fr)] bg-canvas",
        sidebarOpen ? "md:grid-cols-[240px_minmax(0,1fr)]" : "md:grid-cols-[0px_minmax(0,1fr)]",
        animate && "motion-safe:transition-[grid-template-columns] motion-safe:duration-(--acc-expand) motion-safe:ease-(--acc-ease)"
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-2 focus:z-50 focus:rounded-md focus:border focus:border-transparent focus:bg-surface focus:px-3 focus:py-1.5 focus:text-body focus:font-medium focus:text-fg-strong focus:shadow-floating ui-focus:focus-ring"
      >
        Skip to content
      </a>

      <aside
        id={SIDEBAR_ID}
        aria-label="Sidebar"
        inert={!sidebarOpen}
        className={cn(
          "hidden min-h-0 overflow-hidden md:col-start-1 md:row-span-2 md:row-start-1 md:flex md:flex-col",
          sidebarOpen && "border-e border-border"
        )}
      >
        {/* Fixed width, so the contents clip instead of reflowing while the column animates. */}
        <div className="h-full w-60 min-w-60">{nav}</div>
      </aside>

      <header className="flex h-12 min-w-0 items-center gap-1 px-2 md:col-start-2 md:row-start-1 md:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-expanded={sidebarOpen}
          aria-controls={SIDEBAR_ID}
          onClick={toggleSidebar}
        >
          <PanelLeft />
        </Button>

        <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DialogPrimitive.Trigger
            render={<Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Open components" />}
          >
            <PanelLeft />
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="t-modal-backdrop fixed inset-0 z-50 bg-black/40 md:hidden" />
            <DialogPrimitive.Popup
              aria-label="Components"
              className="t-drawer fixed inset-y-0 start-0 z-50 flex w-[min(280px,85vw)] flex-col border border-transparent bg-canvas shadow-floating outline-none md:hidden"
            >
              <div className="flex shrink-0 justify-end px-2 pt-2">
                <DialogPrimitive.Close render={<Button variant="ghost" size="icon" aria-label="Close components" />}>
                  <X />
                </DialogPrimitive.Close>
              </div>
              <div className="min-h-0 flex-1">{nav}</div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <nav aria-label="Breadcrumb" className="min-w-0 px-2">
          <ol className="flex min-w-0 items-center gap-1.5 text-body">
            <li className="flex shrink-0 items-center gap-1.5">
              <h1 className="text-fg-muted">Design system</h1>
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
            </li>
            <li className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <span className="text-fg-muted">{entry.group}</span>
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
            </li>
            <li className="min-w-0">
              <span aria-current="page" className="block truncate font-medium text-fg-strong">
                {entry.name}
              </span>
            </li>
          </ol>
        </nav>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="min-h-0 min-w-0 overflow-y-auto bg-background outline-none md:col-start-2 md:row-start-2"
      >
        <ShowcaseDetail entry={entry} />
      </main>
    </div>
  )
}
