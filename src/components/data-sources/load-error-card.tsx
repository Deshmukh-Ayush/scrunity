"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardLeading, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "@/components/ui/icons"
import { DATA_SOURCE_COPY as COPY } from "@/lib/data-sources/copy"
import type { LoadFailureReason } from "@/lib/data-sources/load-status"

/**
 * The Apollo card when the status couldn't be loaded (query failed or timed
 * out). Presentational, so the testing route renders it with a stub retry.
 */
export function LoadErrorCard({
  reason,
  retrying,
  onRetry,
}: {
  reason: LoadFailureReason
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <Card data-state="load_error" aria-labelledby="apollo-connection-title" aria-busy={retrying} role="region">
      <CardHeader>
        <CardLeading>A</CardLeading>
        <CardTitle id="apollo-connection-title">{COPY.apolloName}</CardTitle>
        <CardDescription>{COPY.apolloDescription}</CardDescription>
        <CardAction>
          <Badge variant="danger">
            <AlertCircle />
            {COPY.loadErrorStatus}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p role="alert" className="text-body text-fg-default">
          {reason === "timeout" ? COPY.loadErrorTimeoutText : COPY.loadErrorText}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="secondary" onClick={onRetry} disabled={retrying}>
          {COPY.retryAction}
        </Button>
      </CardFooter>
    </Card>
  )
}

/** Retries by re-rendering the server component; the pending state ends when the server answers. */
export function DataSourcesLoadError({ reason }: { reason: LoadFailureReason }) {
  const router = useRouter()
  const [retrying, startRetry] = React.useTransition()
  return <LoadErrorCard reason={reason} retrying={retrying} onRetry={() => startRetry(() => router.refresh())} />
}
