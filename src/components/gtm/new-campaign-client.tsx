"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  CompanyProfileConfirmation,
  type SynthesizedProfile,
} from "./company-profile-confirmation"
import {
  Sparkles,
  Globe,
  Building2,
  UploadCloud,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Search,
  Users,
  Target,
  Mail,
  AlertCircle,
  Check,
  RotateCcw,
} from "lucide-react"

type FlowStep =
  | "FORM"
  | "RUNNING"
  | "PROFILE_CONFIRMATION"
  | "SEGMENT_SELECTION"
  | "COMPLETED"

interface IcpSegment {
  id: string
  name: string
  painPoint: string
  criteria: string[]
  exampleCompanies: Array<{ name: string; domain: string }>
  estimatedSizeLabel?: string | null
}

interface Competitor {
  id: string
  name: string
  domain: string
  description: string
  logoUrl?: string | null
}

interface ResearchRunDetails {
  id: string
  companyName: string
  websiteUrl: string
  companyDescription: string
  logoUrl?: string | null
  status: string
  currentStage: string
  synthesizedProfile?: SynthesizedProfile | null
}

export function NewCampaignClient() {
  const router = useRouter()

  // Step state
  const [currentStep, setCurrentStep] = React.useState<FlowStep>("FORM")

  // Form fields
  const [websiteUrl, setWebsiteUrl] = React.useState("")
  const [companyName, setCompanyName] = React.useState("")
  const [companyDescription, setCompanyDescription] = React.useState("")
  const [companySize, setCompanySize] = React.useState<
    "1-10" | "11-50" | "51-200" | "200+"
  >("11-50")
  const [contextDoc, setContextDoc] = React.useState("")
  const [fileName, setFileName] = React.useState("")

  // Logo auto-fetch state
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [isFetchingLogo, setIsFetchingLogo] = React.useState(false)

  // Pipeline execution state
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [researchRunId, setResearchRunId] = React.useState<string | null>(null)
  const [runDetails, setRunDetails] = React.useState<ResearchRunDetails | null>(
    null
  )
  const [competitors, setCompetitors] = React.useState<Competitor[]>([])
  const [segments, setSegments] = React.useState<IcpSegment[]>([])
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [isRestartingResearch, setIsRestartingResearch] = React.useState(false)

  // Segment selection state
  const [selectedSegmentIds, setSelectedSegmentIds] = React.useState<
    Set<string>
  >(new Set())
  const [isLaunchingCampaigns, setIsLaunchingCampaigns] = React.useState(false)
  const [launchedCampaignIds, setLaunchedCampaignIds] = React.useState<
    string[]
  >([])

  // 1. Auto-fetch logo on websiteUrl change (non-blocking)
  React.useEffect(() => {
    const raw = websiteUrl.trim()
    if (!raw || !raw.includes(".")) {
      setLogoPreview(null)
      return
    }

    let domain = raw
    try {
      const normalized = raw.startsWith("http") ? raw : `https://${raw}`
      domain = new URL(normalized).hostname.replace(/^www\./, "")
    } catch {
      // ignore parsing error
    }

    // Immediately show fallback Google favicon preview
    const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    setLogoPreview(fallbackFavicon)

    // Asynchronously query fetch-logo endpoint for og:image/favicon
    const controller = new AbortController()
    setIsFetchingLogo(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/gtm/fetch-logo?url=${encodeURIComponent(raw)}`,
          {
            signal: controller.signal,
          }
        )
        const data = await res.json()
        if (data.logoUrl) {
          setLogoPreview(data.logoUrl)
        }
      } catch {
        // Fallback favicon remains active, non-blocking
      } finally {
        setIsFetchingLogo(false)
      }
    }, 600)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [websiteUrl])

  // Handle .md / .txt file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a .md or .txt document")
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setContextDoc(text || "")
      toast.success(`Loaded context from ${file.name}`)
    }
    reader.readAsText(file)
  }

  // Submit entry form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !websiteUrl.trim() ||
      !companyName.trim() ||
      !companyDescription.trim()
    ) {
      toast.error("Please provide website URL, company name, and description")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch("/api/gtm/research-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: websiteUrl.trim(),
          companyName: companyName.trim(),
          companyDescription: companyDescription.trim(),
          companySize,
          contextDoc: contextDoc.trim() || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to start company research")
      }

      setResearchRunId(data.researchRun.id)
      setRunDetails(data.researchRun)
      setCurrentStep("RUNNING")
      toast.success("Autonomous pipeline started!")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed"
      toast.error(msg)
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Poll research run status while in RUNNING step
  React.useEffect(() => {
    if (
      (currentStep !== "RUNNING" && currentStep !== "PROFILE_CONFIRMATION") ||
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

        // When Stage 3 completes (research run status is "done")
        if (
          data.researchRun.status === "done" ||
          data.researchRun.currentStage === "done"
        ) {
          if (data.segments && data.segments.length > 0) {
            // Select all segments by default
            const initialSelected = new Set<string>(
              data.segments.map((s: IcpSegment) => s.id)
            )
            setSelectedSegmentIds(initialSelected)
          }
          // Keep polling on this step if Stage 1's profile write arrives just
          // after the final pipeline status update.
          setCurrentStep("PROFILE_CONFIRMATION")
        } else if (data.researchRun.status === "failed") {
          setErrorMessage(
            "The autonomous research pipeline encountered an error."
          )
        }
      } catch (err: unknown) {
        console.warn("Error polling research run:", err)
      }
    }

    poll()
    const interval = setInterval(poll, 2500)

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [currentStep, researchRunId])

  const handleRestartResearch = async () => {
    if (!researchRunId || !companyDescription.trim()) return
    setIsRestartingResearch(true)
    try {
      const res = await fetch(`/api/gtm/research-runs/${researchRunId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyDescription: companyDescription.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not restart research")
      setRunDetails(data.researchRun)
      setCompetitors([])
      setSegments([])
      setSelectedSegmentIds(new Set())
      setIsEditingDescription(false)
      setCurrentStep("RUNNING")
      toast.success("Company research restarted with your updated description.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not restart research"
      )
    } finally {
      setIsRestartingResearch(false)
    }
  }

  // Toggle segment selection
  const toggleSegment = (segmentId: string) => {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(segmentId)) {
        next.delete(segmentId)
      } else {
        next.add(segmentId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedSegmentIds.size === segments.length) {
      setSelectedSegmentIds(new Set())
    } else {
      setSelectedSegmentIds(new Set(segments.map((s) => s.id)))
    }
  }

  // Launch outreach campaigns for selected segments
  const handleLaunchCampaigns = async () => {
    if (selectedSegmentIds.size === 0) {
      toast.error("Please select at least one segment to pursue")
      return
    }

    setIsLaunchingCampaigns(true)
    const createdIds: string[] = []

    try {
      for (const segId of Array.from(selectedSegmentIds)) {
        const res = await fetch("/api/gtm/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ icpSegmentId: segId }),
        })
        const data = await res.json()
        if (res.ok && data.campaign?.id) {
          createdIds.push(data.campaign.id)
        }
      }

      setLaunchedCampaignIds(createdIds)
      setCurrentStep("COMPLETED")
      toast.success(
        `Successfully launched ${createdIds.length} outreach campaign(s)!`
      )
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to launch campaigns"
      toast.error(msg)
    } finally {
      setIsLaunchingCampaigns(false)
    }
  }

  // =========================================================================
  // Render Step 1: Entry Form
  // =========================================================================
  if (currentStep === "FORM") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New GTM Research & Outreach
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Provide your website and core proposition. The autonomous pipeline
            will analyze your product, benchmark competitors, derive ICP
            segments, find decision-makers, and draft personalized emails.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Company Details
            </CardTitle>
            <CardDescription>
              Basic parameters to anchor autonomous competitor and ICP
              discovery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Website URL */}
              <div className="space-y-1.5">
                <Label htmlFor="websiteUrl">Website URL *</Label>
                <div className="relative">
                  <Globe className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                  <Input
                    id="websiteUrl"
                    placeholder="https://example.com"
                    className="pr-12 pl-9"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    required
                  />
                  {logoPreview && (
                    <div className="absolute top-1.5 right-2.5 flex items-center gap-1.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoPreview}
                        alt="Logo"
                        className="size-5 rounded bg-background object-contain"
                        onError={() => setLogoPreview(null)}
                      />
                      {isFetchingLogo && (
                        <Loader2 className="size-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Branding logo and favicon will be automatically fetched from
                  this site.
                </p>
              </div>

              {/* Company Name */}
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="Acme Inc"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              {/* Company Size */}
              <div className="space-y-1.5">
                <Label htmlFor="companySize">Company Size *</Label>
                <select
                  id="companySize"
                  value={companySize}
                  onChange={(e) =>
                    setCompanySize(
                      e.target.value as "1-10" | "11-50" | "51-200" | "200+"
                    )
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="200+">200+ employees</option>
                </select>
              </div>

              {/* Short Description */}
              <div className="space-y-1.5">
                <Label htmlFor="companyDescription">
                  Short Description / Value Proposition *
                </Label>
                <Textarea
                  id="companyDescription"
                  placeholder="What does your company do, who does it serve, and what core pain point do you solve?"
                  rows={3}
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  required
                />
              </div>

              {/* Optional .md File Upload */}
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="contextDoc">
                  Optional Context Document (.md / .txt)
                </Label>
                <div className="rounded-lg border-2 border-dashed border-border/80 p-4 text-center transition-colors hover:bg-muted/30">
                  <input
                    type="file"
                    id="contextDoc"
                    accept=".md,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <label
                    htmlFor="contextDoc"
                    className="flex cursor-pointer flex-col items-center gap-1.5"
                  >
                    <UploadCloud className="size-6 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">
                      {fileName
                        ? fileName
                        : "Upload product documentation or battlecard (.md)"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Optional context document (.md) — no personal information.
                    </span>
                  </label>
                </div>
                {contextDoc && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    Loaded {contextDoc.length} characters of context for the
                    research prompt.
                  </p>
                )}
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Starting Research...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Start Autonomous Research
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // =========================================================================
  // Render Step 2: Running State with Dashed-Connector Timeline
  // =========================================================================
  if (currentStep === "RUNNING") {
    const currentStage = runDetails?.currentStage || "research_company"

    // Define timeline stages
    const timelineSteps = [
      {
        id: "stage-1",
        title: "Stage 1: Research Company",
        description:
          "Scraping homepage, extracting SEO keywords, and discovering social profiles (LinkedIn, X, Instagram).",
        stageKey: "research_company",
        isComplete: currentStage !== "research_company",
        isActive: currentStage === "research_company",
        summary:
          currentStage !== "research_company"
            ? "Website branding and social channels analyzed."
            : "Scraping homepage and searching social presence...",
        icon: Building2,
      },
      {
        id: "stage-2",
        title: "Stage 2: Explore Competitors",
        description:
          "Generating search queries, scanning commercial web via Firecrawl, and filtering aggregator directories.",
        stageKey: "research_competitors",
        isComplete:
          currentStage === "define_segments" || currentStage === "done",
        isActive: currentStage === "research_competitors",
        summary:
          currentStage === "define_segments" || currentStage === "done"
            ? `Identified and benchmarked ${competitors.length} commercial competitors.`
            : "Generating queries and benchmarking competitors...",
        icon: Search,
      },
      {
        id: "stage-3",
        title: "Stage 3: Define ICP Segments",
        description:
          "Deriving 4-6 Ideal Customer Profile segments, acute pain points, and discovering real example companies.",
        stageKey: "define_segments",
        isComplete: currentStage === "done" || runDetails?.status === "done",
        isActive: currentStage === "define_segments",
        summary:
          currentStage === "done" || runDetails?.status === "done"
            ? `Generated ${segments.length} verified ICP segments.`
            : "Formulating ICP targets and discovering example companies...",
        icon: Target,
      },
    ]

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Autonomous Market Research in Progress
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Analyzing {runDetails?.companyName || companyName} (
              {runDetails?.websiteUrl || websiteUrl})
            </p>
          </div>
          {logoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Logo"
              className="size-10 rounded-lg border bg-background object-contain p-1"
            />
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Pipeline Execution Timeline</span>
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <Loader2 className="size-3 animate-spin text-primary" />
                Live Inngest Pipeline
              </Badge>
            </CardTitle>
            <CardDescription>
              Each stage executes asynchronously, discovering data and feeding
              the next stage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Adapted Torch Dashed-Connector Timeline */}
            <ol className="relative ml-1 space-y-2 py-2">
              {timelineSteps.map((step, idx) => {
                const isLast = idx === timelineSteps.length - 1
                const StepIcon = step.icon

                return (
                  <li key={step.id} className="relative flex gap-4">
                    {/* Icon container + vertical dashed line connector */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className={cn(
                          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                          step.isComplete
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : step.isActive
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border/60 bg-muted text-muted-foreground"
                        )}
                      >
                        {step.isComplete ? (
                          <CheckCircle2 className="size-4" />
                        ) : step.isActive ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <StepIcon className="size-4" />
                        )}
                      </div>

                      {/* Dashed connector line to next stage */}
                      {!isLast && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            "absolute top-8 bottom-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed transition-colors",
                            step.isComplete
                              ? "border-emerald-500/40"
                              : "border-border/60"
                          )}
                        />
                      )}
                    </div>

                    {/* Stage details */}
                    <div
                      className={cn("min-w-0 flex-1", isLast ? "pb-2" : "pb-6")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {step.title}
                        </span>
                        {step.isActive && (
                          <Badge
                            variant="secondary"
                            className="py-0 text-[10px]"
                          >
                            In Progress
                          </Badge>
                        )}
                        {step.isComplete && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                          >
                            Completed
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {step.description}
                      </p>

                      <div className="mt-2 rounded border border-border/40 bg-muted/30 p-2 font-mono text-xs text-foreground">
                        {step.summary}
                      </div>

                      {/* Live competitors pill display when Stage 2 completes */}
                      {step.stageKey === "research_competitors" &&
                        competitors.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {competitors.slice(0, 5).map((c) => (
                              <Badge
                                key={c.id}
                                variant="outline"
                                className="gap-1 text-[11px]"
                              >
                                <Globe className="size-3 text-muted-foreground" />
                                {c.name}
                              </Badge>
                            ))}
                            {competitors.length > 5 && (
                              <Badge variant="outline" className="text-[11px]">
                                +{competitors.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentStep === "PROFILE_CONFIRMATION") {
    return (
      <CompanyProfileConfirmation
        profile={runDetails?.synthesizedProfile}
        companyDescription={companyDescription}
        isEditing={isEditingDescription}
        isSaving={isRestartingResearch}
        onDescriptionChange={setCompanyDescription}
        onEdit={() => setIsEditingDescription(true)}
        onContinue={() => {
          setCurrentStep("SEGMENT_SELECTION")
          toast.success("ICP segments are ready to review.")
        }}
        onSave={handleRestartResearch}
      />
    )
  }

  // =========================================================================
  // Render Step 3: Segment Selection
  // =========================================================================
  if (currentStep === "SEGMENT_SELECTION") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Select ICP Segments to Pursue
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Autonomous research complete. Select which Ideal Customer
                Profile segments to launch as cold outreach campaigns.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedSegmentIds.size === segments.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {segments.map((seg) => {
            const isSelected = selectedSegmentIds.has(seg.id)

            return (
              <Card
                key={seg.id}
                onClick={() => toggleSegment(seg.id)}
                className={cn(
                  "cursor-pointer border-2 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border/70 hover:border-border"
                )}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base text-foreground">
                        {seg.name}
                      </CardTitle>
                      {seg.estimatedSizeLabel && (
                        <span className="text-xs text-muted-foreground italic">
                          Est. Size: {seg.estimatedSizeLabel} (LLM estimate)
                        </span>
                      )}
                    </div>
                    <div
                      className={cn(
                        "flex size-5 items-center justify-center rounded border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      )}
                    >
                      {isSelected && <Check className="size-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-2">
                  <div className="space-y-1 text-xs">
                    <span className="font-semibold text-foreground">
                      Acute Pain Point:
                    </span>
                    <p className="leading-relaxed text-muted-foreground">
                      {seg.painPoint}
                    </p>
                  </div>

                  {seg.criteria && seg.criteria.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-foreground">
                        Qualification Criteria:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {seg.criteria.map((c, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="py-0 text-[10px] font-normal"
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {seg.exampleCompanies && seg.exampleCompanies.length > 0 && (
                    <div className="border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
                      <strong className="text-foreground">
                        Discovered Live Examples:
                      </strong>{" "}
                      {seg.exampleCompanies.map((ex) => ex.name).join(", ")}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {selectedSegmentIds.size} of {segments.length} segment(s) selected
          </p>
          <Button
            size="default"
            disabled={selectedSegmentIds.size === 0 || isLaunchingCampaigns}
            onClick={handleLaunchCampaigns}
            className="gap-2"
          >
            {isLaunchingCampaigns ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Launching Campaigns...
              </>
            ) : (
              <>
                <Mail className="size-4" />
                Launch Selected Campaigns ({selectedSegmentIds.size})
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // =========================================================================
  // Render Step 4: Completed Confirmation & Direct Links
  // =========================================================================
  return (
    <div className="mx-auto max-w-xl space-y-6 py-6 text-center">
      <div className="flex justify-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-7" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Campaigns Created Successfully!
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          We created {launchedCampaignIds.length} outreach campaign(s). The
          autonomous agent is now finding candidate companies, identifying
          decision-makers, and drafting cold emails for your review.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
        <Link
          href="/dashboard/campaigns"
          className={cn(
            buttonVariants({ variant: "default" }),
            "w-full gap-2 sm:w-auto"
          )}
        >
          <Users className="size-4" />
          View Campaigns Dashboard
        </Link>
        {launchedCampaignIds[0] && (
          <Link
            href={`/dashboard/campaigns/${launchedCampaignIds[0]}`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full gap-2 sm:w-auto"
            )}
          >
            Open First Campaign Pipeline
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
