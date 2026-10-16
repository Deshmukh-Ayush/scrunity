"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Clock, Loader2, Minus } from "@/components/ui/icons"
import {
  AlertTriangleSolid,
  CheckCircleSolid,
  InfoCircleSolid,
  XCircleSolid,
} from "@/components/icons/status"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"
import {
  isMoving,
  stageStatuses,
  type ProcessState,
  type StageStatus,
} from "./process-state"

/**
 * A self-contained card for a multi-stage process: header (title, count pill,
 * timer), a meta row, a track of N stage tiles, a progress track, an optional
 * activity log, one status sentence and a control cluster.
 *
 * Every visual comes from one ProcessState (process-state.ts). Motion is CSS
 * (process-card.css): it plays only while running, only on change (never on
 * first paint), and not at all under prefers-reduced-motion or motion="reduce".
 * Stage changes and completion are announced politely through `announcement`;
 * activity lines are never announced.
 */

interface ProcessCardContextValue {
  state: ProcessState
}

const ProcessCardContext = React.createContext<ProcessCardContextValue | null>(null)

export function useProcessCard() {
  const ctx = React.useContext(ProcessCardContext)
  if (!ctx) throw new Error("ProcessCard parts must be inside <ProcessCard>")
  return ctx
}

/** "4:05" or "1:02:05", from milliseconds. */
function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

/** Elapsed time since `startedAt`, ticking each second while `ticking`. Null before hydration. */
function useElapsed(startedAt: string | null | undefined, ticking: boolean) {
  const hydrated = useHydrated()
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])
  if (!hydrated || !startedAt) return null
  return formatElapsed(Math.max(now, Date.now()) - new Date(startedAt).getTime())
}

/**
 * Updates a polite live region when `message` changes, at most once every
 * `minGapMs`, so a quick run of stage changes is read once, as the latest.
 */
function useThrottledAnnouncement(message: string | undefined, minGapMs = 3000) {
  const [spoken, setSpoken] = React.useState("")
  const last = React.useRef(0)
  const first = React.useRef(true)
  React.useEffect(() => {
    // The first value is the page's starting state, not a change: never read it.
    if (first.current) {
      first.current = false
      return
    }
    if (!message) return
    const wait = Math.max(0, last.current + minGapMs - Date.now())
    const id = setTimeout(() => {
      last.current = Date.now()
      setSpoken(message)
    }, wait)
    return () => clearTimeout(id)
  }, [message, minGapMs])
  return spoken
}

export function ProcessCard({
  state,
  title,
  leading,
  pill,
  meta,
  startedAt,
  announcement,
  motion = "auto",
  className,
  children,
}: {
  state: ProcessState
  title: string
  /** A 32px tile before the title: a real logo or a letter tile. */
  leading?: React.ReactNode
  /** Short count, e.g. "Step 2 of 3" or "3 of 10 verified". */
  pill?: string
  meta?: React.ReactNode
  /** When the current run started; shows a ticking timer while running (a stall is described in the footer instead). */
  startedAt?: string | null
  /** Plain sentence read politely on stage changes and completion only. */
  announcement?: string
  /** "reduce" turns all motion off, like prefers-reduced-motion (testing route). */
  motion?: "auto" | "reduce"
  className?: string
  children?: React.ReactNode
}) {
  const titleId = React.useId()
  const elapsed = useElapsed(state === "running" ? startedAt : null, state === "running")
  const spoken = useThrottledAnnouncement(announcement)

  return (
    <ProcessCardContext.Provider value={{ state }}>
      <section
        aria-labelledby={titleId}
        data-slot="process-card"
        data-state={state}
        data-motion={motion}
        className={cn(
          "pc flex flex-col gap-5 rounded-xl border border-transparent bg-surface p-4 shadow-surface sm:p-5",
          className
        )}
      >
        <header className="flex items-start gap-3">
          {leading}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h2 id={titleId} className="min-w-0 text-section font-semibold text-fg-strong">
                {title}
              </h2>
              {pill && (
                <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 text-meta text-fg-default tabular-nums">
                  {pill}
                </span>
              )}
            </div>
            {meta && <div className="min-w-0 text-body text-fg-muted">{meta}</div>}
          </div>
          {elapsed && (
            <span
              className="shrink-0 pt-0.5 text-meta text-fg-muted tabular-nums"
              title="Time since this started"
            >
              <span className="sr-only">Running for </span>
              {elapsed}
            </span>
          )}
        </header>
        {children}
        <p aria-live="polite" className="sr-only">
          {spoken}
        </p>
      </section>
    </ProcessCardContext.Provider>
  )
}

export interface ProcessStage {
  id: string
  label: string
  icon: React.ReactNode
  /** A short real fact under the label, e.g. "12 found". */
  detail?: string
  /** Makes the tile a link. Only for a real destination. */
  href?: string
  /** Makes the tile a toggle button (e.g. shows that stage's detail below). */
  onSelect?: () => void
  selected?: boolean
  /** id of the region the tile's button shows. */
  controls?: string
  /** Testing route only: force hover or focus on an interactive tile. */
  force?: "hover" | "focus-visible"
}

const STATUS_WORDS: Record<StageStatus, string> = {
  idle: "not started",
  active: "in progress",
  done: "done",
  stalled: "stalled",
  failed: "failed",
  empty: "ended with no results",
  paused: "paused",
}

