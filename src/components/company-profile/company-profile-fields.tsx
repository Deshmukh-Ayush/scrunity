"use client"

import { Globe } from "@/components/ui/icons"
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
import { ContextDocField } from "@/components/gtm/new-campaign/context-doc-field"
import { TargetMarketFields } from "@/components/gtm/new-campaign/target-market-fields"
import { COMPANY_SIZE_LABELS, type CompanyFormErrors, type CompanyFormValues } from "@/lib/company-profile/form"
import { COMPANY_SIZES, type CompanySize } from "@/lib/company-profile/input"

const SIZES = COMPANY_SIZES.map((value) => ({ value, label: COMPANY_SIZE_LABELS[value] }))

// A fieldset legend sits in the fieldset's top border, so the divider goes on a wrapper.
const dividerClass = "border-t border-border pt-6 first:border-t-0 first:pt-0"
const sectionClass = "gap-4"
const legendClass = "mb-4 text-section text-fg-strong"

/**
 * The company details in their three sections (your company, who you want
 * to reach, context), with inline errors next to the field that failed.
 * One component for onboarding, New research run and Settings; the caller
 * owns the <form>, its submit and its actions.
 */
export function CompanyProfileFields({
  values,
  onChange,
  errors,
  logoPreview,
  onLogoError,
}: {
  values: CompanyFormValues
  onChange: (patch: Partial<CompanyFormValues>) => void
  errors: CompanyFormErrors
  logoPreview: string | null
  onLogoError: () => void
}) {
  return (
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
  )
}

/** Focuses the first field with an error; true when there is none. */
export function focusFirstInvalid(errors: CompanyFormErrors) {
  const first = Object.keys(errors)[0]
  if (first) document.getElementById(first)?.focus()
  return !first
}
