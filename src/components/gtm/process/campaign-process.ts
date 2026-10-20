import type { ProcessActivityItem, ProcessState } from "@/components/ui/process-card"
import { plainDuration } from "./plain-duration"
import { leadSearchMessage } from "@/lib/lead-search-message"
import { CAMPAIGN_DATA_SOURCE_FAILURE_TEXT } from "@/lib/data-sources/copy"
import type { CampaignData, Draft } from "../campaign-detail/types"

/**
 * One campaign's stored rows -> ProcessCard state, in plain words. Pure and
 * client-safe. Counts come from the campaign detail and its drafts; activity
 * lines are facts derived from those rows (sends carry their real sentAt).
 * There is no per-step event log for campaigns, so nothing else is shown.
 */

export const CAMPAIGN_STAGES = [
  { id: "find_companies", label: "Find companies" },
  { id: "find_contacts", label: "Verified contacts" },
  { id: "write_emails", label: "Write emails" },
  { id: "awaiting_approval", label: "Your review" },
  { id: "send_emails", label: "Sending" },
] as const

export type CampaignStageId = (typeof CAMPAIGN_STAGES)[number]["id"]

/** Where each stored stage sits on the five-stage track. */
const STAGE_INDEX: Record<string, number> = {
  find_companies: 0,
  awaiting_company_selection: 0,
  find_contacts: 1,
  done_for_now: 1,
  write_emails: 2,
  awaiting_approval: 3,
  send_emails: 4,
  done: 4,
}

const RUNNING_TEXT: Record<string, string> = {
  find_companies: "Finding companies that match this segment.",
  find_contacts: "Finding decision makers at the companies you chose and checking their email addresses.",
  write_emails: "Writing a personal email to each verified contact.",
  send_emails: "Sending your approved emails, a little at a time so they read as personal mail.",
}

/** Neutral failure codes (lib/data/public-fields.ts) -> one sentence and the fix. */
const FAILURE_TEXT: Record<string, string> = {
  web_search_attempt_limit:
    "This step stopped at its search limit, which protects your credits. Retry to run it again with a fresh limit.",
  web_search_total_limit:
    "This campaign has used all of its searches. Start a new campaign from the same research to continue.",
  web_search_daily_limit:
    "Your workspace reached today's search limit. Retry after midnight UTC.",
  web_search_monthly_limit:
    "This month's searches are almost used up, so the campaign is paused until your next billing cycle.",
  company_search_monthly_limit:
    "This month's company searches are used up. They reset at the start of next month.",
  company_search_unavailable:
    "Company search is unavailable right now, so nothing more was searched. Contact support.",
  provider_access_denied:
    "Company search isn't available on this account. Contact support.",
  provider_rate_limited:
    "Company search is busy right now. Retry in a few minutes.",
  provider_request_failed:
    "Company search returned an error. Retry the campaign.",
  people_search_unavailable:
    "Finding decision makers isn't available yet, so the campaign stopped after your company choice. Nothing was charged.",
  email_lookup_unavailable:
    "Email checks aren't available right now, so no contacts were checked and no addresses were guessed. Contact support.",
  email_lookup_monthly_limit:
    "This month's email checks are used up. No addresses were guessed.",
  target_country_missing:
    "Finding companies needs a target country. Start a new research run and choose one.",
  data_source_needs_approval:
    "A data source needs approval from an admin before searching can start. Nothing was searched or charged. Contact support, then retry the campaign.",
  data_credits_used_up:
    "The search ran out of data credits and stopped. Nothing more was charged. Contact support to add credits, then retry the campaign.",
  campaign_data_limit:
    "This campaign reached its data limit, which protects your credits. Start a new campaign from the same research to search again.",
  search_filters_failed:
    "This segment couldn't be turned into search filters, so nothing was searched or charged. Retry the campaign. If it fails again, contact support.",
  ...CAMPAIGN_DATA_SOURCE_FAILURE_TEXT,
}

