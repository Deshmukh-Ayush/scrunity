"use client"

import * as React from "react"
import { CompanyProfileConfirmation } from "@/components/gtm/company-profile-confirmation"
import { CampaignsCreated } from "@/components/gtm/new-campaign/campaigns-created"
import { CompanyDetailsForm } from "@/components/gtm/new-campaign/company-details-form"
import { ResearchProgress } from "@/components/gtm/new-campaign/research-progress"
import { SegmentSelection } from "@/components/gtm/new-campaign/segment-selection"
import type { CompanyFormErrors, CompanyFormValues } from "@/components/gtm/new-campaign/types"
import { CampaignDetailHeader } from "@/components/gtm/campaign-detail/campaign-detail-header"
import { CampaignDetailRoot } from "@/components/gtm/campaign-detail/campaign-detail-root"
import { CampaignProcessCard } from "@/components/gtm/campaign-detail/campaign-process-card"
import { MailboxStatusBar } from "@/components/gtm/campaign-detail/mailbox-status-bar"
import { StageDetail } from "@/components/gtm/campaign-detail/stage-detail"
import type { CampaignData } from "@/components/gtm/campaign-detail/types"
import {
  FIXTURE_MAILBOX,
  FIXTURE_RUN,
  FIXTURE_SEGMENTS,
  NO_DRAFTS,
  RESEARCH_RUN_STATES,
} from "./process-fixtures"

/**
 * The five research screens and the campaign page's zero-result endings,
 * rendered from fixtures. Every action is local: nothing is fetched, started
 * or sent (the campaign root runs in fixture mode: no polling, every action a no-op).
 */

const noop = () => {}

const EMPTY_FORM: CompanyFormValues = {
  websiteUrl: "",
  companyName: "",
  companyDescription: "",
  companySize: "11-50",
  contextDoc: "",
  fileName: "",
  targetCountry: "",
  targetRegion: "",
  arrAmount: "",
  arrCurrency: "USD",
  tamAmount: "",
  tamCurrency: "USD",
}

function Switcher<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label="Fixture state" className="flex flex-wrap gap-1.5" data-demo-switcher="">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className="rounded-sm border border-dashed border-neutral-400 px-2 py-0.5 font-mono text-xs aria-pressed:bg-neutral-900 aria-pressed:text-white"
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function ResearchFormDemo() {
  const [values, setValues] = React.useState(EMPTY_FORM)
  const [errors, setErrors] = React.useState<CompanyFormErrors>({})
  return (
    <div className="w-full max-w-[720px]">
      <CompanyDetailsForm
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        errors={errors}
        logoPreview={null}
        onLogoError={noop}
        isSubmitting={false}
        errorMessage={null}
        onSubmit={(e) => {
          // Fixture: show the inline errors the real flow shows; never posts.
          e.preventDefault()
          setErrors({
            ...(values.websiteUrl ? {} : { websiteUrl: "Enter your website, for example acme.com." }),
            ...(values.companyName ? {} : { companyName: "Enter your company name." }),
            ...(values.targetCountry ? {} : { targetCountry: "Choose a country from the list." }),
            ...(values.companyDescription
              ? {}
              : { companyDescription: "Describe what your company does in a sentence or two." }),
          })
        }}
      />
    </div>
  )
}

const RUN_STATES = Object.keys(RESEARCH_RUN_STATES)

export function ResearchProgressDemo() {
  const [state, setState] = React.useState(RUN_STATES[1])
  const fixture = RESEARCH_RUN_STATES[state]
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4">
      <Switcher value={state} options={RUN_STATES} onChange={setState} />
      <ResearchProgress
        runDetails={fixture.run}
        fallbackCompanyName={fixture.run.companyName}
        fallbackWebsiteUrl={fixture.run.websiteUrl}
        logoPreview={null}
        competitors={fixture.competitors}
        segments={fixture.segments}
        isRestarting={false}
        onRestartStage={noop}
        onRetryResearch={noop}
      />
    </div>
  )
}

export function ResearchProfileDemo() {
  const [editing, setEditing] = React.useState(false)
  const [description, setDescription] = React.useState(FIXTURE_RUN.companyDescription)
  return (
    <div className="w-full max-w-[720px]">
      <CompanyProfileConfirmation
        profile={FIXTURE_RUN.synthesizedProfile}
        companyDescription={description}
        isEditing={editing}
        isSaving={false}
        onDescriptionChange={setDescription}
        onEdit={() => setEditing(true)}
        onCancelEdit={() => setEditing(false)}
        onContinue={noop}
        onSave={() => setEditing(false)}
      />
    </div>
  )
}

export function ResearchSegmentsDemo() {
  const [selected, setSelected] = React.useState(new Set(FIXTURE_SEGMENTS.slice(0, 2).map((s) => s.id)))
  const [empty, setEmpty] = React.useState<"segments" | "no segments">("segments")
  const segments = empty === "segments" ? FIXTURE_SEGMENTS : []
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4">
      <Switcher value={empty} options={["segments", "no segments"] as const} onChange={setEmpty} />
      <SegmentSelection
        run={{ ...FIXTURE_RUN, status: "done", currentStage: "done" }}
        segments={segments}
        selectedIds={selected}
        onToggle={(id) =>
          setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }
        onToggleAll={() =>
          setSelected((prev) => (prev.size === segments.length ? new Set() : new Set(segments.map((s) => s.id))))
        }
        isLaunching={false}
        onLaunch={noop}
        onEditDescription={noop}
      />
    </div>
  )
}

export function ResearchDoneDemo() {
  const [which, setWhich] = React.useState<"all started" | "some failed" | "none started">("all started")
  const ids = which === "none started" ? [] : which === "some failed" ? ["fixture-a"] : ["fixture-a", "fixture-b"]
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-4">
      <Switcher value={which} options={["all started", "some failed", "none started"] as const} onChange={setWhich} />
      <CampaignsCreated
        campaignIds={ids}
        requested={2}
        firstError={which === "all started" ? null : "You've reached your limit of 3 active campaigns."}
      />
    </div>
  )
}

/** The campaign page's real parts on fixture data, with polling and every action off. */
export function CampaignFixtureDemo({ data }: { data: CampaignData }) {
  return (
    <div className="w-full max-w-5xl">
      <CampaignDetailRoot
        campaignId={data.campaign.id}
        initialData={data}
        initialDrafts={NO_DRAFTS}
        initialMailbox={FIXTURE_MAILBOX}
        fixture
        className="flex flex-col gap-6"
      >
        <div className="flex flex-col gap-3">
          <CampaignDetailHeader />
          <MailboxStatusBar />
        </div>
        <CampaignProcessCard />
        <StageDetail />
      </CampaignDetailRoot>
    </div>
  )
}
