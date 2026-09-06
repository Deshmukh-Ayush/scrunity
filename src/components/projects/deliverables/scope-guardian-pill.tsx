"use client";

import { ShieldCheckIcon, ShieldAlertIcon } from "lucide-react";
import type { ScopeEvaluation } from "@/lib/ai/schemas";
import { ThinkingOrb } from "thinking-orbs";

interface ScopeGuardianPillProps {
  evaluation: ScopeEvaluation | null;
  onDraftAddendum?: () => void;
}

export function ScopeGuardianPill({ evaluation, onDraftAddendum }: ScopeGuardianPillProps) {
  if (!evaluation || evaluation.maxRevisions === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <ShieldCheckIcon className="h-3 w-3 text-muted-foreground/60" />
        <span>No Limits Set</span>
      </span>
    );
  }

  const { status, currentRevision, maxRevisions, isScopeCreep } = evaluation;

  if (isScopeCreep) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
          <ShieldAlertIcon className="h-3 w-3 text-rose-500" />
          <span>Scope Creep Exceeded ({currentRevision}/{maxRevisions})</span>
        </span>

        {onDraftAddendum && (
          <button
            onClick={onDraftAddendum}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#00AAF7] to-[#0284C7] px-3 py-1 text-[10px] font-bold text-white shadow-md transition-transform active:scale-[0.96]"
          >
            <ThinkingOrb state="weaving" size={20} theme="auto" />
            <span>Draft Change Order</span>
          </button>
        )}
      </div>
    );
  }

  if (status === "limit_reached") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <ShieldAlertIcon className="h-3 w-3 text-amber-500" />
        <span>Final Revision ({currentRevision}/{maxRevisions})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
      <ShieldCheckIcon className="h-3 w-3 text-emerald-500" />
      <span>Scope Guard ({currentRevision}/{maxRevisions})</span>
    </span>
  );
}
