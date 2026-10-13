"use client"

import * as React from "react"
import { toast } from "sonner"
import { CompanyProfileConfirmation } from "../company-profile-confirmation"
import { CampaignsCreated } from "./campaigns-created"
import { CompanyDetailsForm } from "./company-details-form"
import { ResearchProgress } from "./research-progress"
import { SegmentSelection } from "./segment-selection"
import { useLogoPreview } from "@/hooks/use-logo-preview"
import { countryCodeFromName } from "@/lib/geo/countries"
import type {
  CompanyFormValues,
  Competitor,
  FlowStep,
  IcpSegment,
  ResearchRunDetails,
} from "./types"

const POLL_INTERVAL_MS = 2500

const INITIAL_FORM: CompanyFormValues = {
  websiteUrl: "",
  companyName: "",
  companyDescription: "",
  companySize: "11-50",
  contextDoc: "",
  fileName: "",
  targetCountry: "",
  targetRegion: "",
  arrAmount: "",
  arrCurrency: "USD",
  tamAmount: "",
  tamCurrency: "USD",
}

/** "" -> null, otherwise { amount, currency } for the API. */
function moneyPayload(amount: string, currency: string) {
  const parsed = parseInt(amount, 10)
  return Number.isFinite(parsed) && parsed > 0 ? { amount: parsed, currency } : null
}

function failureMessage(reason?: string | null) {
  if (reason === "firecrawl_call_cap_exceeded")
    return "Research stopped: Firecrawl call safety cap exceeded for this run to protect your credit balance."
  if (reason === "paused_firecrawl_allotment_exhausted")
    return "Research paused: Firecrawl credit allotment nearly exhausted for this billing cycle."
  return reason
    ? `Research failed: ${reason}`
    : "The autonomous research pipeline encountered an error."
}

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

/**
 * New research run → profile confirmation → segment selection → campaigns.
 * Starts a research run from the form, polls it until stage 3 finishes, then
 * launches one outreach campaign per selected ICP segment.
 */
