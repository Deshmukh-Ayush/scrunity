"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  checkStageStaleness,
  type StageStalenessResult,
} from "@/lib/gtm-staleness"
import { useHydrated } from "@/hooks/use-hydrated"
import type { CampaignData, Draft, MailboxInfo } from "./types"

const POLL_INTERVAL_MS = 4000

const NOT_STALLED: Pick<StageStalenessResult, "isStalled" | "explanation"> = {
  isStalled: false,
  explanation: "",
}

interface CampaignDetailContextValue {
  data: CampaignData
  drafts: Draft[]
  mailbox: MailboxInfo | null
  staleness: Pick<StageStalenessResult, "isStalled" | "explanation">
  counts: { approved: number; sent: number; rejected: number; pending: number }
  isDispatching: boolean
  isRestarting: boolean
  isUpdating: boolean
  /** Re-fetches the campaign, drafts and mailbox now instead of at the next poll. */
  refresh: () => Promise<void>
  reviewDraft: (
    draftId: string,
    action: "approve" | "reject",
    edits?: { subject: string; body: string }
  ) => Promise<boolean>
  approveAllDrafts: () => Promise<void>
  restartStage: () => Promise<void>
  restartPipeline: () => Promise<void>
  startSending: () => Promise<void>
  disconnectMailbox: () => Promise<void>
}

const CampaignDetailContext =
  React.createContext<CampaignDetailContextValue | null>(null)

export function useCampaignDetail() {
  const ctx = React.useContext(CampaignDetailContext)
  if (!ctx)
    throw new Error(
      "useCampaignDetail must be used inside <CampaignDetail.Root>"
    )
  return ctx
}

/** Runs a POST to an app API route and throws the route's error message on failure. */
async function postJson<T = { message?: string }>(
  url: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request to ${url} failed`)
  return data
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

type CampaignDetailRootProps = React.ComponentProps<"div"> & {
  campaignId: string
  initialData: CampaignData
  initialDrafts: Draft[]
  initialMailbox: MailboxInfo | null
}

/**
 * Holds one campaign's live state. Starts from server-fetched data, polls the
 * campaign, drafts and mailbox routes every few seconds while mounted, and
 * exposes the review/dispatch/restart actions to the CampaignDetail parts.
 */
export function CampaignDetailRoot({
  campaignId,
  initialData,
  initialDrafts,
  initialMailbox,
  children,
  ...props
}: CampaignDetailRootProps) {
  const [data, setData] = React.useState(initialData)
  const [drafts, setDrafts] = React.useState(initialDrafts)
  const [mailbox, setMailbox] = React.useState(initialMailbox)
  const [isDispatching, setIsDispatching] = React.useState(false)
  const [isRestarting, setIsRestarting] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const hydrated = useHydrated()

  const refresh = React.useCallback(async () => {
    try {
      const [campRes, draftsRes, mailboxRes] = await Promise.all([
        fetch(`/api/gtm/campaigns/${campaignId}`),
        fetch(`/api/gtm/campaigns/${campaignId}/drafts`),
        fetch(`/api/gtm/mailbox`),
      ])
      const [campData, draftsData, mailboxData] = await Promise.all([
        campRes.json(),
        draftsRes.json(),
        mailboxRes.json(),
      ])

      if (campData.success) setData(campData)
      if (draftsData.success) setDrafts(draftsData.drafts)
      setMailbox(
        mailboxData.connected && mailboxData.mailbox
          ? mailboxData.mailbox
          : null
      )
    } catch (e) {
      console.error("Failed to load campaign data:", e)
    }
  }, [campaignId])

  React.useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const reviewDraft: CampaignDetailContextValue["reviewDraft"] = async (
    draftId,
    action,
    edits
  ) => {
    setIsUpdating(true)
    try {
      await postJson(`/api/gtm/campaigns/${campaignId}/drafts/${draftId}`, {
        action,
        edits,
      })
      toast.success(action === "approve" ? "Draft approved" : "Draft rejected")
      await refresh()
      return true
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update draft"))
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  const approveAllDrafts = async () => {
    setIsUpdating(true)
    try {
      await postJson(`/api/gtm/campaigns/${campaignId}/drafts`, {
        action: "approve_all",
      })
      toast.success("All drafts approved!")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "Failed to approve drafts"))
    } finally {
      setIsUpdating(false)
    }
  }

  const restartStage = async () => {
    setIsRestarting(true)
    try {
      const res = await postJson(
        `/api/gtm/campaigns/${campaignId}/restart-stage`
      )
      toast.success(res.message || "Stage restarted successfully!")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "Failed to restart stage"))
    } finally {
      setIsRestarting(false)
    }
  }

  const restartPipeline = async () => {
    setIsRestarting(true)
    try {
      await postJson(`/api/gtm/campaigns/${campaignId}/rerun`, { force: true })
      toast.success("Autonomous pipeline restarted!")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "Failed to restart pipeline"))
    } finally {
      setIsRestarting(false)
    }
  }

  const startSending = async () => {
    if (!mailbox) {
      toast.error("Please connect your Gmail account before sending emails.")
      return
    }
    setIsDispatching(true)
    try {
      const res = await postJson(`/api/gtm/campaigns/${campaignId}/send`)
      toast.success(res.message || "Email dispatch initiated!")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "Failed to start sending"))
    } finally {
      setIsDispatching(false)
    }
  }

  const disconnectMailbox = async () => {
    if (!confirm("Disconnect this Gmail mailbox?")) return
    await fetch("/api/gtm/mailbox", { method: "DELETE" })
    await refresh()
    toast.success("Mailbox disconnected")
  }

  const { campaign } = data
  // Staleness depends on the current time, so it is only evaluated after hydration.
  const staleness = hydrated
    ? checkStageStaleness({
        stage: campaign.currentStage,
        status: campaign.status,
        stageStartedAt: campaign.stageStartedAt,
        lastProgressAt: campaign.lastProgressAt,
        createdAt: campaign.createdAt,
        recentActivityAt: drafts.find((d) => d.sentAt)?.sentAt,
      })
    : NOT_STALLED

  const counts = {
    approved: drafts.filter((d) => d.status === "approved").length,
    sent: drafts.filter((d) => d.status === "sent").length,
    rejected: drafts.filter((d) => d.status === "rejected").length,
    pending: drafts.filter((d) => d.status === "draft").length,
  }

  const value: CampaignDetailContextValue = {
    data,
    drafts,
    mailbox,
    staleness,
    counts,
    isDispatching,
    isRestarting,
    isUpdating,
    refresh,
    reviewDraft,
    approveAllDrafts,
    restartStage,
    restartPipeline,
    startSending,
    disconnectMailbox,
  }

  return (
    <CampaignDetailContext.Provider value={value}>
      <div
        data-status={campaign.status}
        data-stage={campaign.currentStage}
        data-stalled={staleness.isStalled || undefined}
        {...props}
      >
        {children}
      </div>
    </CampaignDetailContext.Provider>
  )
}
