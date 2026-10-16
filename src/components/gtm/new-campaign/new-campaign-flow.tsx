"use client"

import * as React from "react"
import { toast } from "sonner"
import { Container } from "@/components/layout/container"
import { CompanyProfileConfirmation } from "../company-profile-confirmation"
import { CampaignsCreated } from "./campaigns-created"
import { CompanyDetailsForm } from "./company-details-form"
import { ResearchProgress } from "./research-progress"
import { SegmentSelection } from "./segment-selection"
import { useLogoPreview } from "@/hooks/use-logo-preview"
import { countryCodeFromName } from "@/lib/geo/countries"
import type {
  CompanyFormErrors,
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

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

/** Inline errors for the required fields; empty when the form can be sent. */
function validate(form: CompanyFormValues): CompanyFormErrors {
  const errors: CompanyFormErrors = {}
  if (!form.websiteUrl.trim()) errors.websiteUrl = "Enter your website, for example acme.com."
  if (!form.companyName.trim()) errors.companyName = "Enter your company name."
  if (!countryCodeFromName(form.targetCountry)) errors.targetCountry = "Choose a country from the list."
  if (!form.companyDescription.trim())
    errors.companyDescription = "Describe what your company does in a sentence or two."
  return errors
}

/**
 * New research run → profile confirmation → segment selection → campaigns.
 * Starts a research run from the form, polls it until the last research step
 * finishes, then starts one outreach campaign per selected segment.
 */
export function NewCampaignFlow() {
  const [step, setStep] = React.useState<FlowStep>("FORM")
  const [form, setForm] = React.useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<CompanyFormErrors>({})
  const updateForm = (patch: Partial<CompanyFormValues>) =>
    setForm((prev) => ({ ...prev, ...patch }))
  const { logoPreview, clearLogo } = useLogoPreview(form.websiteUrl)

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
  const [launchError, setLaunchError] = React.useState<string | null>(null)

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validate(form)
    setFieldErrors(errors)
    const targetCountryCode = countryCodeFromName(form.targetCountry)
    const firstInvalid = Object.keys(errors)[0]
    if (firstInvalid || !targetCountryCode) {
      if (firstInvalid) document.getElementById(firstInvalid)?.focus()
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
        throw new Error(data.error || "Research didn't start. Check your connection and try again.")

      setResearchRunId(data.researchRun.id)
      setRunDetails(data.researchRun)
      setStep("RUNNING")
    } catch (err) {
      setErrorMessage(errorText(err, "Research didn't start. Check your connection and try again."))
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
      if (!res.ok) throw new Error(data.error || "Research didn't restart. Try again.")
      setRunDetails(data.researchRun)
      setCompetitors([])
      setSegments([])
      setSelectedSegmentIds(new Set())
      setIsEditingDescription(false)
      setStep("RUNNING")
      toast.success("Research is running again with your new description.")
    } catch (err) {
      toast.error(errorText(err, "Research didn't restart. Try again."))
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
      if (!res.ok) throw new Error(data.error || "The step didn't restart. Try again.")
      toast.success("Step restarted.")
    } catch (err) {
      toast.error(errorText(err, "The step didn't restart. Try again."))
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
    if (selectedSegmentIds.size === 0) return
    setIsLaunching(true)
    const createdIds: string[] = []
    let firstError: string | null = null
    try {
      for (const icpSegmentId of Array.from(selectedSegmentIds)) {
        const res = await fetch("/api/gtm/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icpSegmentId }),
        })
        const data = await res.json()
        if (res.ok && data.campaign?.id) createdIds.push(data.campaign.id)
        else firstError ??= typeof data.error === "string" ? data.error : null
      }
      setLaunchedCampaignIds(createdIds)
      setLaunchError(firstError)
      setStep("COMPLETED")
    } catch (err) {
      toast.error(errorText(err, "Campaigns didn't start. Check your connection and try again."))
    } finally {
      setIsLaunching(false)
    }
  }

  const renderStep = () => {
    switch (step) {
      case "FORM":
        return (
          <CompanyDetailsForm
            values={form}
            onChange={updateForm}
            errors={fieldErrors}
            logoPreview={logoPreview}
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
            onCancelEdit={() => setIsEditingDescription(false)}
            onContinue={() => setStep("SEGMENT_SELECTION")}
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
            onEditDescription={() => {
              setIsEditingDescription(true)
              setStep("PROFILE_CONFIRMATION")
            }}
          />
        )
      case "COMPLETED":
        return (
          <CampaignsCreated
            campaignIds={launchedCampaignIds}
            requested={selectedSegmentIds.size}
            firstError={launchError}
          />
        )
    }
  }

  return (
    <Container width="prose" className="py-6 md:py-8">
      {renderStep()}
    </Container>
  )
}
