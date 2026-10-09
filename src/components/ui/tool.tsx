"use client";

import * as React from "react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  AlertCircle,
  Target,
  Users,
  Search,
  BarChart3,
  RotateCcw,
  Mail,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ToolPart = {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  toolCallId?: string;
  errorText?: string;
};

export type ToolProps = {
  toolPart: ToolPart;
  defaultOpen?: boolean;
  className?: string;
};

export interface ToolMeta {
  inProgressLabel: string;
  completedLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const TOOL_META_MAP: Record<string, ToolMeta> = {
  getCampaignOverview: {
    inProgressLabel: "Checking campaign status…",
    completedLabel: "Campaign status checked",
    icon: Target,
  },
  searchProspectsAndContacts: {
    inProgressLabel: "Searching prospects & verified contacts…",
    completedLabel: "Prospect search completed",
    icon: Users,
  },
  getMarketIntelligence: {
    inProgressLabel: "Reviewing market intelligence…",
    completedLabel: "Market intelligence reviewed",
    icon: Search,
  },
  getSegmentPerformance: {
    inProgressLabel: "Analyzing segment performance…",
    completedLabel: "Segment performance analyzed",
    icon: BarChart3,
  },
  retriggerResearchPipeline: {
    inProgressLabel: "Restarting research pipeline…",
    completedLabel: "Research pipeline restarted",
    icon: RotateCcw,
  },
  getMailboxStatus: {
    inProgressLabel: "Checking outbound mailbox…",
    completedLabel: "Mailbox connection checked",
    icon: Mail,
  },
};

export function Tool({ toolPart, defaultOpen = false, className }: ToolProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const { state, output, errorText } = toolPart;
  const meta: ToolMeta = TOOL_META_MAP[toolPart.type] || {
    inProgressLabel: `Running ${toolPart.type}…`,
    completedLabel: toolPart.type,
    icon: Target,
  };
  const Icon = meta.icon;

  // Shimmering / Pulsing In-Progress State (Claude style)
  if (state === "input-streaming" || state === "input-available") {
    return (
      <div
        className={cn(
          "w-full rounded-xl border border-primary/20 bg-primary/5 p-2.5 transition-all shadow-2xs",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="size-3.5 animate-pulse text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground tracking-tight animate-pulse truncate">
              {meta.inProgressLabel}
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 animate-pulse shrink-0">
            <Loader2 className="size-2.5 animate-spin" />
            Working…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-background/90 shadow-2xs overflow-hidden transition-all text-xs",
        isOpen && "border-border shadow-xs",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer transition-colors hover:bg-muted/40",
            isOpen && "border-b border-border/50 bg-muted/20"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "size-6 rounded-lg flex items-center justify-center shrink-0",
                state === "output-error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {state === "output-error" ? (
                <AlertCircle className="size-3.5" />
              ) : (
                <Icon className="size-3.5" />
              )}
            </div>

            <span className="font-medium text-foreground truncate text-xs">
              {meta.completedLabel}
            </span>

            <Badge
              variant="outline"
              className="text-[10px] h-4.5 px-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
            >
              <CheckCircle2 className="size-2.5" />
              Completed
            </Badge>
          </div>

          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="p-3 space-y-3 bg-muted/10">
          {state === "output-error" && (
            <div className="p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium">Execution Error</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  {errorText || "The tool call failed to execute."}
                </p>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
