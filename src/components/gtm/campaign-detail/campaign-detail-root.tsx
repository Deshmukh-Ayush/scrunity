"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  checkStageStaleness,
  type StageStalenessResult,
} from "@/lib/gtm-staleness"
import { useHydrated } from "@/hooks/use-hydrated"
import { deriveCampaignProcess, type CampaignCounts, type CampaignProcess } from "../process/campaign-process"
import { deliveryCounts } from "@/lib/contact-import/bounce-guard"
import { toDeliveryDraft } from "./delivery"
import { BOUNCE_COPY } from "@/lib/contact-import/copy"
import type { CampaignData, Draft, MailboxInfo } from "./types"

const POLL_INTERVAL_MS = 4000

const NOT_STALLED: Pick<StageStalenessResult, "isStalled" | "elapsedMs"> = {
  isStalled: false,
  elapsedMs: 0,
}

interface CampaignDetailContextValue {
  data: CampaignData
  drafts: Draft[]
  mailbox: MailboxInfo | null
  staleness: Pick<StageStalenessResult, "isStalled" | "elapsedMs">
  /** Review counts, plus sent / delivered / bounced from the shared delivery count. */
  counts: CampaignCounts
  /** The campaign as ProcessCard state, plain words included. */
  process: CampaignProcess
  /** Stage whose detail shows under the card (0-4); follows the current stage until picked. */
  selectedStage: number
  selectStage: (index: number) => void
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
  /** Bounce pause: removes the bounced addresses and resumes. True when it worked. */
  resumeAfterBounces: () => Promise<boolean>
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
  if (!res.ok) throw new Error(data.error || "The request didn't go through. Try again.")
  return data
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

type CampaignDetailRootProps = React.ComponentProps<"div"> & {
  campaignId: string
  initialData: CampaignData
  initialDrafts: Draft[]
  initialMailbox: MailboxInfo | null
  /**
   * Testing route only: no polling and every action is a no-op, so fixture
   * data is never replaced and nothing real is approved, sent or disconnected.
   */
  fixture?: boolean
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
  fixture = false,
  children,
  ...props
}: CampaignDetailRootProps) {
  const [data, setData] = React.useState(initialData)
  const [drafts, setDrafts] = React.useState(initialDrafts)
  const [mailbox, setMailbox] = React.useState(initialMailbox)
  const [isDispatching, setIsDispatching] = React.useState(false)
  const [isRestarting, setIsRestarting] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [pickedStage, setPickedStage] = React.useState<number | null>(null)
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
    if (fixture) return
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh, fixture])

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
      toast.success(action === "approve" ? "Email approved" : "Email rejected")
      await refresh()
      return true
    } catch (err) {
      toast.error(errorMessage(err, "The email didn't update. Try again."))
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
      toast.success("All emails approved")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "The emails weren't approved. Try again."))
    } finally {
      setIsUpdating(false)
    }
  }

  const restartStage = async () => {
    setIsRestarting(true)
    try {
      await postJson(`/api/gtm/campaigns/${campaignId}/restart-stage`)
      toast.success("Step restarted")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "The step didn't restart. Try again."))
    } finally {
      setIsRestarting(false)
    }
  }

  const restartPipeline = async () => {
    setIsRestarting(true)
    try {
      await postJson(`/api/gtm/campaigns/${campaignId}/rerun`, { force: true })
      toast.success("Campaign is running again from the start")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "The campaign didn't restart. Try again."))
    } finally {
      setIsRestarting(false)
    }
  }

  const startSending = async () => {
    if (!mailbox) {
      toast.error("Connect a mailbox before you send.")
      return
    }
    setIsDispatching(true)
    try {
      await postJson(`/api/gtm/campaigns/${campaignId}/send`)
      toast.success("Sending started. Emails go out a few at a time.")
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err, "Sending didn't start. Try again."))
    } finally {
      setIsDispatching(false)
    }
  }

  const resumeAfterBounces = async () => {
    setIsDispatching(true)
    try {
      const res = await postJson<{ next?: string }>(`/api/gtm/campaigns/${campaignId}/bounces`)
      toast.success(res.next === "send" ? BOUNCE_COPY.resumedToast : BOUNCE_COPY.resumedNoSendToast)
      await refresh()
      return true
    } catch (err) {
      toast.error(errorMessage(err, BOUNCE_COPY.failedToast))
      return false
    } finally {
      setIsDispatching(false)
    }
  }

  // The confirm dialog lives in the mailbox line (MailboxStatusBar).
  const disconnectMailbox = async () => {
    try {
      const res = await fetch("/api/gtm/mailbox", { method: "DELETE" })
      if (!res.ok) throw new Error("The mailbox didn't disconnect. Try again.")
      await refresh()
      toast.success("Mailbox disconnected")
    } catch (err) {
      toast.error(errorMessage(err, "The mailbox didn't disconnect. Try again."))
    }
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

  const counts: CampaignCounts = {
    approved: drafts.filter((d) => d.status === "approved").length,
    rejected: drafts.filter((d) => d.status === "rejected").length,
    pending: drafts.filter((d) => d.status === "draft").length,
    // Bounced emails count as sent: they left the mailbox.
    ...deliveryCounts(drafts.map(toDeliveryDraft)),
  }

  const process = deriveCampaignProcess({
    data,
    drafts,
    counts,
    stalledForMs: staleness.isStalled ? staleness.elapsedMs : null,
  })

  const inert = async () => {
    toast.info("Testing route: nothing was changed.")
  }

  const value: CampaignDetailContextValue = {
    data,
    drafts,
    mailbox,
    staleness,
    counts,
    process,
    selectedStage: pickedStage ?? process.current,
    selectStage: setPickedStage,
    isDispatching,
    isRestarting,
    isUpdating,
    refresh: fixture ? inert : refresh,
    reviewDraft: fixture ? async () => (await inert(), false) : reviewDraft,
    approveAllDrafts: fixture ? inert : approveAllDrafts,
    restartStage: fixture ? inert : restartStage,
    restartPipeline: fixture ? inert : restartPipeline,
    startSending: fixture ? inert : startSending,
    resumeAfterBounces: fixture ? async () => (await inert(), false) : resumeAfterBounces,
    disconnectMailbox: fixture ? inert : disconnectMailbox,
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
