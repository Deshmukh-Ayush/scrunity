"use client"

import * as React from "react"
import { CompanySettingsForm, CompanySettingsReadOnly, type SettingsSaveStatus } from "@/components/company-profile/company-settings-form"
import { CompanyDetailsForm } from "@/components/gtm/new-campaign/company-details-form"
import { OnboardingCompanyStep } from "@/components/onboarding/company-step"
import { COMPANY_PROFILE_COPY } from "@/lib/company-profile/copy"
import {
  EMPTY_COMPANY_FORM,
  companyInputToForm,
  companyFormsEqual,
  validateCompanyForm,
  type CompanyFormErrors,
} from "@/lib/company-profile/form"
import type { PublicCompanyProfile, ResearchFormMode } from "@/lib/company-profile/input"
import { initialNewRunState, newRunReducer, type NewRunAction } from "@/lib/company-profile/new-run"
import { Switcher } from "./flow-demos"
import type { ShowcaseEntry } from "./types"

/** A saved profile shaped like a real one. Fake company and person. */
const SAVED: PublicCompanyProfile = {
  values: {
    websiteUrl: "https://routewise.example",
    companyName: "Routewise",
    companyDescription:
      "Route-planning software for mid-size logistics firms. Dispatchers plan daily routes in minutes and cut fuel costs by about 12%.",
    companySize: "11-50",
    contextDoc: "# Routewise\n\nCustomers: regional 3PLs with 20 to 200 trucks.",
    contextDocFileName: "routewise-positioning.md",
    targetCountryCode: "IN",
    targetRegion: "Maharashtra",
    ownArr: { amount: 18_000_000, currency: "INR" },
    ownTam: null,
  },
  researchFormMode: "use_saved",
  updatedAt: "2026-10-21T09:30:00.000Z",
  updatedByName: "Priya Shah",
}
const SAVED_FORM = companyInputToForm(SAVED.values)
const noop = () => {}
const preventSubmit = (e: React.FormEvent) => e.preventDefault()

// Onboarding step ----------------------------------------------------------

const ONBOARDING_STATES = ["empty", "filled", "error"] as const

export function OnboardingStepDemo() {
  const [state, setState] = React.useState<(typeof ONBOARDING_STATES)[number]>("empty")
  const [values, setValues] = React.useState(EMPTY_COMPANY_FORM)
  const [errors, setErrors] = React.useState<CompanyFormErrors>({})
  const choose = (next: (typeof ONBOARDING_STATES)[number]) => {
    setState(next)
    setValues(next === "empty" ? EMPTY_COMPANY_FORM : SAVED_FORM)
    setErrors({})
  }
  return (
    <div className="flex w-full flex-col gap-4">
      <Switcher value={state} options={ONBOARDING_STATES} onChange={choose} />
      <OnboardingCompanyStep
        key={state}
        values={values}
        errors={errors}
        logoPreview={null}
        onLogoError={noop}
        isSubmitting={false}
        isSkipping={false}
        errorMessage={state === "error" ? COMPANY_PROFILE_COPY.saveFailed : null}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onSubmit={(e) => {
          e.preventDefault()
          setErrors(validateCompanyForm(values))
        }}
        onSkip={noop}
      />
    </div>
  )
}

// New research run -----------------------------------------------------------

const NEW_RUN_STATES = {
  "no profile": { saved: null, actions: [] },
  "use_saved: summary": { saved: SAVED, actions: [] },
  "use_saved: changed for this run, tick on": {
    saved: SAVED,
    actions: [
      { type: "change_for_run" },
      { type: "edit", patch: { targetRegion: "Karnataka" } },
      { type: "set_also_update", checked: true },
    ],
  },
  "ask_every_time: empty": { saved: { ...SAVED, researchFormMode: "ask_every_time" }, actions: [] },
  "ask_every_time: filled from saved": {
    saved: { ...SAVED, researchFormMode: "ask_every_time" },
    actions: [{ type: "fill_saved" }],
  },
} satisfies Record<string, { saved: PublicCompanyProfile | null; actions: NewRunAction[] }>
type NewRunFixture = keyof typeof NEW_RUN_STATES
const NEW_RUN_KEYS = Object.keys(NEW_RUN_STATES) as NewRunFixture[]

