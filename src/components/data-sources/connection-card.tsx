"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardLeading, CardTitle } from "@/components/ui/card"
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Key, Minus } from "@/components/ui/icons"
import { LocalDate } from "@/components/ui/local-date"
import { CAMPAIGN_DATA_SOURCE_FAILURE_TEXT, DATA_SOURCE_COPY as COPY } from "@/lib/data-sources/copy"
import type { PublicConnection } from "@/lib/data-sources/types"
import type { ConnectionViewState } from "./connection-state"

const STATUS: Record<ConnectionViewState, { label: string; variant: "neutral" | "success" | "warning" | "danger"; icon: React.ReactNode }> = {
  not_connected: { label: COPY.statusNotConnected, variant: "neutral", icon: <Minus /> },
  connecting: { label: COPY.statusConnecting, variant: "neutral", icon: <Clock /> },
  connected: { label: COPY.statusConnected, variant: "success", icon: <CheckCircle2 /> },
  needs_reconnect: { label: COPY.statusNeedsReconnect, variant: "warning", icon: <AlertTriangle /> },
  error: { label: COPY.statusError, variant: "danger", icon: <AlertCircle /> },
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

/** What the card says under the title, per state. */
function stateText(state: ConnectionViewState, connection: PublicConnection | null): string | null {
  if (state === "not_connected") return COPY.notConnectedText
  if (state === "connecting") return COPY.connectingText
  if (state === "needs_reconnect") return COPY.needsReconnectText
  if (state === "error") {
    const code = connection?.lastErrorCode ?? "data_source_request_failed"
    return CAMPAIGN_DATA_SOURCE_FAILURE_TEXT[code] ?? CAMPAIGN_DATA_SOURCE_FAILURE_TEXT.data_source_request_failed
  }
  return null
}

/**
 * The Apollo connection as one card: name, status badge (label + icon, never
 * color alone), a sentence about now, the key's last four and dates, and the
 * actions that exist for this state. Only owners and admins see actions.
 */
export function ConnectionCard({
  state,
  connection,
  canManage,
  onConnect,
  onDisconnect,
}: {
  state: ConnectionViewState
  connection: PublicConnection | null
  canManage: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const status = STATUS[state]
  const text = stateText(state, connection)
  const showKey = connection && connection.status !== "revoked" && state !== "not_connected"
  const needsAction = state === "not_connected" || state === "needs_reconnect"

  return (
    <Card data-state={state} aria-labelledby="apollo-connection-title" aria-busy={state === "connecting"} role="region">
      <CardHeader>
        <CardLeading>A</CardLeading>
        <CardTitle id="apollo-connection-title">{COPY.apolloName}</CardTitle>
        <CardDescription>{COPY.apolloDescription}</CardDescription>
        <CardAction>
          <Badge variant={status.variant}>
            {status.icon}
            {status.label}
          </Badge>
        </CardAction>
      </CardHeader>

      {(text || showKey) && (
        <CardContent className="flex flex-col gap-3">
          {text && (
            <p role={state === "connecting" ? "status" : undefined} className="text-body text-fg-default">
              {text}
            </p>
          )}
          {showKey && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-body sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-meta text-fg-muted">API key</dt>
                <dd className="flex items-center gap-1.5 text-fg-strong tabular-nums">
                  <Key className="shrink-0 text-fg-muted" />
                  {COPY.connectedMeta(connection.last4)}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="text-meta text-fg-muted">{COPY.connectedSince}</dt>
                <dd className="text-fg-strong tabular-nums">
                  <LocalDate value={connection.connectedAt} options={DATE_OPTIONS} />
                </dd>
              </div>
              {connection.lastVerifiedAt && (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-meta text-fg-muted">{COPY.lastChecked}</dt>
                  <dd className="text-fg-strong tabular-nums">
                    <LocalDate value={connection.lastVerifiedAt} options={DATE_OPTIONS} />
                  </dd>
                </div>
              )}
            </dl>
          )}
        </CardContent>
      )}

      {state !== "connecting" && (
        <CardFooter className="flex-wrap justify-between gap-3">
          {canManage ? (
            <>
              <div className="flex flex-wrap gap-2">
                {state === "not_connected" && (
                  <Button variant="brand" onClick={onConnect}>
                    {COPY.connectAction}
                  </Button>
                )}
                {(state === "needs_reconnect" || state === "error") && (
                  <Button variant={needsAction ? "brand" : "secondary"} onClick={onConnect}>
                    {COPY.reconnectAction}
                  </Button>
                )}
              </div>
              {state !== "not_connected" && (
                <Button variant="ghost" onClick={onDisconnect}>
                  {COPY.disconnectAction}
                </Button>
              )}
            </>
          ) : (
            <p className="text-body text-fg-muted">{COPY.managerOnly}</p>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
