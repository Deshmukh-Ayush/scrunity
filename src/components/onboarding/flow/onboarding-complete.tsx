import Link from "next/link"
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Onboarding final step: summary and next steps (demo flow, nothing was launched). */
export function OnboardingComplete({
  segmentCount,
  onRestart,
}: {
  segmentCount: number
  onRestart: () => void
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-8 text-center">
      <div className="flex justify-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-7" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Campaigns Launched!
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          You selected {segmentCount} target segment(s). The autonomous pipeline
          is now finding candidate prospect companies, mapping decision-makers,
          and drafting cold emails.
        </p>
      </div>

      <Card className="border-dashed text-left">
        <CardContent className="space-y-2 p-4 text-xs">
          <span className="font-semibold text-foreground">
            Autonomous Next Steps:
          </span>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>
              Stage 4: Find prospect companies matching selected segment
              criteria
            </li>
            <li>
              Stage 5: Identify decision-makers via website scraping & LinkedIn
              pattern matching
            </li>
            <li>
              Stage 6: Draft personalized emails and place in approval queue
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "default" }),
            "w-full gap-2 sm:w-auto"
          )}
        >
          Go to Dashboard
          <ArrowRight className="size-4" />
        </Link>
        <Button
          variant="outline"
          onClick={onRestart}
          className="w-full gap-2 sm:w-auto"
        >
          <RotateCcw className="size-4" />
          Test Onboarding Again
        </Button>
      </div>
    </div>
  )
}