function NewRunFixtureView({ fixture }: { fixture: NewRunFixture }) {
  const { saved, actions } = NEW_RUN_STATES[fixture]
  const [state, dispatch] = React.useReducer(newRunReducer, null, () =>
    (actions as NewRunAction[]).reduce(newRunReducer, initialNewRunState(saved))
  )
  const [errors, setErrors] = React.useState<CompanyFormErrors>({})
  return (
    <CompanyDetailsForm
      state={state}
      dispatch={dispatch}
      errors={errors}
      logoPreview={null}
      onLogoError={noop}
      isSubmitting={false}
      errorMessage={null}
      onSubmit={(e) => {
        // Fixture: inline errors only; never posts.
        e.preventDefault()
        setErrors(validateCompanyForm(state.form))
      }}
    />
  )
}

export function NewRunProfileDemo() {
  const [fixture, setFixture] = React.useState<NewRunFixture>("use_saved: summary")
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4">
      <Switcher value={fixture} options={NEW_RUN_KEYS} onChange={setFixture} />
      <NewRunFixtureView key={fixture} fixture={fixture} />
    </div>
  )
}

// Settings -----------------------------------------------------------------

const SETTINGS_STATES = ["clean", "dirty", "saving", "saved", "error", "no profile yet", "member read-only"] as const
type SettingsFixture = (typeof SETTINGS_STATES)[number]

const STATUS: Partial<Record<SettingsFixture, SettingsSaveStatus>> = { saving: "saving", saved: "saved", error: "error" }

function SettingsFixtureView({ fixture }: { fixture: SettingsFixture }) {
  const profile = fixture === "no profile yet" ? null : SAVED
  const baseline = profile ? SAVED_FORM : EMPTY_COMPANY_FORM
  const startsDirty = fixture === "dirty" || fixture === "saving" || fixture === "error"
  const [values, setValues] = React.useState(startsDirty ? { ...baseline, targetRegion: "Karnataka" } : baseline)
  const [mode, setMode] = React.useState<ResearchFormMode>(fixture === "dirty" ? "ask_every_time" : "use_saved")
  const [errors, setErrors] = React.useState<CompanyFormErrors>({})
  if (fixture === "member read-only") return <CompanySettingsReadOnly profile={SAVED} />
  const dirty = !companyFormsEqual(values, baseline) || mode !== "use_saved"
  return (
    <CompanySettingsForm
      profile={profile}
      values={values}
      mode={mode}
      errors={errors}
      dirty={dirty}
      status={STATUS[fixture] ?? "idle"}
      errorMessage={fixture === "error" ? COMPANY_PROFILE_COPY.saveFailed : null}
      logoPreview={null}
      onLogoError={noop}
      onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      onModeChange={setMode}
      onSubmit={(e) => {
        preventSubmit(e)
        setErrors(validateCompanyForm(values))
      }}
    />
  )
}

export function CompanySettingsDemo() {
  const [fixture, setFixture] = React.useState<SettingsFixture>("clean")
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <Switcher value={fixture} options={SETTINGS_STATES} onChange={setFixture} />
      <SettingsFixtureView key={fixture} fixture={fixture} />
    </div>
  )
}

export const onboardingCompanyEntry: ShowcaseEntry = {
  id: "company-profile-onboarding",
  name: "Onboarding: tell us about your company",
  group: "Flows",
  description:
    "Step 2 of onboarding, after the organization exists: the shared company form, Save and continue, Skip for now. Empty, filled and a save that failed.",
  render: () => <OnboardingStepDemo />,
}

export const newRunProfileEntry: ShowcaseEntry = {
  id: "company-profile-new-run",
  name: "New research run: saved company details",
  group: "Flows",
  description:
    "No profile yet (full form, saved for next time), use_saved (summary card, Change for this run, Also update my saved profile) and ask_every_time (empty form, Fill with saved details). Start research never posts here.",
  render: () => <NewRunProfileDemo />,
}

export const companySettingsEntry: ShowcaseEntry = {
  id: "company-profile-settings",
  name: "Settings: company profile",
  group: "Settings",
  description:
    "The whole profile in the shared form with the research form setting. Save changes is disabled until something changes; saving, a short Saved confirmation, an error, no profile yet, and a member's read-only view.",
  render: () => <CompanySettingsDemo />,
}
