"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { CompanyProfileFields } from "@/components/company-profile/company-profile-fields"
import { ProfileDetails } from "@/components/company-profile/profile-details"
import { COMPANY_PROFILE_COPY as COPY } from "@/lib/company-profile/copy"
import type { CompanyFormErrors, CompanyFormValues } from "@/lib/company-profile/form"
import { showsForm, type NewRunAction, type NewRunState } from "@/lib/company-profile/new-run"
import { COMPANY_PROFILE_HREF } from "@/components/shell/nav-config"

/** "Also update my saved profile": unticked, this run's details stay with this run. */
function AlsoUpdateProfile({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor="alsoUpdateProfile" className="flex cursor-pointer items-start gap-2.5">
      <input
        id="alsoUpdateProfile"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby="alsoUpdateProfile-text"
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-body text-fg-strong">{COPY.alsoUpdate}</span>
        <span id="alsoUpdateProfile-text" className="text-body text-fg-muted">
          {COPY.alsoUpdateText}
        </span>
      </span>
    </label>
  )
}

/**
 * Step 1 of a new research run. What it shows depends on the saved company
 * profile (lib/company-profile/new-run.ts): the full form on a first run, a
 * summary card with "Change for this run" when the saved details are used,
 * or an empty form with "Fill with saved details" when the organization asks
 * every time. One brand button, "Start research", in every view.
 */
export function CompanyDetailsForm({
  state,
  dispatch,
  errors,
  logoPreview,
  onLogoError,
  isSubmitting,
  errorMessage,
  onSubmit,
}: {
  state: NewRunState
  dispatch: (action: NewRunAction) => void
  errors: CompanyFormErrors
  logoPreview: string | null
  onLogoError: () => void
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (e: React.FormEvent) => void
}) {
  const { view, form, alsoUpdate, saved } = state
  const changeRef = React.useRef<HTMLButtonElement>(null)
  const [announcement, setAnnouncement] = React.useState("")
  // Focus follows the view: into the form after "Change for this run", back to the button after "Use saved details".
  const previousView = React.useRef(view)
  React.useEffect(() => {
    if (previousView.current === "summary" && view === "editing") document.getElementById("websiteUrl")?.focus()
    if (previousView.current === "editing" && view === "summary") changeRef.current?.focus()
    previousView.current = view
  }, [view])

  const onChange = (patch: Partial<CompanyFormValues>) => dispatch({ type: "edit", patch })

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
        {view === "summary" && saved && (
          <section aria-labelledby="saved-details-title" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="saved-details-title" className="text-section text-fg-strong">
                {COPY.summaryTitle}
              </h2>
              <Button ref={changeRef} type="button" onClick={() => dispatch({ type: "change_for_run" })}>
                {COPY.changeForRun}
              </Button>
            </div>
            <ProfileDetails values={saved.values} />
            <Link
              href={COMPANY_PROFILE_HREF}
              className="focus-ring w-fit rounded-sm text-body text-fg-muted underline underline-offset-2 hover:text-fg-strong"
            >
              {COPY.editInSettings}
            </Link>
          </section>
        )}

        {view === "editing" && (
          <div className="flex justify-start">
            <Button type="button" variant="ghost" onClick={() => dispatch({ type: "use_saved" })}>
              {COPY.useSavedDetails}
            </Button>
          </div>
        )}

        {view === "ask" && saved && (
          <div className="flex justify-start">
            <Button
              type="button"
              onClick={() => {
                dispatch({ type: "fill_saved" })
                setAnnouncement(COPY.filledWithSaved)
              }}
            >
              {COPY.fillWithSaved}
            </Button>
          </div>
        )}

        {showsForm(view) && (
          <CompanyProfileFields
            values={form}
            onChange={onChange}
            errors={errors}
            logoPreview={logoPreview}
            onLogoError={onLogoError}
          />
        )}

        {(view === "editing" || view === "ask") && (
          <div className="border-t border-border pt-6">
            <AlsoUpdateProfile checked={alsoUpdate} onChange={(checked) => dispatch({ type: "set_also_update", checked })} />
          </div>
        )}

        {errorMessage && <FieldError scope="form">{errorMessage}</FieldError>}

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-end">
          {view === "first_run" && <p className="text-body text-fg-muted sm:me-auto">{COPY.savedForNextTime}</p>}
          <Button variant="brand" size="lg" type="submit" loading={isSubmitting} className="w-full shrink-0 sm:w-auto">
            Start research
          </Button>
        </div>
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </form>
    </div>
  )
}
