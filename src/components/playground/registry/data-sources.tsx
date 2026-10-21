"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ConnectDialog } from "@/components/data-sources/connect-dialog"
import { ConnectionCard } from "@/components/data-sources/connection-card"
import { connectionViewState, type ConnectionViewState } from "@/components/data-sources/connection-state"
import { DisconnectDialog } from "@/components/data-sources/disconnect-dialog"
import { KeyDisclosure } from "@/components/data-sources/key-disclosure"
import { LoadErrorCard } from "@/components/data-sources/load-error-card"
import { LaunchFooter, type LaunchDataSource } from "@/components/gtm/new-campaign/launch-footer"
import { CampaignFixtureDemo } from "./flow-demos"
import { DATA_SOURCE_STOPPED_CAMPAIGNS } from "./process-fixtures"
import { connectErrorText, DATA_SOURCE_COPY } from "@/lib/data-sources/copy"
import type { LoadFailureReason } from "@/lib/data-sources/load-status"
import type { PublicConnection } from "@/lib/data-sources/types"
import type { ShowcaseEntry } from "./types"

/** Fixture connections. Fake values only: the last four is a made-up string. */
const base: PublicConnection = {
  provider: "apollo",
  status: "active",
  authType: "api_key",
  last4: "mple",
  connectedAt: "2026-10-21T09:30:00.000Z",
  lastVerifiedAt: "2026-10-21T09:30:00.000Z",
  lastErrorCode: null,
}

const CARD_STATES: Array<{ label: string; connection: PublicConnection | null; connecting?: boolean; canManage?: boolean }> = [
  { label: "Not connected", connection: null },
  { label: "Connecting (checking the key)", connection: null, connecting: true },
  { label: "Connected", connection: base },
  { label: "Needs reconnect (Apollo rejected the key)", connection: { ...base, status: "invalid", lastErrorCode: "data_source_key_invalid" } },
  { label: "Error (credits used up)", connection: { ...base, lastErrorCode: "data_source_credits_used_up" } },
  { label: "Error (plan blocks API search)", connection: { ...base, lastErrorCode: "data_source_plan_blocked" } },
  { label: "Connected, viewed by a member (no actions)", connection: base, canManage: false },
]

const noop = () => {}

/** The status didn't load (query failed or timed out). Try again shows its pending state for a moment. */
function LoadErrorStates() {
  const [retrying, setRetrying] = React.useState<LoadFailureReason | null>(null)
  React.useEffect(() => {
    if (!retrying) return
    const t = setTimeout(() => setRetrying(null), 1500)
    return () => clearTimeout(t)
  }, [retrying])
  return (
    <>
      {(["failed", "timeout"] as const).map((reason) => (
        <div key={reason} className="flex flex-col gap-2" data-demo-state={`load_error_${reason}`}>
          <p className="text-meta text-fg-muted">
            {reason === "failed" ? "Didn't load (the status query failed)" : "Didn't load (no answer within 15 seconds)"}
          </p>
          <LoadErrorCard reason={reason} retrying={retrying === reason} onRetry={() => setRetrying(reason)} />
        </div>
      ))}
    </>
  )
}

export function DataSourceCardStates() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      {CARD_STATES.map(({ label, connection, connecting = false, canManage = true }) => {
        const state: ConnectionViewState = connectionViewState(connection, connecting)
        return (
          <div key={label} className="flex flex-col gap-2" data-demo-state={state}>
            <p className="text-meta text-fg-muted">{label}</p>
            <ConnectionCard state={state} connection={connection} canManage={canManage} onConnect={noop} onDisconnect={noop} />
          </div>
        )
      })}
      <LoadErrorStates />
      <KeyDisclosure />
    </div>
  )
}

const DIALOG_STATES = ["empty", "missing key", "rejected key", "plan blocked", "checking", "reconnect"] as const
type DialogState = (typeof DIALOG_STATES)[number]

const DIALOG_ERROR: Partial<Record<DialogState, string>> = {
  "missing key": DATA_SOURCE_COPY.keyMissing,
  "rejected key": connectErrorText("data_source_key_invalid"),
  "plan blocked": connectErrorText("data_source_plan_blocked"),
}

