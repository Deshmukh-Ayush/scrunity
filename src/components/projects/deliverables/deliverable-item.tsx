"use client";

import { Clock, MessageSquare, Zap } from "lucide-react";
import { format, isPast } from "date-fns";
import { AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SealCheckIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { DeliverableActions } from "./deliverable-actions";
import type { DeliverableItem as DeliverableType } from "./types";

import { useState } from "react";
import { ScopeGuardianPill } from "./scope-guardian-pill";
import { AddendumModal } from "../proposal/addendum-modal";
import type { ScopeEvaluation } from "@/lib/ai/schemas";

type DeliverableItemProps = {
  item: DeliverableType;
  index?: number;
  commentCount: number;
  memberRole: string;
  scopeEvaluation?: ScopeEvaluation | null;
  contractId?: string;
};

export function DeliverableItem({
  item,
  commentCount,
  memberRole,
  scopeEvaluation,
  contractId,
}: DeliverableItemProps) {
  const [isAddendumOpen, setIsAddendumOpen] = useState(false);
  const isOverdue = item.dueDate && isPast(new Date(item.dueDate)) && item.status !== "approved";

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "approved":
        return {
          label: "Approved",
          Icon: SealCheckIcon,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        };
      case "in_review":
        return {
          label: "In Review",
          Icon: PaperPlaneTiltIcon,
          color: "text-sky-500",
          bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
        };
      case "revision_requested":
        return {
          label: "Needs Revision",
          Icon: Zap,
          color: "text-rose-500 animate-pulse",
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        };
      default:
        return {
          label: "Pending",
          Icon: Clock,
          color: "text-purple-500",
          bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        };
    }
  };

  const statusConfig = getStatusConfig(item.status);
  const StatusIcon = statusConfig.Icon;

  return (
    <div className="group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 py-2.5 px-3 hover:bg-muted/40 transition-colors rounded-md">
      {/* Left: Status Icon, Title & Badge */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusIcon className={`w-4 h-4 shrink-0 ${statusConfig.color}`} />

        <span className="text-sm font-medium tracking-tight text-foreground truncate max-w-50 sm:max-w-xs text-balance">
          {item.title}
        </span>

        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${statusConfig.bg} shrink-0`}>
          {statusConfig.label}
        </span>

        {/* Scope Guardian Pill */}
        <ScopeGuardianPill
          evaluation={scopeEvaluation || null}
          onDraftAddendum={() => setIsAddendumOpen(true)}
        />
      </div>

      {/* Right: Due Date & Actions */}
      <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0 ml-7 sm:ml-0">
        {/* Due Date */}
        <div className={`text-xs tabular-nums whitespace-nowrap ${isOverdue ? "text-rose-500 font-semibold" : "text-muted-foreground"}`}>
          {item.dueDate
            ? format(new Date(item.dueDate), "dd MMM")
            : "-"}
        </div>

        {/* Actions & Comment Trigger */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <DeliverableActions deliverableId={item.id} status={item.status} role={memberRole} />

          <AccordionItem value={item.id} className="border-none">
            <AccordionTrigger className="p-0 hover:no-underline active:scale-[0.96] transition-transform">
              <div className="flex items-center gap-1 h-7 px-2.5 text-[12px] font-medium rounded-full border border-border/60 bg-background text-foreground hover:bg-muted/60 transition-colors">
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="tabular-nums font-semibold">{commentCount}</span>
              </div>
            </AccordionTrigger>
          </AccordionItem>
        </div>
      </div>

      {/* AI Addendum Modal */}
      {contractId && (
        <AddendumModal
          isOpen={isAddendumOpen}
          contractId={contractId}
          reason={`Deliverable "${item.title}" requested additional revision round exceeding contract limit.`}
          onClose={() => setIsAddendumOpen(false)}
        />
      )}
    </div>
  );
}
