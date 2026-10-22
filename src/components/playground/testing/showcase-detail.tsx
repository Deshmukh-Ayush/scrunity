import { Container } from "@/components/layout/container"
import { StatesTable } from "../registry/states-table"
import type { ShowcaseEntry } from "../registry/types"

/**
 * One showcase entry: its group, name and description, the live preview on
 * the current tokens, and the states table when it has one. Shared by the
 * internal testing route and the public /design-system route.
 */
export function ShowcaseDetail({ entry }: { entry: ShowcaseEntry }) {
  return (
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
  )
}