function TileGlyph({ status, icon }: { status: StageStatus; icon: React.ReactNode }) {
  switch (status) {
    case "stalled":
      return <AlertTriangleSolid className="size-4" />
    case "failed":
      return <XCircleSolid className="size-4" />
    case "empty":
      return <Minus className="size-4" />
    case "paused":
      return <Clock className="size-4" />
    default:
      return <>{icon}</>
  }
}

/**
 * Remembers which stages changed status after the first paint, so only those
 * play their enter animation. useLayoutEffect sets it before paint: no flash.
 */
function useChangedStages(keys: string[]) {
  const seen = React.useRef<Set<string> | null>(null)
  const [changed, setChanged] = React.useState<string[]>([])
  const signature = keys.join("|")
  React.useLayoutEffect(() => {
    const current = signature.split("|")
    if (!seen.current) {
      seen.current = new Set(current)
      return
    }
    const fresh = current.filter((k) => !seen.current?.has(k))
    if (fresh.length === 0) return
    fresh.forEach((k) => seen.current?.add(k))
    setChanged((prev) => [...prev, ...fresh])
  }, [signature])
  return changed
}

export function ProcessStages({
  stages,
  current,
  label,
}: {
  stages: ProcessStage[]
  /** 0-based index of the stage the process is on. */
  current: number
  /** Accessible name for the list, e.g. "Research stages". */
  label: string
}) {
  const { state } = useProcessCard()
  const statuses = stageStatuses(stages.length, current, state)
  const changed = useChangedStages(stages.map((s, i) => `${s.id}:${statuses[i]}`))

  return (
    <ol aria-label={label} className="pc-track" style={{ "--pc-count": stages.length } as React.CSSProperties}>
      {stages.map((stage, i) => {
        const status = statuses[i]
        const isCurrent = i === current && state !== "done"
        const tileContent = (
          <>
            <span className="pc-tile" data-status={status} aria-hidden="true">
              <TileGlyph status={status} icon={stage.icon} />
              {status === "done" && (
                <span className="pc-check">
                  <Check className="size-2.5" />
                </span>
              )}
            </span>
            <span className="pc-label">
              <span className="pc-name text-body font-medium">{stage.label}</span>
              {stage.detail && <span className="pc-detail text-meta">{stage.detail}</span>}
              <span className="sr-only">, {STATUS_WORDS[status]}</span>
            </span>
          </>
        )
        const interactiveClass = "pc-hit ui-hover:bg-muted ui-focus:focus-ring"

        return (
          <li
            key={stage.id}
            className="pc-stage"
            data-status={status}
            data-moving={(isCurrent && isMoving(state)) || undefined}
            data-enter={changed.includes(`${stage.id}:${status}`) || undefined}
            data-selected={stage.selected || undefined}
            aria-current={isCurrent ? "step" : undefined}
          >
            {i < stages.length - 1 && (
              <span className="pc-connector" data-filled={status === "done" || undefined} aria-hidden="true" />
            )}
            {stage.href ? (
              <Link href={stage.href} className={interactiveClass} data-force={stage.force}>
                {tileContent}
              </Link>
            ) : stage.onSelect ? (
              <button
                type="button"
                onClick={stage.onSelect}
                aria-pressed={stage.selected ?? false}
                aria-controls={stage.controls}
                className={interactiveClass}
                data-force={stage.force}
              >
                {tileContent}
              </button>
            ) : (
              <div className="pc-hit">{tileContent}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Honest progress. With `value` and `max` it is determinate (role progressbar
 * with aria-valuenow). Without them it is a quiet indeterminate bar that
 * moves only while the process is running.
 */
export function ProcessProgress({
  value,
  max,
  label,
}: {
  value?: number
  max?: number
  /** Visible and accessible text, e.g. "3 of 10 verified" or "Working on it". */
  label: string
}) {
  const { state } = useProcessCard()
  const determinate = value !== undefined && max !== undefined && max > 0
  const ratio = state === "done" ? 1 : determinate ? Math.min(1, Math.max(0, value / max)) : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? max : undefined}
        aria-valuenow={determinate ? value : undefined}
        className="pc-progress"
        data-mode={determinate || state === "done" ? "determinate" : "indeterminate"}
        data-state={state}
      >
        <span className="pc-progress-fill" style={{ "--pc-ratio": ratio } as React.CSSProperties} />
      </div>
      <span className="text-meta text-fg-muted tabular-nums" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}

const FOOTER_ICON: Record<ProcessState, React.ReactNode> = {
  idle: <InfoCircleSolid className="size-4 text-fg-muted" />,
  running: <Loader2 className="size-4 text-fg-default motion-safe:animate-spin" />,
  stalled: <AlertTriangleSolid className="size-4 text-warning" />,
  failed: <XCircleSolid className="size-4 text-danger" />,
  done: <CheckCircleSolid className="size-4 text-success" />,
  "no-results": <InfoCircleSolid className="size-4 text-fg-muted" />,
  paused: <Clock className="size-4 text-fg-default" />,
}

/** One plain sentence about now, with the real controls beside it. */
export function ProcessFooter({
  status,
  children,
}: {
  status: React.ReactNode
  /** Real actions only (Re-run, Restart stage). */
  children?: React.ReactNode
}) {
  const { state } = useProcessCard()
  return (
    <footer className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex min-w-0 items-start gap-2 text-body text-fg-default">
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {FOOTER_ICON[state]}
        </span>
        <span className="min-w-0">{status}</span>
      </p>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </footer>
  )
}