const CREDITS_PAUSED = "Sending is paused because your AI credits ran out. Top up credits in Billing to continue."

export const isCreditsPause = (reason: string | null | undefined) => Boolean(reason && /credit/i.test(reason))

/**
 * Known codes become their sentence. Anything else (internal codes, or server
 * text written for engineers) becomes a plain sentence naming the step.
 */
export function campaignFailureText(reason: string | null | undefined, stageLabel = "This step") {
  if (reason && FAILURE_TEXT[reason]) return FAILURE_TEXT[reason]
  if (isCreditsPause(reason)) return CREDITS_PAUSED
  return `${stageLabel} stopped because of an error. Retry the campaign, or contact support if it keeps happening.`
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${new Intl.PluralRules("en").select(n) === "one" ? one : many}`

export interface CampaignProcessInput {
  data: CampaignData
  drafts: Draft[]
  counts: { approved: number; sent: number; rejected: number; pending: number }
  /** From checkStageStaleness, after hydration only. */
  stalledForMs: number | null
}

export interface CampaignProcess {
  state: ProcessState
  current: number
  details: (string | undefined)[]
  status: string
  badge: { label: string; tone: "neutral" | "success" | "warning" | "danger" }
  progress: { value?: number; max?: number; label: string } | null
  announcement: string
  activity: ProcessActivityItem[]
  /** Why a no-results campaign ended, for the stage's empty state. */
  noResultsReason: string | null
}

export function deriveCampaignProcess({ data, drafts, counts, stalledForMs }: CampaignProcessInput): CampaignProcess {
  const { campaign, companies } = data
  const stageIndex = STAGE_INDEX[campaign.currentStage] ?? 0
  const verified = data.leadSummary?.verified ?? data.contacts.length
  const reviewed = data.leadSummary?.reviewed ?? 0
  const outcome = campaign.leadSearchOutcome
  const bounced = drafts.filter((d) => d.hasBounced).length

  const atGate = campaign.currentStage === "awaiting_company_selection"
  const atReview = campaign.currentStage === "awaiting_approval"
  let noResultsReason: string | null = null
  if (atGate && companies.length === 0)
    noResultsReason = "No companies matched this segment. Try a wider region or a different segment."
  else if (atReview && drafts.length === 0)
    noResultsReason = outcome ? leadSearchMessage(outcome) : "No verified contacts were found, so there are no emails to review."

  // A review with nothing to review ended at Verified contacts, not at Your review.
  const current = noResultsReason && atReview && verified === 0 ? 1 : stageIndex

  let state: ProcessState
  if (campaign.status === "failed") state = "failed"
  else if (campaign.status.startsWith("paused")) state = "paused"
  else if (noResultsReason) state = "no-results"
  else if (campaign.status === "done" || campaign.currentStage === "done") state = "done"
  else if (campaign.status === "in_progress") state = stalledForMs !== null ? "stalled" : "running"
  else state = "idle"

  const details: (string | undefined)[] = [
    current > 0 || atGate ? plural(companies.length, "company", "companies") : undefined,
    current > 1 || reviewed > 0 ? `${verified} verified` : undefined,
    drafts.length > 0 ? plural(drafts.length, "draft", "drafts") : undefined,
    counts.approved + counts.sent > 0 ? `${counts.approved + counts.sent} approved` : undefined,
    counts.sent > 0 ? `${counts.sent} sent` : undefined,
  ]

  const stage = CAMPAIGN_STAGES[current]
  let status: string
  switch (state) {
    case "failed":
      status = campaignFailureText(campaign.failureReason, stage.label)
      break
    case "paused":
      status = isCreditsPause(campaign.failureReason)
        ? CREDITS_PAUSED
        : "Sending is paused for this campaign. Contact support to resume it."
      break
    case "stalled":
      status = `No progress for ${plainDuration(stalledForMs ?? 0)}. Restart this step to try again.`
      break
    case "no-results":
      status = noResultsReason ?? ""
      break
    case "done":
      status = counts.sent > 0 ? `Done. ${plural(counts.sent, "email was", "emails were")} sent.` : "Done."
      break
    case "idle":
      status = atGate
        ? "Choose which companies to contact. Nothing more happens until you confirm."
        : atReview
          ? counts.pending > 0
            ? `${plural(counts.pending, "email is", "emails are")} waiting for your review. Nothing is sent until you approve it.`
            : counts.approved > 0
              ? `${plural(counts.approved, "approved email is", "approved emails are")} ready to send.`
              : "Every draft has been reviewed."
          : "Waiting to start."
      break
    default:
      status = RUNNING_TEXT[stage.id] ?? "Working on this step."
  }

  const badge: CampaignProcess["badge"] =
    state === "failed"
      ? { label: "Failed", tone: "danger" }
      : state === "stalled"
        ? { label: "Stalled", tone: "warning" }
        : state === "done"
          ? { label: "Done", tone: "success" }
          : state === "paused"
            ? { label: "Paused", tone: "neutral" }
            : state === "no-results"
              ? { label: "No results", tone: "neutral" }
              : state === "idle"
                ? { label: "Needs your review", tone: "warning" }
                : { label: "Running", tone: "neutral" }

  let progress: CampaignProcess["progress"] = null
  if (current === 1 && (state === "running" || state === "stalled"))
    progress = {
      label:
        reviewed === 0
          ? "Starting to check people"
          : verified === 0
            ? `Checked ${plural(reviewed, "person", "people")}, none verified yet`
            : `${verified} verified out of ${plural(reviewed, "person", "people")} checked`,
    }
  else if (atReview && drafts.length > 0)
    progress = {
      value: drafts.length - counts.pending,
      max: drafts.length,
      label: `${drafts.length - counts.pending} of ${plural(drafts.length, "email", "emails")} reviewed`,
    }
  else if (current === 4 && counts.sent + counts.approved > 0)
    progress = {
      value: counts.sent,
      max: counts.sent + counts.approved,
      label: `${counts.sent} of ${counts.sent + counts.approved} sent`,
    }
  else if (state === "running" || state === "stalled") progress = { label: "Working on this step" }

  const announcement =
    state === "done"
      ? "Campaign finished"
      : state === "running"
        ? `${stage.label} in progress`
        : `${stage.label}: ${badge.label.toLowerCase()}`

  const activity: ProcessActivityItem[] = []
  if (companies.length > 0) activity.push({ id: `companies-${companies.length}`, text: `Found ${plural(companies.length, "company", "companies")}` })
  const chosen = companies.filter((c) => c.selectionStatus === "selected").length
  if (data.usesCompanyDatabase && chosen > 0 && current > 0)
    activity.push({ id: `chosen-${chosen}`, text: `You chose ${plural(chosen, "company", "companies")} to contact` })
  if (reviewed > 0)
    activity.push({
      id: `checked-${reviewed}-${verified}`,
      text: verified === 0
        ? `Checked ${plural(reviewed, "person", "people")}, none verified yet`
        : `Checked ${plural(reviewed, "person", "people")}, ${verified} verified`,
    })
  if (drafts.length > 0) activity.push({ id: `drafts-${drafts.length}`, text: `Wrote ${plural(drafts.length, "email draft", "email drafts")}` })
  for (const d of [...drafts].filter((d) => d.sentAt).sort((a, b) => String(a.sentAt).localeCompare(String(b.sentAt))))
    activity.push({ id: `sent-${d.id}`, text: `Sent to ${d.contact.name} at ${d.company.name}`, at: d.sentAt })
  if (bounced > 0) activity.push({ id: `bounced-${bounced}`, text: `${plural(bounced, "address", "addresses")} bounced` })

  return { state, current, details, status, badge, progress, announcement, activity, noResultsReason }
}
