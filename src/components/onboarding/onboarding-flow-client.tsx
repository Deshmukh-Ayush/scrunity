"use client"

import * as React from "react"
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
} from "@/components/gtm/company-profile-confirmation"
import {
  Sparkles,
  Globe,
  Building2,
  UploadCloud,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Search,
  Target,
  Mail,
  Check,
  RotateCcw,
  FileText,
  X,
} from "lucide-react"

type OnboardingStep =
  | "FORM"
  | "RUNNING"
  | "PROFILE_CONFIRMATION"
  | "SEGMENTS"
  | "COMPLETED"

interface MockSegment {
  id: string
  name: string
  painPoint: string
  criteria: string[]
  exampleCompanies: Array<{ name: string; domain: string }>
  estimatedSizeLabel: string
}

const DEFAULT_SEGMENTS: MockSegment[] = [
  {
    id: "seg-1",
    name: "Seed & Series-A FinTech Founders",
    painPoint:
      "Struggling with slow revenue reconciliation and contract scope creep while scaling early client deliverables.",
    criteria: ["FinTech", "11-50 employees", "Series A", "B2B SaaS"],
    exampleCompanies: [
      { name: "Ramp", domain: "ramp.com" },
      { name: "Mercury", domain: "mercury.com" },
      { name: "Brex", domain: "brex.com" },
    ],
    estimatedSizeLabel: "~8,000 companies in US/EU (LLM estimate)",
  },
  {
    id: "seg-2",
    name: "Digital Agency Managing Directors",
    painPoint:
      "Losing 15–20% margin to unbilled out-of-scope client revisions and manual payment follow-ups.",
    criteria: ["Creative / Dev Agency", "10-100 seats", "Retainer model"],
    exampleCompanies: [
      { name: "Huge", domain: "hugeinc.com" },
      { name: "Work & Co", domain: "work.co" },
      { name: "Fantasy", domain: "fantasy.co" },
    ],
    estimatedSizeLabel: "~12,500 agencies in US/UK (LLM estimate)",
  },
  {
    id: "seg-3",
    name: "Enterprise Legal & Procurement Ops",
    painPoint:
      "Manual SOW auditing and lack of tamper-evident signature trails across distributed contractors.",
    criteria: ["200+ employees", "Multi-vendor", "Strict compliance"],
    exampleCompanies: [
      { name: "Ironclad", domain: "ironcladapp.com" },
      { name: "ContractPodAi", domain: "contractpodai.com" },
    ],
    estimatedSizeLabel: "~4,200 enterprises (LLM estimate)",
  },
  {
    id: "seg-4",
    name: "B2B SaaS Customer Success Leads",
    painPoint:
      "High client churn caused by misaligned milestone expectations and lack of deliverable progress visibility.",
    criteria: ["High ARR accounts", "Quarterly milestones", "Customer Success"],
    exampleCompanies: [
      { name: "Gainsight", domain: "gainsight.com" },
      { name: "Vitally", domain: "vitally.io" },
      { name: "ChurnZero", domain: "churnzero.com" },
    ],
    estimatedSizeLabel: "~6,500 teams (LLM estimate)",
  },
]

const MOCK_PROFILE: SynthesizedProfile = {
  summary:
    "Acme Software helps modern digital agencies protect revenue and keep client collaboration on track.",
  industry: "Agency operations software",
  productFocus: "Client collaboration and revenue protection",
  targetCustomerLanguage:
    "Digital agencies managing client deliverables and revisions",
  signals: ["Agency workflow", "Revenue protection", "Client collaboration"],
}

