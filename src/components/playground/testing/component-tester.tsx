"use client"

import { useEffect } from "react"
import { Container } from "@/components/layout/container"
import { SHOWCASE } from "../registry"
import { ComponentPicker } from "./component-picker"
import { ShowcaseDetail } from "./showcase-detail"
import { useShowcaseSelection } from "./use-showcase-selection"

/**
 * Component testing route: pick a registered component, see it on the
 * current tokens, plus its states row. The selection lives in the URL hash
 * (#button) so a state can be linked.
 */
export function ComponentTester() {
  const [entry, select] = useShowcaseSelection(SHOWCASE)

  // The header is sticky (56px): keep focused elements from scrolling under it (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.scrollPaddingTop
    root.style.scrollPaddingTop = "72px"
    return () => {
      root.style.scrollPaddingTop = previous
    }
  }, [])

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <Container className="flex h-14 items-center justify-between gap-4">
          <h1 className="text-section text-fg-strong">Component testing</h1>
          <ComponentPicker entries={SHOWCASE} selectedId={entry.id} onSelect={select} />
        </Container>
      </header>

      <main>
        <ShowcaseDetail entry={entry} />
      </main>
    </div>
  )
}
