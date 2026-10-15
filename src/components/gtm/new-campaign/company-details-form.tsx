"use client"

import * as React from "react"
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Globe,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react"
import { toast } from "sonner"
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
import { TargetMarketFields } from "./target-market-fields"
import type { CompanyFormValues, CompanySize } from "./types"

/** Step 1: website, name, size, value proposition and an optional .md/.txt context doc. */
export function CompanyDetailsForm({
  values,
  onChange,
  logoPreview,
  isFetchingLogo,
  onLogoError,
  isSubmitting,
  errorMessage,
  onSubmit,
}: {
  values: CompanyFormValues
  onChange: (patch: Partial<CompanyFormValues>) => void
  logoPreview: string | null
  isFetchingLogo: boolean
  onLogoError: () => void
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (e: React.FormEvent) => void
}) {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a .md or .txt document")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      onChange({
        fileName: file.name,
        contextDoc: (event.target?.result as string) || "",
      })
      toast.success(`Loaded context from ${file.name}`)
    }
    reader.readAsText(file)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New GTM Research & Outreach
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Provide your website and core proposition. The autonomous pipeline
          will analyze your product, benchmark competitors, derive ICP segments,
          find decision-makers, and draft personalized emails.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-primary" />
            Company Details
          </CardTitle>
          <CardDescription>
            Basic parameters to anchor autonomous competitor and ICP discovery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
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
                {logoPreview && (
                  <div className="absolute top-1.5 right-2.5 flex items-center gap-1.5 rounded border border-border/60 bg-muted/60 px-1.5 py-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoPreview}
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
                Branding logo and favicon will be automatically fetched from
                this site.
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
                  onChange({ companySize: e.target.value as CompanySize })
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              >
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="200+">200+ employees</option>
              </select>
            </div>

            <TargetMarketFields values={values} onChange={onChange} />

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
                    {values.fileName ||
                      "Upload product documentation or battlecard (.md)"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Optional context document (.md) — no personal information.
                  </span>
                </label>
              </div>
              {values.contextDoc && (
                <p className="text-[11px] text-success">
                  Loaded {values.contextDoc.length} characters of context for
                  the research prompt.
                </p>
              )}
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button variant="brand" type="submit" disabled={isSubmitting} className="gap-2">
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
