"use client"

import * as React from "react"
import {
  MailboxView,
  type MailboxConnection,
} from "@/components/mailbox/mailbox-view"
import { MessageCard } from "@/components/mailbox/message-card"
import { ThreadList } from "@/components/mailbox/thread-list"
import { ThreadRow } from "@/components/mailbox/thread-row"
import {
  MAILBOX_FILTERS,
  matchesFilter,
  type MailboxFilterId,
} from "@/lib/mailbox-filters"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { FIXTURE_THREADS } from "./mailbox-fixtures"

const byId = (id: string) =>
  FIXTURE_THREADS.find((t) => t.id === id) as MailboxThread

/** One thread row in a listbox, as the states table needs it. */
export function ThreadRowDemo({
  id,
  selected = false,
  force,
}: {
  id: string
  selected?: boolean
  force?: "hover" | "focus-visible"
}) {
  return (
    <ul
      role="listbox"
      aria-label="Conversation"
      className="w-80 rounded-lg bg-canvas p-1"
    >
      <ThreadRow
        thread={byId(id)}
        selected={selected}
        focusable
        onOpen={() => {}}
        data-force={force}
      />
    </ul>
  )
}

export function MessageCardDemo({ id }: { id: string }) {
  const message = FIXTURE_THREADS.flatMap((t) => t.messages).find(
    (m) => m.id === id
  )
  return message ? <MessageCard message={message} className="max-w-xl" /> : null
}

/** The list pane with the filter control, working on fixture data. */
export function FilterDemo() {
  const [filter, setFilter] = React.useState<MailboxFilterId>("all")
  const [search, setSearch] = React.useState("")
  const counts = Object.fromEntries(
    MAILBOX_FILTERS.map((f) => [
      f.id,
      FIXTURE_THREADS.filter((t) => matchesFilter(t, f.id)).length,
    ])
  ) as Record<MailboxFilterId, number>
  return (
    <div className="flex h-96 w-[320px] flex-col rounded-lg border border-transparent bg-canvas shadow-surface">
      <ThreadList
        threads={FIXTURE_THREADS}
        selectedId="t-interested"
        onOpen={() => {}}
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        onClearFilters={() => {
          setSearch("")
          setFilter("all")
        }}
      />
    </div>
  )
}

const PAGE_STATES: {
  id: string
  label: string
  connection: MailboxConnection
  threads: MailboxThread[]
  search?: string
  filter?: MailboxFilterId
  loading?: boolean
}[] = [
  {
    id: "not-connected",
    label: "Not connected",
    connection: { state: "not-connected" },
    threads: [],
  },
  {
    id: "syncing",
    label: "Syncing",
    connection: { state: "syncing", email: "founder@acme-outbound.com" },
    threads: [],
  },
  {
    id: "connected-empty",
    label: "Connected, no threads",
    connection: { state: "connected", email: "founder@acme-outbound.com" },
    threads: [],
  },
  {
    id: "populated",
    label: "Populated",
    connection: { state: "connected", email: "founder@acme-outbound.com" },
    threads: FIXTURE_THREADS,
  },
  {
    id: "attention",
    label: "Needs attention",
    connection: {
      state: "attention",
      email: "founder@acme-outbound.com",
      reason: "revoked",
      provider: "gmail",
    },
    threads: FIXTURE_THREADS,
  },
  {
    id: "sync-error",
    label: "Sync error",
    connection: {
      state: "attention",
      email: "founder@acme-outbound.com",
      reason: "sync-error",
      provider: "gmail",
    },
    threads: FIXTURE_THREADS,
  },
  {
    id: "no-results",
    label: "No results",
    connection: { state: "connected", email: "founder@acme-outbound.com" },
    threads: FIXTURE_THREADS,
    search: "zzz-no-match",
  },
  {
    id: "loading",
    label: "Loading",
    connection: { state: "connected", email: "founder@acme-outbound.com" },
    threads: FIXTURE_THREADS,
    loading: true,
  },
]

/**
 * The whole Mailbox page in each state, from fixtures (state-machine
 * pattern: a switcher, one state at a time, nothing real is touched).
 */
export function MailboxPageStates() {
  const [stateId, setStateId] = React.useState("populated")
  const [openThreadId, setOpenThreadId] = React.useState<string | null>(null)
  const state = PAGE_STATES.find((s) => s.id === stateId) ?? PAGE_STATES[0]
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<MailboxFilterId>("all")

  const pick = (id: string) => {
    const next = PAGE_STATES.find((s) => s.id === id)
    setStateId(id)
    setSearch(next?.search ?? "")
    setFilter(next?.filter ?? "all")
    setOpenThreadId(null)
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        role="group"
        aria-label="Mailbox state"
        className="flex flex-wrap gap-1.5"
      >
        {PAGE_STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === stateId}
            onClick={() => pick(s.id)}
            className="h-7 rounded-full border border-transparent bg-surface px-2.5 text-body font-medium text-fg-default shadow-raised outline-none aria-pressed:bg-primary aria-pressed:text-primary-foreground ui-focus:focus-ring"
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="h-[680px] overflow-hidden rounded-lg border border-transparent bg-canvas shadow-surface">
        <MailboxView
          tab="conversations"
          tabHrefs={{
            conversations: "#mailbox-page",
            settings: "#mailbox-page",
          }}
          connection={state.connection}
          threads={state.threads}
          openThreadId={openThreadId}
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          onOpen={setOpenThreadId}
          onBack={() => setOpenThreadId(null)}
          loading={state.loading}
          onRefresh={() => {}}
          settings={null}
        />
      </div>
    </div>
  )
}
