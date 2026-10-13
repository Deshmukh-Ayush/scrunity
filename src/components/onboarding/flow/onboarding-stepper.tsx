import { cn } from "@/lib/utils"

export type OnboardingStep =
  | "FORM"
  | "RUNNING"
  | "PROFILE_CONFIRMATION"
  | "SEGMENTS"
  | "COMPLETED"

const STEPS: Array<{
  label: string
  activeOn: OnboardingStep
  doneOn: OnboardingStep[]
}> = [
  { label: "Company Profile", activeOn: "FORM", doneOn: [] },
  {
    label: "Autonomous Research",
    activeOn: "RUNNING",
    doneOn: ["SEGMENTS", "COMPLETED"],
  },
  { label: "ICP Segments", activeOn: "SEGMENTS", doneOn: ["COMPLETED"] },
]

/** Three-step progress header for onboarding. */
export function OnboardingStepper({ step }: { step: OnboardingStep }) {
  return (
    <ol className="flex items-center justify-between border-b pb-4 text-xs font-medium text-muted-foreground">
      {STEPS.map((s, i) => {
        // The first step never dims, matching the original indicator.
        const state =
          step === s.activeOn
            ? "active"
            : i === 0 || s.doneOn.includes(step)
              ? "done"
              : "upcoming"
        return (
          <li key={s.label} className="contents">
            {i > 0 && (
              <div
                aria-hidden="true"
                className="hidden h-px w-8 bg-border sm:block"
              />
            )}
            <div
              className="flex items-center gap-2"
              aria-current={state === "active" ? "step" : undefined}
            >
              <div
                data-state={state}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px]",
                  "data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground",
                  "data-[state=done]:bg-muted data-[state=done]:text-foreground",
                  "data-[state=upcoming]:bg-muted/50 data-[state=upcoming]:text-muted-foreground"
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  state === "active" && "font-semibold text-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
