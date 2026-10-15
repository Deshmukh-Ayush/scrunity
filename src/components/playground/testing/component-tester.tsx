"use client"

import { useEffect, useState } from "react"
import { Container } from "@/components/layout/container"
import { SHOWCASE } from "../registry"
import { StatesTable } from "../registry/states-table"
import { ComponentPicker } from "./component-picker"

/**
 * Component testing route: pick a registered component, see it on the
 * current tokens, plus its states row. The selection lives in the URL hash
 * (#button) so a state can be linked.
 */
export function ComponentTester() {
  const [selectedId, setSelectedId] = useState(SHOWCASE[0].id)

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1)
      if (SHOWCASE.some((e) => e.id === id)) setSelectedId(id)
    }
    fromHash()
    window.addEventListener("hashchange", fromHash)
    return () => window.removeEventListener("hashchange", fromHash)
  }, [])

  function select(id: string) {
    setSelectedId(id)
    window.history.replaceState(null, "", `#${id}`)
  }

  const entry = SHOWCASE.find((e) => e.id === selectedId) ?? SHOWCASE[0]

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <Container className="flex h-14 items-center justify-between gap-4">
          <h1 className="text-section text-fg-strong">Component testing</h1>
          <ComponentPicker entries={SHOWCASE} selectedId={entry.id} onSelect={select} />
        </Container>
      </header>

      <main>
        <Container className="flex flex-col gap-8 py-10">
          <div className="flex flex-col gap-1">
            <p className="text-meta text-fg-muted">{entry.group}</p>
            <h2 className="text-title text-fg-strong">{entry.name}</h2>
            <p className="max-w-2xl text-body text-fg-muted">{entry.description}</p>
          </div>

          <section aria-label="Preview" className="flex min-h-48 items-center justify-center rounded-lg bg-surface p-8 shadow-surface">
            {entry.render()}
          </section>

          {entry.states ? (
            <section aria-labelledby="states-title" className="flex flex-col gap-3">
              <h3 id="states-title" className="text-section text-fg-default">
                States
              </h3>
              <StatesTable rows={entry.states} />
            </section>
          ) : (
            entry.group !== "Foundations" && (
              <p className="text-body text-fg-muted">{entry.name} has no interactive states.</p>
            )
          )}
        </Container>
      </main>
    </div>
  )
}
