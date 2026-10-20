"use client"

import * as React from "react"
import { toast } from "sonner"
import { connectErrorText, DATA_SOURCE_COPY as COPY } from "@/lib/data-sources/copy"
import type { DataSourcesStatus, PublicConnection } from "@/lib/data-sources/types"
import { ConnectDialog } from "./connect-dialog"
import { ConnectionCard } from "./connection-card"
import { connectionViewState } from "./connection-state"
import { DisconnectDialog } from "./disconnect-dialog"
import { KeyDisclosure } from "./key-disclosure"

const readJson = async (res: Response): Promise<Record<string, unknown>> => {
  try {
    const body: unknown = await res.json()
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Data sources: the Apollo connection card, the connect and disconnect
 * dialogs, and the key disclosure. Server-rendered from getDataSourcesStatus;
 * connect and disconnect update the card from their responses.
 */
export function DataSourcesClient({ initialStatus }: { initialStatus: DataSourcesStatus }) {
  const [connection, setConnection] = React.useState<PublicConnection | null>(initialStatus.connection)
  const [connectOpen, setConnectOpen] = React.useState(false)
  const [disconnectOpen, setDisconnectOpen] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)
  const [disconnecting, setDisconnecting] = React.useState(false)
  const [connectError, setConnectError] = React.useState<string | null>(null)

  const state = connectionViewState(connection, connecting)

  const openConnect = () => {
    setConnectError(null)
    setConnectOpen(true)
  }

  const connect = async (apiKey: string) => {
    if (!apiKey.trim()) {
      setConnectError(COPY.keyMissing)
      return
    }
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await fetch("/api/gtm/data-sources/apollo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })
      const body = await readJson(res)
      if (!res.ok) {
        const code = typeof body.code === "string" ? body.code : null
        setConnectError(code === "data_source_key_missing" ? COPY.keyMissing : connectErrorText(code))
        return
      }
      setConnection(body.connection as PublicConnection)
      setConnectOpen(false)
      toast.success(COPY.connectedToast)
    } catch {
      setConnectError(connectErrorText("data_source_request_failed"))
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch("/api/gtm/data-sources/apollo", { method: "DELETE" })
      if (!res.ok && res.status !== 404) {
        const body = await readJson(res)
        toast.error(typeof body.error === "string" ? body.error : "Apollo didn't disconnect. Try again.")
        return
      }
      setConnection((prev) => (prev ? { ...prev, status: "revoked", last4: null, lastErrorCode: null } : null))
      setDisconnectOpen(false)
      toast.success(COPY.disconnectedToast)
    } catch {
      toast.error("Apollo didn't disconnect. Check your connection and try again.")
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ConnectionCard
        state={state}
        connection={connection}
        canManage={initialStatus.canManage}
        onConnect={openConnect}
        onDisconnect={() => setDisconnectOpen(true)}
      />
      <KeyDisclosure />
      <ConnectDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onSubmit={connect}
        submitting={connecting}
        error={connectError}
        reconnect={state === "needs_reconnect" || state === "error"}
      />
      <DisconnectDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        onConfirm={disconnect}
        submitting={disconnecting}
      />
    </div>
  )
}
