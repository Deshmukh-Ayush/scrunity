"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { CompanyProfileFields } from "@/components/company-profile/company-profile-fields"
import { COMPANY_PROFILE_COPY as COPY } from "@/lib/company-profile/copy"
import type { CompanyFormErrors, CompanyFormValues } from "@/lib/company-profile/form"

/**
 * Onboarding step 2: the company details, saved as the organization's
 * profile. Skipping is allowed; the first research run asks for them then.
 * State comes from props, so the testing route renders empty, filled and error.
 */
export function OnboardingCompanyStep({
  values,
  errors,
  logoPreview,
  onLogoError,
  isSubmitting,
  isSkipping,
  errorMessage,
  onChange,
  onSubmit,
  onSkip,
}: {
  values: CompanyFormValues
  errors: CompanyFormErrors
  logoPreview: string | null
  onLogoError: () => void
  isSubmitting: boolean
  isSkipping: boolean
  errorMessage: string | null
  onChange: (patch: Partial<CompanyFormValues>) => void
  onSubmit: (e: React.FormEvent) => void
  onSkip: () => void
}) {
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  // The step replaces the organization form, so focus moves to its heading.
  React.useEffect(() => headingRef.current?.focus(), [])

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-1">
        <p className="text-meta text-fg-muted">{COPY.onboardingStep}</p>
        <h1 ref={headingRef} tabIndex={-1} className="text-title text-fg-strong outline-none">
          {COPY.onboardingTitle}
        </h1>
        <p className="text-body text-fg-muted">{COPY.onboardingDescription}</p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-6 rounded-xl border border-transparent bg-surface p-4 shadow-surface sm:p-6"
      >
        <CompanyProfileFields
          values={values}
          onChange={onChange}
          errors={errors}
          logoPreview={logoPreview}
          onLogoError={onLogoError}
        />

        {errorMessage && <FieldError scope="form">{errorMessage}</FieldError>}

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p id="onboarding-skip-note" className="text-body text-fg-muted">
            {COPY.onboardingSkipNote}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={onSkip}
              loading={isSkipping}
              disabled={isSubmitting}
              aria-describedby="onboarding-skip-note"
            >
              {COPY.onboardingSkip}
            </Button>
            <Button variant="brand" size="lg" type="submit" loading={isSubmitting} disabled={isSkipping}>
              {COPY.onboardingSave}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
