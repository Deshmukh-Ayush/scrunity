"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Check } from "@/components/ui/icons"
import { LocalDate } from "@/components/ui/local-date"
import { COMPANY_PROFILE_COPY as COPY, lastUpdatedBy } from "@/lib/company-profile/copy"
import type { CompanyFormErrors, CompanyFormValues } from "@/lib/company-profile/form"
import type { PublicCompanyProfile, ResearchFormMode } from "@/lib/company-profile/input"
import { CompanyProfileFields } from "./company-profile-fields"
import { ProfileDetails } from "./profile-details"
import { ResearchModeChoice } from "./research-mode-choice"

/** idle (clean or dirty), saving, saved (a short confirmation), error. */
export type SettingsSaveStatus = "idle" | "saving" | "saved" | "error"

const cardClass = "flex flex-col gap-6 rounded-xl border border-transparent bg-surface p-4 shadow-surface sm:p-6"
const dividerClass = "border-t border-border pt-6"

function LastUpdated({ profile }: { profile: PublicCompanyProfile | null }) {
  if (!profile) return <p className="text-body text-fg-muted">{COPY.noProfileYet}</p>
  return (
    <p className="text-meta text-fg-muted">
      {lastUpdatedBy(profile.updatedByName)}{" "}
      <LocalDate value={profile.updatedAt} options={{ day: "numeric", month: "short", year: "numeric" }} />
    </p>
  )
}

/** A member's view: every saved detail and the setting, no controls. */
export function CompanySettingsReadOnly({ profile }: { profile: PublicCompanyProfile | null }) {
  const mode = profile?.researchFormMode ?? "use_saved"
  return (
    <div className={cardClass}>
      <p className="text-body text-fg-muted">{COPY.membersReadOnly}</p>
      {profile && <ProfileDetails values={profile.values} variant="full" />}
      <div className={`${dividerClass} flex flex-col gap-0.5`}>
        <p className="text-meta text-fg-muted">{COPY.modeLegend}</p>
        <p className="text-body text-fg-strong">{mode === "use_saved" ? COPY.modeUseSaved : COPY.modeAsk}</p>
      </div>
      <LastUpdated profile={profile} />
    </div>
  )
}

/**
 * The Settings form: the shared company fields, the research form setting
 * and Save changes (disabled until something changed). State comes from
 * props, so the testing route renders clean, dirty, saving, saved and error.
 */
export function CompanySettingsForm({
  profile,
  values,
  mode,
  errors,
  dirty,
  status,
  errorMessage,
  logoPreview,
  onLogoError,
  onChange,
  onModeChange,
  onSubmit,
}: {
  profile: PublicCompanyProfile | null
  values: CompanyFormValues
  mode: ResearchFormMode
  errors: CompanyFormErrors
  dirty: boolean
  status: SettingsSaveStatus
  errorMessage: string | null
  logoPreview: string | null
  onLogoError: () => void
  onChange: (patch: Partial<CompanyFormValues>) => void
  onModeChange: (mode: ResearchFormMode) => void
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} noValidate className={cardClass}>
      <CompanyProfileFields
        values={values}
        onChange={onChange}
        errors={errors}
        logoPreview={logoPreview}
        onLogoError={onLogoError}
      />
      <div className={dividerClass}>
        <ResearchModeChoice value={mode} onChange={onModeChange} />
      </div>

      {status === "error" && errorMessage && <FieldError scope="form">{errorMessage}</FieldError>}

      <div className={`${dividerClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
        <LastUpdated profile={profile} />
        <div className="flex items-center justify-end gap-3">
          <p role="status" className="flex items-center gap-1.5 text-body text-fg-default">
            {status === "saved" && (
              <>
                <Check className="size-4" aria-hidden />
                {COPY.saved}
              </>
            )}
          </p>
          <Button
            type="submit"
            variant="brand"
            loading={status === "saving"}
            disabled={!dirty && status !== "saving"}
            className="shrink-0"
          >
            {COPY.save}
          </Button>
        </div>
      </div>
    </form>
  )
}
