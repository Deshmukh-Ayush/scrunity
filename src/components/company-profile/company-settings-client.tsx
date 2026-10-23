"use client"

import * as React from "react"
import { useLogoPreview } from "@/hooks/use-logo-preview"
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning"
import { COMPANY_PROFILE_COPY as COPY } from "@/lib/company-profile/copy"
import {
  EMPTY_COMPANY_FORM,
  companyFormToInput,
  companyFormsEqual,
  companyInputToForm,
  validateCompanyForm,
  type CompanyFormErrors,
  type CompanyFormValues,
} from "@/lib/company-profile/form"
import type { CompanyProfileView, PublicCompanyProfile, ResearchFormMode } from "@/lib/company-profile/input"
import { focusFirstInvalid } from "./company-profile-fields"
import { CompanySettingsForm, CompanySettingsReadOnly, type SettingsSaveStatus } from "./company-settings-form"

const SAVED_VISIBLE_MS = 3000

const baselineOf = (profile: PublicCompanyProfile | null) => ({
  values: profile ? companyInputToForm(profile.values) : EMPTY_COMPANY_FORM,
  mode: profile?.researchFormMode ?? ("use_saved" as ResearchFormMode),
})

/** Owns the Settings form's state and the PUT; members get the read-only view. */
export function CompanySettingsClient({ initialView }: { initialView: CompanyProfileView }) {
  const [profile, setProfile] = React.useState(initialView.profile)
  const [baseline, setBaseline] = React.useState(() => baselineOf(initialView.profile))
  const [values, setValues] = React.useState<CompanyFormValues>(baseline.values)
  const [mode, setMode] = React.useState<ResearchFormMode>(baseline.mode)
  const [errors, setErrors] = React.useState<CompanyFormErrors>({})
  const [status, setStatus] = React.useState<SettingsSaveStatus>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const savedLogo = profile ? { websiteUrl: profile.values.websiteUrl, logoUrl: profile.logoUrl } : null
  const { logoPreview, clearLogo } = useLogoPreview(values.websiteUrl, { saved: savedLogo })

  const dirty = !companyFormsEqual(values, baseline.values) || mode !== baseline.mode
  useUnsavedChangesWarning(dirty && initialView.canEdit, COPY.unsavedLeave)

  React.useEffect(() => {
    if (status !== "saved") return
    const timer = setTimeout(() => setStatus("idle"), SAVED_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [status])

  if (!initialView.canEdit) return <CompanySettingsReadOnly profile={profile} />

  const edited = () => {
    if (status === "saved" || status === "error") setStatus("idle")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === "saving") return
    const nextErrors = validateCompanyForm(values)
    setErrors(nextErrors)
    const input = companyFormToInput(values)
    if (!focusFirstInvalid(nextErrors) || !input) return

    setStatus("saving")
    setErrorMessage(null)
    try {
      const res = await fetch("/api/gtm/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, researchFormMode: mode }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<CompanyProfileView> & { error?: string }
      if (!res.ok || !data.profile) throw new Error(data.error || COPY.saveFailed)
      setProfile(data.profile)
      const next = baselineOf(data.profile)
      setBaseline(next)
      setValues(next.values)
      setMode(next.mode)
      setStatus("saved")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : COPY.saveFailed)
      setStatus("error")
    }
  }

  return (
    <CompanySettingsForm
      profile={profile}
      values={values}
      mode={mode}
      errors={errors}
      dirty={dirty}
      status={status}
      errorMessage={errorMessage}
      logoPreview={logoPreview}
      onLogoError={clearLogo}
      onChange={(patch) => {
        setValues((prev) => ({ ...prev, ...patch }))
        edited()
      }}
      onModeChange={(next) => {
        setMode(next)
        edited()
      }}
      onSubmit={handleSubmit}
    />
  )
}