export function NewCampaignFlow() {
  const [step, setStep] = React.useState<FlowStep>("FORM")
  const [form, setForm] = React.useState(INITIAL_FORM)
  const updateForm = (patch: Partial<CompanyFormValues>) =>
    setForm((prev) => ({ ...prev, ...patch }))
  const { logoPreview, isFetchingLogo, clearLogo } = useLogoPreview(
    form.websiteUrl
  )

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [researchRunId, setResearchRunId] = React.useState<string | null>(null)
  const [runDetails, setRunDetails] = React.useState<ResearchRunDetails | null>(
    null
  )
  const [competitors, setCompetitors] = React.useState<Competitor[]>([])
  const [segments, setSegments] = React.useState<IcpSegment[]>([])
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [isRestarting, setIsRestarting] = React.useState(false)

  const [selectedSegmentIds, setSelectedSegmentIds] = React.useState<
    Set<string>
  >(new Set())
  const [isLaunching, setIsLaunching] = React.useState(false)
  const [launchedCampaignIds, setLaunchedCampaignIds] = React.useState<
    string[]
  >([])

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !form.websiteUrl.trim() ||
      !form.companyName.trim() ||
      !form.companyDescription.trim()
    ) {
      toast.error("Please provide website URL, company name, and description")
      return
    }
    const targetCountryCode = countryCodeFromName(form.targetCountry)
    if (!targetCountryCode) {
      toast.error("Please pick a target country from the list")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch("/api/gtm/research-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: `https://${form.websiteUrl.trim().replace(/^(?:https?:\/*)+/i, "")}`,
          companyName: form.companyName.trim(),
          companyDescription: form.companyDescription.trim(),
          companySize: form.companySize,
          contextDoc: form.contextDoc.trim() || null,
          targetCountryCode,
          targetRegion: form.targetRegion.trim() || null,
          ownArr: moneyPayload(form.arrAmount, form.arrCurrency),
          ownTam: moneyPayload(form.tamAmount, form.tamCurrency),
        }),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(data.error || "Failed to start company research")

      setResearchRunId(data.researchRun.id)
      setRunDetails(data.researchRun)
      setStep("RUNNING")
      toast.success("Autonomous pipeline started!")
    } catch (err) {
      const msg = errorText(err, "Submission failed")
      toast.error(msg)
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Poll the run while research is running, and keep polling on the profile step
  // in case Stage 1's profile write lands just after the final status update.
  React.useEffect(() => {
    if (
      (step !== "RUNNING" && step !== "PROFILE_CONFIRMATION") ||
      !researchRunId
    )
      return
    let isSubscribed = true

    const poll = async () => {
      try {
        const res = await fetch(`/api/gtm/research-runs/${researchRunId}`)
        const data = await res.json()
        if (!isSubscribed || !data.success) return

        setRunDetails(data.researchRun)
        if (data.competitors) setCompetitors(data.competitors)
        if (data.segments) setSegments(data.segments)

        const run = data.researchRun
        if (run.status === "done" || run.currentStage === "done") {
          if (data.segments?.length > 0) {
            setSelectedSegmentIds(
              new Set<string>(data.segments.map((s: IcpSegment) => s.id))
            )
          }
          setStep("PROFILE_CONFIRMATION")
        } else if (run.status === "failed") {
          setErrorMessage(failureMessage(run.failureReason))
        }
      } catch (err) {
        console.warn("Error polling research run:", err)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [step, researchRunId])

  /** Re-runs research from Stage 1 with the (possibly edited) description. */
  const handleRetryResearch = async () => {
    if (!researchRunId || !form.companyDescription.trim()) return
    setIsRestarting(true)
    try {
      const res = await fetch(`/api/gtm/research-runs/${researchRunId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyDescription: form.companyDescription.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not restart research")
      setRunDetails(data.researchRun)
      setCompetitors([])
      setSegments([])
      setSelectedSegmentIds(new Set())
      setIsEditingDescription(false)
      setStep("RUNNING")
      toast.success("Company research restarted with your updated description.")
    } catch (err) {
      toast.error(errorText(err, "Could not restart research"))
    } finally {
      setIsRestarting(false)
    }
  }

  const handleRestartStage = async () => {
    if (!researchRunId) return
    setIsRestarting(true)
    try {
      const res = await fetch(
        `/api/gtm/research-runs/${researchRunId}/restart-stage`,
        {
          method: "POST",
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not restart stage")
      toast.success(data.message || "Stage restarted successfully!")
    } catch (err) {
      toast.error(errorText(err, "Could not restart stage"))
    } finally {
      setIsRestarting(false)
    }
  }

  const toggleSegment = (segmentId: string) =>
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(segmentId)) next.delete(segmentId)
      else next.add(segmentId)
      return next
    })

  const toggleAllSegments = () =>
    setSelectedSegmentIds(
      selectedSegmentIds.size === segments.length
        ? new Set()
        : new Set(segments.map((s) => s.id))
    )

  const handleLaunchCampaigns = async () => {
    if (selectedSegmentIds.size === 0) {
      toast.error("Please select at least one segment to pursue")
      return
    }
    setIsLaunching(true)
    const createdIds: string[] = []
    try {
      for (const icpSegmentId of Array.from(selectedSegmentIds)) {
        const res = await fetch("/api/gtm/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icpSegmentId }),
        })
        const data = await res.json()
        if (res.ok && data.campaign?.id) createdIds.push(data.campaign.id)
      }
      setLaunchedCampaignIds(createdIds)
      setStep("COMPLETED")
      toast.success(
        `Successfully launched ${createdIds.length} outreach campaign(s)!`
      )
    } catch (err) {
      toast.error(errorText(err, "Failed to launch campaigns"))
    } finally {
      setIsLaunching(false)
    }
  }

  switch (step) {
    case "FORM":
      return (
        <CompanyDetailsForm
          values={form}
          onChange={updateForm}
          logoPreview={logoPreview}
          isFetchingLogo={isFetchingLogo}
          onLogoError={clearLogo}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onSubmit={handleSubmitForm}
        />
      )
    case "RUNNING":
      return (
        <ResearchProgress
          runDetails={runDetails}
          fallbackCompanyName={form.companyName}
          fallbackWebsiteUrl={form.websiteUrl}
          logoPreview={logoPreview}
          competitors={competitors}
          segments={segments}
          errorMessage={errorMessage}
          isRestarting={isRestarting}
          onRestartStage={handleRestartStage}
          onRetryResearch={handleRetryResearch}
        />
      )
    case "PROFILE_CONFIRMATION":
      return (
        <CompanyProfileConfirmation
          profile={runDetails?.synthesizedProfile}
          companyDescription={form.companyDescription}
          isEditing={isEditingDescription}
          isSaving={isRestarting}
          onDescriptionChange={(companyDescription) =>
            updateForm({ companyDescription })
          }
          onEdit={() => setIsEditingDescription(true)}
          onContinue={() => {
            setStep("SEGMENT_SELECTION")
            toast.success("ICP segments are ready to review.")
          }}
          onSave={handleRetryResearch}
        />
      )
    case "SEGMENT_SELECTION":
      return (
        <SegmentSelection
          run={runDetails}
          segments={segments}
          selectedIds={selectedSegmentIds}
          onToggle={toggleSegment}
          onToggleAll={toggleAllSegments}
          isLaunching={isLaunching}
          onLaunch={handleLaunchCampaigns}
        />
      )
    case "COMPLETED":
      return <CampaignsCreated campaignIds={launchedCampaignIds} />
  }
}