export function OnboardingFlowClient() {
  const [step, setStep] = React.useState<OnboardingStep>("FORM")

  // Form state
  const [websiteUrl, setWebsiteUrl] = React.useState("https://acme.com")
  const [companyName, setCompanyName] = React.useState("Acme Software")
  const [companySize, setCompanySize] = React.useState<
    "1-10" | "11-50" | "51-200" | "200+"
  >("11-50")
  const [companyDescription, setCompanyDescription] = React.useState(
    "AI-powered client collaboration and revenue protection for modern digital agencies."
  )
  const [contextDocText, setContextDocText] = React.useState("")
  const [fileName, setFileName] = React.useState("")

  // Logo state
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null)
  const [isFetchingLogo, setIsFetchingLogo] = React.useState(false)

  // Timeline execution state (Pure UI simulation)
  const [runningStage, setRunningStage] = React.useState<1 | 2 | 3 | 4>(1)
  const [competitorsFound, setCompetitorsFound] = React.useState<string[]>([])
  const [isEditingDescription, setIsEditingDescription] = React.useState(false)
  const [isRestartingResearch, setIsRestartingResearch] = React.useState(false)

  // Segment selection state
  const [selectedSegmentIds, setSelectedSegmentIds] = React.useState<
    Set<string>
  >(new Set(["seg-1", "seg-2", "seg-3", "seg-4"]))

  // Auto-fetch logo preview on website URL input
  React.useEffect(() => {
    const raw = websiteUrl.trim()
    if (!raw || !raw.includes(".")) {
      setLogoUrl(null)
      return
    }

    let domain = raw
    try {
      const normalized = raw.startsWith("http") ? raw : `https://${raw}`
      domain = new URL(normalized).hostname.replace(/^www\./, "")
    } catch {
      // ignore
    }

    // Immediate fallback favicon preview
    const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    setLogoUrl(fallbackFavicon)

    setIsFetchingLogo(true)
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/gtm/fetch-logo?url=${encodeURIComponent(raw)}`,
          {
            signal: controller.signal,
          }
        )
        const data = await res.json()
        if (data?.logoUrl) {
          setLogoUrl(data.logoUrl)
        }
      } catch {
        // Fallback remains active
      } finally {
        setIsFetchingLogo(false)
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [websiteUrl])

  // Handle .md file upload
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
      setContextDocText(text || "")
      toast.success(`Loaded context from ${file.name}`)
    }
    reader.readAsText(file)
  }

  const removeFile = () => {
    setFileName("")
    setContextDocText("")
  }

  // Form submission -> transition to RUNNING step
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !websiteUrl.trim() ||
      !companyName.trim() ||
      !companyDescription.trim()
    ) {
      toast.error("Please fill in website URL, company name, and description")
      return
    }

    setRunningStage(1)
    setCompetitorsFound([])
    setStep("RUNNING")
    toast.success("Autonomous research pipeline initiated!")
  }

  // Simulated running timeline progression (pure UI)
  React.useEffect(() => {
    if (step !== "RUNNING") return

    // Stage 1 -> Stage 2 after 1.8s
    const t1 = setTimeout(() => {
      setRunningStage(2)
      setCompetitorsFound([
        "Linear",
        "ClickUp",
        "Asana",
        "Monday.com",
        "Notion",
      ])
    }, 1800)

    // Stage 2 -> Stage 3 after 3.6s
    const t2 = setTimeout(() => {
      setRunningStage(3)
    }, 3600)

    // Stage 3 -> profile confirmation after 5.4s
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

  // Segment toggle
  const toggleSegment = (id: string) => {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedSegmentIds.size === DEFAULT_SEGMENTS.length) {
      setSelectedSegmentIds(new Set())
    } else {
      setSelectedSegmentIds(new Set(DEFAULT_SEGMENTS.map((s) => s.id)))
    }
  }

  // Launch campaigns -> transition to COMPLETED step
  const handleLaunchCampaigns = () => {
    if (selectedSegmentIds.size === 0) {
      toast.error("Select at least one segment to continue")
      return
    }

    setStep("COMPLETED")
    toast.success(`Launched ${selectedSegmentIds.size} outreach campaign(s)!`)
  }

  // Reset demo
  const resetDemo = () => {
    setStep("FORM")
    setRunningStage(1)
    setSelectedSegmentIds(new Set(["seg-1", "seg-2", "seg-3", "seg-4"]))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Top Stepper Indicator */}
      <div className="flex items-center justify-between border-b pb-4 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[11px]",
              step === "FORM"
                ? "bg-primary font-semibold text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            1
          </div>
          <span
            className={cn(step === "FORM" && "font-semibold text-foreground")}
          >
            Company Profile
          </span>
        </div>

        <div className="hidden h-px w-8 bg-border sm:block" />

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[11px]",
              step === "RUNNING"
                ? "bg-primary font-semibold text-primary-foreground"
                : step === "SEGMENTS" || step === "COMPLETED"
                  ? "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground"
            )}
          >
            2
          </div>
          <span
            className={cn(
              step === "RUNNING" && "font-semibold text-foreground"
            )}
          >
            Autonomous Research
          </span>
        </div>

        <div className="hidden h-px w-8 bg-border sm:block" />

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[11px]",
              step === "SEGMENTS"
                ? "bg-primary font-semibold text-primary-foreground"
                : step === "COMPLETED"
                  ? "bg-muted text-foreground"
                  : "bg-muted/50 text-muted-foreground"
            )}
          >
            3
          </div>
          <span
            className={cn(
              step === "SEGMENTS" && "font-semibold text-foreground"
            )}
          >
            ICP Segments
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* STEP 1: ENTRY FORM */}
      {/* ==================================================================== */}
      {step === "FORM" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome! Let&apos;s set up your GTM research
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Provide your website URL and core proposition. Our autonomous
              agent will scrape your product, benchmark competitors, formulate
              verified ICP targets, and draft personalized outreach.
            </p>
          </div>

          <Card>
            <CardHeader className="p-6 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-primary" />
                Company Onboarding Information
              </CardTitle>
              <CardDescription>
                Initial parameters required to guide the web scraping and
                competitive discovery engine.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <form onSubmit={handleFormSubmit} className="space-y-5">
                {/* Website URL with Logo Preview */}
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
                    {logoUrl && (
                      <div className="absolute top-1.5 right-2.5 flex items-center gap-1.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="size-5 rounded bg-background object-contain"
                          onError={() => setLogoUrl(null)}
                        />
                        {isFetchingLogo && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Logo will auto-fetch from your site&apos;s favicon or
                    og:image (does not block submission).
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

                {/* Company Size Dropdown */}
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="contextDoc">
                      Optional Context Document (.md / .txt)
                    </Label>
                    <span className="text-[11px] text-muted-foreground italic">
                      no personal information
                    </span>
                  </div>

                  {fileName ? (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        <span className="text-xs font-medium text-foreground">
                          {fileName}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {contextDocText.length} chars
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-border/80 p-5 text-center transition-colors hover:bg-muted/20">
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
                          Upload context document (.md)
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Optional product documentation or battlecard — no
                          personal information.
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Submit CTA */}
                <div className="flex justify-end pt-4">
                  <Button type="submit" size="default" className="gap-2">
                    <Sparkles className="size-4" />
                    Start Autonomous Research
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 2: RUNNING TIMELINE */}
      {/* ==================================================================== */}
      {step === "RUNNING" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Autonomous Research in Progress
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Analyzing {companyName} ({websiteUrl})
              </p>
            </div>
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo"
                className="size-10 rounded-lg border bg-background object-contain p-1"
              />
            )}
          </div>

          <Card>
            <CardHeader className="p-6 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>Pipeline Execution Timeline</span>
                </CardTitle>
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <Loader2 className="size-3 animate-spin text-primary" />
                  Live Pipeline
                </Badge>
              </div>
              <CardDescription>
                Stages execute sequentially, discovering live market
                intelligence and structuring ICP targets.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {/* Adapted Torch Dashed-Connector Timeline */}
              <ol className="relative ml-1 space-y-3 py-2">
                {/* Stage 1 */}
                <li className="relative flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        runningStage > 1
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-primary/40 bg-primary/10 text-primary"
                      )}
                    >
                      {runningStage > 1 ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                    </div>
                    {/* Vertical dashed connector line */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute top-8 bottom-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed transition-colors",
                        runningStage > 1
                          ? "border-emerald-500/40"
                          : "border-border/60"
                      )}
                    />
                  </div>

                  <div className="min-w-0 flex-1 pb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Stage 1: Research Company
                      </span>
                      {runningStage === 1 && (
                        <Badge variant="secondary" className="py-0 text-[10px]">
                          In Progress
                        </Badge>
                      )}
                      {runningStage > 1 && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Scraping homepage, extracting SEO keywords, and
                      discovering social profiles (LinkedIn, X, Instagram).
                    </p>
                    <div className="mt-2 rounded border border-border/40 bg-muted/30 p-2 font-mono text-xs text-foreground">
                      {runningStage > 1
                        ? "Homepage analyzed. Discovered LinkedIn company page and active brand presence."
                        : "Scraping homepage and searching social presence..."}
                    </div>
                  </div>
                </li>

                {/* Stage 2 */}
                <li className="relative flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        runningStage > 2
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : runningStage === 2
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/60 bg-muted text-muted-foreground"
                      )}
                    >
                      {runningStage > 2 ? (
                        <CheckCircle2 className="size-4" />
                      ) : runningStage === 2 ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Search className="size-4" />
                      )}
                    </div>
                    {/* Vertical dashed connector line */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        "absolute top-8 bottom-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed transition-colors",
                        runningStage > 2
                          ? "border-emerald-500/40"
                          : "border-border/60"
                      )}
                    />
                  </div>

                  <div className="min-w-0 flex-1 pb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Stage 2: Explore Competitors
                      </span>
                      {runningStage === 2 && (
                        <Badge variant="secondary" className="py-0 text-[10px]">
                          In Progress
                        </Badge>
                      )}
                      {runningStage > 2 && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Generating search queries, querying Firecrawl, and
                      filtering aggregator directories.
                    </p>
                    <div className="mt-2 rounded border border-border/40 bg-muted/30 p-2 font-mono text-xs text-foreground">
                      {runningStage >= 2
                        ? `Identified and benchmarked ${competitorsFound.length} commercial competitors.`
                        : "Waiting for company research..."}
                    </div>

                    {competitorsFound.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {competitorsFound.map((name) => (
                          <Badge
                            key={name}
                            variant="outline"
                            className="gap-1 text-[11px]"
                          >
                            <Globe className="size-3 text-muted-foreground" />
                            {name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </li>

                {/* Stage 3 */}
                <li className="relative flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        runningStage > 3
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : runningStage === 3
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/60 bg-muted text-muted-foreground"
                      )}
                    >
                      {runningStage > 3 ? (
                        <CheckCircle2 className="size-4" />
                      ) : runningStage === 3 ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Target className="size-4" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        Stage 3: Define ICP Segments
                      </span>
                      {runningStage === 3 && (
                        <Badge variant="secondary" className="py-0 text-[10px]">
                          In Progress
                        </Badge>
                      )}
                      {runningStage > 3 && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deriving 4–6 Ideal Customer Profile segments with acute
                      pain points and qualification criteria.
                    </p>
                    <div className="mt-2 rounded border border-border/40 bg-muted/30 p-2 font-mono text-xs text-foreground">
                      {runningStage === 3
                        ? "Formulating segments and verifying candidate company websites..."
                        : runningStage > 3
                          ? "Generated 4 verified ICP segments."
                          : "Waiting for competitor analysis..."}
                    </div>
                  </div>
                </li>
              </ol>

              {/* Fast Forward Test Button for developer preview */}
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>Stages progressing automatically...</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRunningStage(4)
                    setStep("PROFILE_CONFIRMATION")
                  }}
                  className="h-7 gap-1 text-xs"
                >
                  Skip to Profile Review →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 3: COMPANY PROFILE CONFIRMATION */}
      {/* ==================================================================== */}
      {step === "PROFILE_CONFIRMATION" && (
        <CompanyProfileConfirmation
          profile={MOCK_PROFILE}
          companyDescription={companyDescription}
          isEditing={isEditingDescription}
          isSaving={isRestartingResearch}
          onDescriptionChange={setCompanyDescription}
          onEdit={() => setIsEditingDescription(true)}
          onContinue={() => setStep("SEGMENTS")}
          onSave={handleRestartResearch}
        />
      )}

      {/* ==================================================================== */}
      {/* STEP 4: SEGMENT SELECTION */}
      {/* ==================================================================== */}
      {step === "SEGMENTS" && (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Select ICP Segments to Pursue
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Autonomous research complete. Select which Ideal Customer
                Profile segments to launch as cold outreach campaigns.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="self-start"
            >
              {selectedSegmentIds.size === DEFAULT_SEGMENTS.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {DEFAULT_SEGMENTS.map((seg) => {
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
                        <span className="text-xs text-muted-foreground italic">
                          Est. Size: {seg.estimatedSizeLabel}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "flex size-5 items-center justify-center rounded border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-background"
                        )}
                      >
                        {isSelected && (
                          <Check className="size-3.5 stroke-[3]" />
                        )}
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

                    <div className="border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
                      <strong className="text-foreground">
                        Discovered Live Examples:
                      </strong>{" "}
                      {seg.exampleCompanies.map((ex) => ex.name).join(", ")}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {selectedSegmentIds.size} of {DEFAULT_SEGMENTS.length} segment(s)
              selected
            </p>
            <Button
              size="default"
              disabled={selectedSegmentIds.size === 0}
              onClick={handleLaunchCampaigns}
              className="gap-2"
            >
              <Mail className="size-4" />
              Launch Selected Campaigns ({selectedSegmentIds.size})
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 4: COMPLETED SUMMARY */}
      {/* ==================================================================== */}
      {step === "COMPLETED" && (
        <div className="mx-auto max-w-xl space-y-6 py-8 text-center">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-7" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Campaigns Launched!
            </h1>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              You selected {selectedSegmentIds.size} target segment(s). The
              autonomous pipeline is now finding candidate prospect companies,
              mapping decision-makers, and drafting cold emails.
            </p>
          </div>

          <Card className="border-dashed text-left">
            <CardContent className="space-y-2 p-4 text-xs">
              <span className="font-semibold text-foreground">
                Autonomous Next Steps:
              </span>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>
                  Stage 4: Find prospect companies matching selected segment
                  criteria
                </li>
                <li>
                  Stage 5: Identify decision-makers via website scraping &
                  LinkedIn pattern matching
                </li>
                <li>
                  Stage 6: Draft personalized emails and place in approval queue
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ variant: "default" }),
                "w-full gap-2 sm:w-auto"
              )}
            >
              Go to Dashboard
              <ArrowRight className="size-4" />
            </Link>
            <Button
              variant="outline"
              onClick={resetDemo}
              className="w-full gap-2 sm:w-auto"
            >
              <RotateCcw className="size-4" />
              Test Onboarding Again
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
