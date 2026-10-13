"use client"

import * as React from "react"
import {
  ArrowRight,
  Building2,
  FileText,
  Globe,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export interface OnboardingFormValues {
  websiteUrl: string
  companyName: string
  companySize: "1-10" | "11-50" | "51-200" | "200+"
  companyDescription: string
  contextDocText: string
  fileName: string
}

/** Onboarding step 1: company details and an optional context document. */
export function OnboardingForm({
  values,
  onChange,
  logoUrl,
  isFetchingLogo,
  onLogoError,
  onSubmit,
}: {
  values: OnboardingFormValues
  onChange: (patch: Partial<OnboardingFormValues>) => void
  logoUrl: string | null
  isFetchingLogo: boolean
  onLogoError: () => void
  onSubmit: (e: React.FormEvent) => void
}) {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a .md or .txt document")
      return
    }
    onChange({ fileName: file.name })
    const reader = new FileReader()
    reader.onload = (event) => {
      onChange({ contextDocText: (event.target?.result as string) || "" })
      toast.success(`Loaded context from ${file.name}`)
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome! Let&apos;s set up your GTM research
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Provide your website URL and core proposition. Our autonomous agent
          will scrape your product, benchmark competitors, formulate verified
          ICP targets, and draft personalized outreach.
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
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="websiteUrl">Website URL *</Label>
              <div className="relative">
                <Globe className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                <Input
                  id="websiteUrl"
                  placeholder="https://example.com"
                  className="pr-12 pl-9"
                  value={values.websiteUrl}
                  onChange={(e) => onChange({ websiteUrl: e.target.value })}
                  required
                />
                {logoUrl && (
                  <div className="absolute top-1.5 right-2.5 flex items-center gap-1.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="size-5 rounded bg-background object-contain"
                      onError={onLogoError}
                    />
                    {isFetchingLogo && (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Logo will auto-fetch from your site&apos;s favicon or og:image
                (does not block submission).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                placeholder="Acme Inc"
                value={values.companyName}
                onChange={(e) => onChange({ companyName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companySize">Company Size *</Label>
              <select
                id="companySize"
                value={values.companySize}
                onChange={(e) =>
                  onChange({
                    companySize: e.target
                      .value as OnboardingFormValues["companySize"],
                  })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="200+">200+ employees</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyDescription">
                Short Description / Value Proposition *
              </Label>
              <Textarea
                id="companyDescription"
                placeholder="What does your company do, who does it serve, and what core pain point do you solve?"
                rows={3}
                value={values.companyDescription}
                onChange={(e) =>
                  onChange({ companyDescription: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="contextDoc">
                  Optional Context Document (.md / .txt)
                </Label>
                <span className="text-[11px] text-muted-foreground italic">
                  no personal information
                </span>
              </div>

              {values.fileName ? (
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <span className="text-xs font-medium text-foreground">
                      {values.fileName}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {values.contextDocText.length} chars
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange({ fileName: "", contextDocText: "" })
                    }
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    aria-label="Remove context document"
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
                      Optional product documentation or battlecard — no personal
                      information.
                    </span>
                  </label>
                </div>
              )}
            </div>

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
  )
}
