"use client"

import * as React from "react"
import { Globe } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ContextDocField } from "./context-doc-field"
import { TargetMarketFields } from "./target-market-fields"
import type { CompanyFormErrors, CompanyFormValues, CompanySize } from "./types"

const SIZES: { value: CompanySize; label: string }[] = [
  { value: "1-10", label: "1–10 people" },
  { value: "11-50", label: "11–50 people" },
  { value: "51-200", label: "51–200 people" },
  { value: "200+", label: "More than 200 people" },
]

// A fieldset legend sits in the fieldset's top border, so the divider goes on a wrapper.
const dividerClass = "border-t border-border pt-6 first:border-t-0 first:pt-0"
const sectionClass = "gap-4"
const legendClass = "mb-4 text-section text-fg-strong"

/**
 * Step 1 of a new research run: three sections (your company, who you want
 * to reach, context), inline errors next to the field that failed, and one
 * brand button at the end. Submitting is the flow's existing handler.
 */
export function CompanyDetailsForm({
  values,
  onChange,
  errors,
  logoPreview,
  onLogoError,
  isSubmitting,
  errorMessage,
  onSubmit,
}: {
  values: CompanyFormValues
  onChange: (patch: Partial<CompanyFormValues>) => void
  errors: CompanyFormErrors
  logoPreview: string | null
  onLogoError: () => void
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg-strong">New research run</h1>
        <p className="text-body text-fg-muted">
          Tell us about your company and who you sell to. Research finds your
          competitors and the customer segments most likely to buy, then you
          choose which ones to contact.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-6 rounded-xl border border-transparent bg-surface p-4 shadow-surface sm:p-6"
      >
        <FieldGroup className="gap-6">
          <div className={dividerClass}>
          <FieldSet className={sectionClass}>
            <FieldLegend className={legendClass}>Your company</FieldLegend>
            <Field data-invalid={Boolean(errors.websiteUrl) || undefined}>
              <FieldLabel htmlFor="websiteUrl">Website</FieldLabel>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-fg-muted">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="size-4 rounded-sm object-contain" onError={onLogoError} />
                  ) : (
                    <Globe className="size-4" />
                  )}
                </span>
                <Input
                  id="websiteUrl"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="acme.com"
                  className="ps-8"
                  value={values.websiteUrl}
                  onChange={(e) => onChange({ websiteUrl: e.target.value })}
                  aria-invalid={Boolean(errors.websiteUrl) || undefined}
                  aria-describedby={errors.websiteUrl ? "websiteUrl-error" : undefined}
                />
              </div>
              <FieldError id="websiteUrl-error">{errors.websiteUrl}</FieldError>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.companyName) || undefined}>
                <FieldLabel htmlFor="companyName">Company name</FieldLabel>
                <Input
                  id="companyName"
                  autoComplete="organization"
                  placeholder="Acme"
                  value={values.companyName}
                  onChange={(e) => onChange({ companyName: e.target.value })}
                  aria-invalid={Boolean(errors.companyName) || undefined}
                  aria-describedby={errors.companyName ? "companyName-error" : undefined}
                />
                <FieldError id="companyName-error">{errors.companyName}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="companySize">Company size</FieldLabel>
                <Select
                  items={SIZES}
                  value={values.companySize}
                  onValueChange={(value) => {
                    if (value) onChange({ companySize: value as CompanySize })
                  }}
                >
                  <SelectTrigger id="companySize" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldSet>
          </div>

          <div className={dividerClass}>
          <FieldSet className={sectionClass}>
            <FieldLegend className={legendClass}>Who you want to reach</FieldLegend>
            <TargetMarketFields values={values} onChange={onChange} countryError={errors.targetCountry} />
          </FieldSet>
          </div>

          <div className={dividerClass}>
          <FieldSet className={sectionClass}>
            <FieldLegend className={legendClass}>Context</FieldLegend>
            <Field data-invalid={Boolean(errors.companyDescription) || undefined}>
              <FieldLabel htmlFor="companyDescription">What your company does</FieldLabel>
              <Textarea
                id="companyDescription"
                rows={4}
                placeholder="We help mid-size logistics firms cut fuel costs with route-planning software."
                value={values.companyDescription}
                onChange={(e) => onChange({ companyDescription: e.target.value })}
                aria-invalid={Boolean(errors.companyDescription) || undefined}
                aria-describedby={
                  errors.companyDescription ? "companyDescription-error" : "companyDescription-help"
                }
              />
              <FieldDescription id="companyDescription-help">
                Say what you sell, who buys it and the problem it solves.
              </FieldDescription>
              <FieldError id="companyDescription-error">{errors.companyDescription}</FieldError>
            </Field>
            <ContextDocField
              fileName={values.fileName}
              characters={values.contextDoc.length}
              onLoad={(fileName, contextDoc) => onChange({ fileName, contextDoc })}
              onClear={() => onChange({ fileName: "", contextDoc: "" })}
            />
          </FieldSet>
          </div>
        </FieldGroup>

        {errorMessage && <FieldError scope="form">{errorMessage}</FieldError>}

        <div className="flex justify-end border-t border-border pt-6">
          <Button variant="brand" size="lg" type="submit" loading={isSubmitting} className="w-full sm:w-auto">
            Start research
          </Button>
        </div>
      </form>
    </div>
  )
}