function DemoSwitcher<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label="Fixture state" className="flex flex-wrap gap-1.5" data-demo-switcher="">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className="rounded-sm border border-dashed border-neutral-400 px-2 py-0.5 font-mono text-xs aria-pressed:bg-neutral-900 aria-pressed:text-white"
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function ConnectDialogDemo() {
  const [state, setState] = React.useState<DialogState>("empty")
  const [open, setOpen] = React.useState(false)
  return (
    <div className="flex flex-col gap-3">
      <DemoSwitcher value={state} options={DIALOG_STATES} onChange={setState} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)} data-demo-open="connect">
          Open connect dialog
        </Button>
      </div>
      <ConnectDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={noop}
        submitting={state === "checking"}
        error={DIALOG_ERROR[state] ?? null}
        reconnect={state === "reconnect"}
      />
    </div>
  )
}

export function DisconnectDialogDemo() {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => setOpen(true)} data-demo-open="disconnect">
        Open disconnect confirm
      </Button>
      <DisconnectDialog open={open} onOpenChange={setOpen} onConfirm={() => setOpen(false)} submitting={false} />
    </div>
  )
}

const estimate = { provider: "apollo" as const, maxCreditsPerCampaign: 21, runCap: 25 }
const FOOTER_STATES: Array<{ label: string; selected: number; dataSource: LaunchDataSource | null }> = [
  { label: "Apollo connected, 1 segment: the estimate before Start", selected: 1, dataSource: { access: "customer", estimate, needsReconnect: false, imports: [] } },
  { label: "Apollo connected, 3 segments", selected: 3, dataSource: { access: "customer", estimate, needsReconnect: false, imports: [] } },
  { label: "Not connected: start blocked", selected: 2, dataSource: { access: "not_connected", estimate, needsReconnect: false, imports: [] } },
  { label: "Key rejected: start blocked", selected: 2, dataSource: { access: "not_connected", estimate, needsReconnect: true, imports: [] } },
  { label: "Internal organization (platform data): no Apollo estimate", selected: 2, dataSource: { access: "platform", estimate, needsReconnect: false, imports: [] } },
]

export function LaunchFooterStates() {
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-8">
      {FOOTER_STATES.map(({ label, selected, dataSource }) => (
        <div key={label} className="flex flex-col gap-2" data-demo-state={label}>
          <p className="text-meta text-fg-muted">{label}</p>
          {/* Not sticky here, so every state stays in its own slot. */}
          <div className="[&>div]:static">
            <LaunchFooter selected={selected} isLaunching={false} onLaunch={noop} dataSource={dataSource} />
          </div>
        </div>
      ))}
    </div>
  )
}

export const dataSourceCardEntry: ShowcaseEntry = {
  id: "data-source-card",
  name: "Data sources: Apollo connection",
  group: "Settings",
  description:
    "Every state of the Apollo card: not connected, connecting, connected (last four, dates), needs reconnect, error, a member's read-only view, and the status that didn't load (failed or timed out) with Try again. Status is a badge with a label and icon, never color alone. Below: how the key is used.",
  render: () => <DataSourceCardStates />,
}

export const connectDialogEntry: ShowcaseEntry = {
  id: "data-source-connect-dialog",
  name: "Data sources: connect dialog",
  group: "Settings",
  description:
    "Password field with show/hide, no autofill or password-manager save, paste allowed. Errors sit under the field and move focus back to it. Choose a fixture state, then open the dialog.",
  render: () => <ConnectDialogDemo />,
}

export const disconnectDialogEntry: ShowcaseEntry = {
  id: "data-source-disconnect-dialog",
  name: "Data sources: disconnect confirm",
  group: "Settings",
  description: "Names the action and its consequence; the destructive button says what it does.",
  render: () => <DisconnectDialogDemo />,
}

export const launchFooterEntry: ShowcaseEntry = {
  id: "data-source-launch-footer",
  name: "New research run: start with Apollo credits",
  group: "Flows",
  description:
    "The segment step's footer: the worst-case Apollo credit cost before Start, or a blocked start with Connect Apollo when no account is connected.",
  render: () => <LaunchFooterStates />,
}

export const campaignDataSourceStoppedEntry: ShowcaseEntry = {
  id: "campaign-data-source-stopped",
  name: "Campaign page: stopped by Apollo",
  group: "Flows",
  description:
    "A campaign stopped by the customer's Apollo account: rejected key and no connection offer Reconnect/Connect Apollo next to Retry; plan, credits, rate limit and the run's credit limit say what to do in Apollo.",
  render: () => (
    <div className="flex w-full flex-col gap-10">
      {DATA_SOURCE_STOPPED_CAMPAIGNS.map(({ label, data }) => (
        <div key={data.campaign.id} className="flex flex-col gap-2" data-demo-state={data.campaign.failureReason}>
          <p className="text-meta text-fg-muted">{label}</p>
          <CampaignFixtureDemo data={data} />
        </div>
      ))}
    </div>
  ),
}
