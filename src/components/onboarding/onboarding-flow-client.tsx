"use client"

import * as React from "react"
import { toast } from "sonner"
import { CompanyProfileConfirmation } from "@/components/gtm/company-profile-confirmation"
import { useLogoPreview } from "@/hooks/use-logo-preview"
import {
  DEMO_COMPETITORS,
  DEMO_FORM_DEFAULTS,
  DEMO_PROFILE,
  DEMO_SEGMENTS,
} from "./flow/demo-data"
import { OnboardingComplete } from "./flow/onboarding-complete"
import {
  OnboardingForm,
  type OnboardingFormValues,
} from "./flow/onboarding-form"
import { OnboardingSegments } from "./flow/onboarding-segments"
import {
  OnboardingStepper,
  type OnboardingStep,
} from "./flow/onboarding-stepper"
import {
  SimulatedResearch,
  type SimulatedStage,
} from "./flow/simulated-research"

const ALL_SEGMENT_IDS = () => new Set(DEMO_SEGMENTS.map((s) => s.id))

/**
 * Onboarding walkthrough. DEMO ONLY: research is simulated with timers and the
 * profile/segments come from demo-data.ts; nothing is created server-side.
 */
export function OnboardingFlowClient() {
  const [step, setStep] = React.useState<OnboardingStep>("FORM")
  const [form, setForm] = React.useState<OnboardingFormValues>({
    ...DEMO_FORM_DEFAULTS,
    contextDocText: "",
    fileName: "",
  })
  const updateForm = (patch: Partial<OnboardingFormValues>) =>
    setForm((prev) => ({ ...prev, ...patch }))
  const { logoPreview, isFetchingLogo, clearLogo } = useLogoPreview(
    form.websiteUrl,
    500
  )

  const [runningStage, setRunningStage] = React.useState<SimulatedStage>(1)
  const [competitorsFound, setCompetitorsFound] = React.useState<string[]>([])
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [isRestartingResearch, setIsRestartingResearch] = React.useState(false)
  const [selectedSegmentIds, setSelectedSegmentIds] =
    React.useState(ALL_SEGMENT_IDS)

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !form.websiteUrl.trim() ||
      !form.companyName.trim() ||
      !form.companyDescription.trim()
    ) {
      toast.error("Please fill in website URL, company name, and description")
      return
    }
    setRunningStage(1)
    setCompetitorsFound([])
    setStep("RUNNING")
    toast.success("Autonomous research pipeline initiated!")
  }

  // Simulated timeline: stage 2 at 1.8s, stage 3 at 3.6s, profile review at 5.4s.
  React.useEffect(() => {
    if (step !== "RUNNING") return
    const t1 = setTimeout(() => {
      setRunningStage(2)
      setCompetitorsFound(DEMO_COMPETITORS)
    }, 1800)
    const t2 = setTimeout(() => setRunningStage(3), 3600)
    const t3 = setTimeout(() => {
      setRunningStage(4)
      setStep("PROFILE_CONFIRMATION")
      toast.success("Research complete. Review the company profile.")
    }, 5400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [step])

  const handleRestartResearch = () => {
    setIsRestartingResearch(true)
    setTimeout(() => {
      setIsRestartingResearch(false)
      setIsEditingDescription(false)
      setRunningStage(1)
      setCompetitorsFound([])
      setStep("RUNNING")
      toast.success("Research restarted with your updated description.")
    }, 300)
  }

  const toggleSegment = (id: string) =>
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleSelectAll = () =>
    setSelectedSegmentIds(
      selectedSegmentIds.size === DEMO_SEGMENTS.length
        ? new Set()
        : ALL_SEGMENT_IDS()
    )

  const handleLaunchCampaigns = () => {
    if (selectedSegmentIds.size === 0) {
      toast.error("Select at least one segment to continue")
      return
    }
    setStep("COMPLETED")
    toast.success(`Launched ${selectedSegmentIds.size} outreach campaign(s)!`)
  }

  const resetDemo = () => {
    setStep("FORM")
    setRunningStage(1)
    setSelectedSegmentIds(ALL_SEGMENT_IDS())
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <OnboardingStepper step={step} />

      {step === "FORM" && (
        <OnboardingForm
          values={form}
          onChange={updateForm}
          logoUrl={logoPreview}
          isFetchingLogo={isFetchingLogo}
          onLogoError={clearLogo}
          onSubmit={handleFormSubmit}
        />
      )}

      {step === "RUNNING" && (
        <SimulatedResearch
          stage={runningStage}
          companyName={form.companyName}
          websiteUrl={form.websiteUrl}
          logoUrl={logoPreview}
          competitors={competitorsFound}
          onSkip={() => {
            setRunningStage(4)
            setStep("PROFILE_CONFIRMATION")
          }}
        />
      )}

      {step === "PROFILE_CONFIRMATION" && (
        <CompanyProfileConfirmation
          profile={DEMO_PROFILE}
          companyDescription={form.companyDescription}
          isEditing={isEditingDescription}
          isSaving={isRestartingResearch}
          onDescriptionChange={(companyDescription) =>
            updateForm({ companyDescription })
          }
          onEdit={() => setIsEditingDescription(true)}
          onContinue={() => setStep("SEGMENTS")}
          onSave={handleRestartResearch}
        />
      )}

      {step === "SEGMENTS" && (
        <OnboardingSegments
          segments={DEMO_SEGMENTS}
          selectedIds={selectedSegmentIds}
          onToggle={toggleSegment}
          onToggleAll={toggleSelectAll}
          onLaunch={handleLaunchCampaigns}
        />
      )}

      {step === "COMPLETED" && (
        <OnboardingComplete
          segmentCount={selectedSegmentIds.size}
          onRestart={resetDemo}
        />
      )}
    </div>
  )
}
