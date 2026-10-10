import * as React from "react";
import { getTenantContext } from "@/lib/tenant-context";
import { getAiCreditBalance } from "@/lib/gtm-ai-credits";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { BuyCreditsModal } from "./billing-modals";
import { Zap, Clock, ShieldCheck, AlertCircle } from "lucide-react";

export async function AiCreditBalanceCard() {
  const { organizationId } = await getTenantContext();
  const balance = await getAiCreditBalance(organizationId);

  const totalPool = Math.max(
    balance.planAllotment,
    balance.creditsUsed + balance.creditsRemaining
  );
  const percentRemaining =
    totalPool > 0
      ? Math.max(0, Math.min(100, Math.round((balance.creditsRemaining / totalPool) * 100)))
      : 0;

  const isLow = balance.creditsRemaining <= 15 && balance.creditsRemaining > 0;
  const isExhausted = balance.creditsRemaining === 0;

  return (
    <Card className="flex flex-col justify-between border-border/70 p-6">
      <div>
        <CardHeader className="p-0 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="h-4 w-4 text-amber-500 fill-amber-400 shrink-0" />
              <CardTitle className="text-base font-semibold break-words">AI Credit Balance</CardTitle>
            </div>
            <div className="shrink-0">
              <BuyCreditsModal />
            </div>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-1 break-words">
            1 credit = 1 prospect carried through stages 4-9 and sent. Stages 1-3 are always free.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-baseline justify-between gap-3 pt-1">
            <div className="min-w-0 flex-1">
              <div className="text-3xl font-extrabold tracking-tight text-foreground break-words">
                {balance.creditsRemaining.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground ml-1.5 whitespace-nowrap">
                  / {totalPool.toLocaleString()} remaining
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 break-words">
                {balance.creditsUsed.toLocaleString()} prospect{balance.creditsUsed === 1 ? "" : "s"} sent this billing cycle
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${
                  isExhausted
                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                    : isLow
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {percentRemaining}% left
              </span>
            </div>
          </div>

          {/* Progress gauge */}
          <div className="space-y-1.5">
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all rounded-full ${
                  isExhausted
                    ? "bg-red-500"
                    : isLow
                    ? "bg-amber-500"
                    : "bg-primary"
                }`}
                style={{ width: `${percentRemaining}%` }}
              />
            </div>
          </div>

          {isExhausted && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="break-words">
                {totalPool === 0
                  ? "No active credits. Subscribe to a plan or purchase top-up credits to send outreach."
                  : "Outreach sends paused: 0 credits remaining. Top up to resume immediately."}
              </span>
            </div>
          )}
        </CardContent>
      </div>

      <div className="mt-5 pt-4 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Resets in {balance.daysRemaining} days (no rollover)</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 shrink-0">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span>Research stages uncapped</span>
        </div>
      </div>
    </Card>
  );
}
