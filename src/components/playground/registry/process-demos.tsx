"use client"

import * as React from "react"
import { Building2, CheckCircle2, Mail, RotateCcw, Send, Users } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import {
  PROCESS_STATES,
  ProcessActivity,
  ProcessCard,
  ProcessFooter,
  ProcessProgress,
  ProcessStages,
  type ProcessActivityItem,
  type ProcessState,
} from "@/components/ui/process-card"

/** Real stage labels and plain facts, the way the campaign page uses them. */
const STAGES = [
  { id: "find_companies", label: "Find companies", icon: <Building2 className="size-4" /> },
  { id: "find_contacts", label: "Verified contacts", icon: <Users className="size-4" /> },
  { id: "write_emails", label: "Write emails", icon: <Mail className="size-4" /> },
  { id: "awaiting_approval", label: "Your review", icon: <CheckCircle2 className="size-4" /> },
  { id: "send_emails", label: "Sending", icon: <Send className="size-4" /> },
]

const DETAILS = ["12 companies", "3 verified", "3 drafts", "2 approved", "1 sent"]

const ACTIVITY: ProcessActivityItem[] = [
  { id: "a1", text: "Found 12 companies" },
  { id: "a2", text: "You chose 8 companies to contact" },
  { id: "a3", text: "Checked 9 people, 3 verified" },
  { id: "a4", text: "Wrote 3 email drafts" },
]

const FOOTER: Record<ProcessState, string> = {
  idle: "3 emails are waiting for your review. Nothing is sent until you approve it.",
  running: "Finding decision makers at the companies you chose and checking their email addresses.",
  stalled: "No progress for 6 minutes. Restart this step to try again.",
  failed: "This step stopped at its search limit, which protects your credits. Retry to run it again with a fresh limit.",
  done: "Done. 3 emails were sent.",
  "no-results": "Found 0 of 10: no more companies to check. Try widening the region or segment.",
  paused: "Sending is paused because your AI credits ran out. Top up credits in Billing to continue.",
}

const CURRENT: Record<ProcessState, number> = {
  idle: 3,
  running: 1,
  stalled: 1,
  failed: 1,
  done: 4,
  "no-results": 1,
  paused: 4,
}

function DemoCard({
  state,
  current = CURRENT[state],
  motion,
  activity = ACTIVITY.slice(0, current + 1),
}: {
  state: ProcessState
  current?: number
  motion?: "auto" | "reduce"
  activity?: ProcessActivityItem[]
}) {
  const [selected, setSelected] = React.useState(current)
  return (
    <ProcessCard
      state={state}
      title="Campaign progress"
      pill={`Step ${current + 1} of 5`}
      startedAt={state === "running" || state === "stalled" ? new Date(Date.now() - 4 * 60_000).toISOString() : null}
      motion={motion}
    >
      <ProcessStages
        label="Campaign steps"
        current={current}
        stages={STAGES.map((s, i) => ({
          ...s,
          detail: i <= current ? DETAILS[i] : undefined,
          onSelect: () => setSelected(i),
          selected: selected === i,
        }))}
      />
      {state === "running" && <ProcessProgress label="3 verified out of 9 people checked" />}
      {state === "idle" && <ProcessProgress value={1} max={3} label="1 of 3 emails reviewed" />}
      {state === "done" && <ProcessProgress value={3} max={3} label="3 of 3 sent" />}
      <ProcessActivity items={activity} />
      <ProcessFooter status={FOOTER[state]}>
        {(state === "stalled" || state === "failed") && (
          <Button>
            <RotateCcw data-icon="inline-start" />
            {state === "stalled" ? "Restart step" : "Retry campaign"}
          </Button>
        )}
      </ProcessFooter>
    </ProcessCard>
  )
}

/** Every ProcessCard state, plus the 3-stage research card at phone width (vertical track). */
export function ProcessCardStates() {
  const [reduce, setReduce] = React.useState(false)
  const motion = reduce ? "reduce" : "auto"
  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <label className="flex items-center gap-2 text-body text-fg-default">
        <input type="checkbox" checked={reduce} onChange={(e) => setReduce(e.target.checked)} />
        Reduced motion (same as prefers-reduced-motion: reduce)
      </label>
      <LiveDemo motion={motion} />
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        {PROCESS_STATES.map((state) => (
          <div key={state} className="flex min-w-0 flex-col gap-2" data-demo-state={state}>
            <p className="text-meta text-fg-muted">{state}</p>
            <DemoCard state={state} motion={motion} />
          </div>
        ))}
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-meta text-fg-muted">320px wide: the track becomes a vertical list</p>
          <div className="w-[320px] max-w-full">
            <DemoCard state="running" motion={motion} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Steps a card through a real sequence of states, to watch the transitions. */
function LiveDemo({ motion }: { motion: "auto" | "reduce" }) {
  const SEQUENCE: { state: ProcessState; current: number }[] = [
    { state: "running", current: 0 },
    { state: "running", current: 1 },
    { state: "running", current: 2 },
    { state: "idle", current: 3 },
    { state: "running", current: 4 },
    { state: "done", current: 4 },
  ]
  const [step, setStep] = React.useState(0)
  const { state, current } = SEQUENCE[step]
  return (
    <div className="flex flex-col gap-3" data-demo="live">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setStep((s) => Math.min(s + 1, SEQUENCE.length - 1))} disabled={step === SEQUENCE.length - 1}>
          Next state
        </Button>
        <Button variant="ghost" onClick={() => setStep(0)}>
          Reset
        </Button>
        <span className="text-meta text-fg-muted tabular-nums">
          {step + 1} of {SEQUENCE.length}: {state}, stage {current + 1}
        </span>
      </div>
      <DemoCard
        key={motion}
        state={state}
        current={current}
        motion={motion}
        activity={ACTIVITY.slice(0, Math.min(current + 1, ACTIVITY.length))}
      />
    </div>
  )
}
