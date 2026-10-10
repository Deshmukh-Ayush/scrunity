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
  ExternalLink,
  Building2,
  BadgeCheck,
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

interface ToolMeta {
  inProgressLabel: string;
  completedLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOOL_META_MAP: Record<string, ToolMeta> = {
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
  const [showRawJson, setShowRawJson] = useState(false);

  const { state, output, errorText } = toolPart;
  const meta: ToolMeta = TOOL_META_MAP[toolPart.type] || {
    inProgressLabel: `Running ${toolPart.type}…`,
    completedLabel: toolPart.type,
    icon: Target,
  };
  const Icon = meta.icon;

  // 1. Shimmering / Pulsing In-Progress State (Claude style)
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

  // Helper summary tag for completed state
  const getSummaryBadge = () => {
    if (state === "output-error") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] h-4.5 px-1.5 border-destructive/30 bg-destructive/10 text-destructive gap-1"
        >
          <AlertCircle className="size-2.5" />
          Failed
        </Badge>
      );
    }

    if (toolPart.type === "getCampaignOverview") {
      const camps = (output as any)?.campaigns;
      const count = (output as any)?.count ?? (Array.isArray(camps) ? camps.length : 0);
      return (
        <Badge
          variant="outline"
          className="text-[10px] h-4.5 px-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          {count > 0 ? `${count} campaigns found` : "No active campaigns"}
        </Badge>
      );
    }

    if (toolPart.type === "searchProspectsAndContacts") {
      const results = (output as any)?.results;
      const count = (output as any)?.count ?? (Array.isArray(results) ? results.length : 0);
      return (
        <Badge
          variant="outline"
          className="text-[10px] h-4.5 px-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          {count > 0 ? `${count} companies found` : "0 prospects found"}
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="text-[10px] h-4.5 px-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
      >
        <CheckCircle2 className="size-2.5" />
        Completed
      </Badge>
    );
  };

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

            {getSummaryBadge()}
          </div>

          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="p-3 space-y-3 bg-muted/10">
          {/* Error View */}
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

          {/* Formatted Output for getCampaignOverview */}
          {state === "output-available" && toolPart.type === "getCampaignOverview" && (
            <CampaignOverviewRenderer output={output} />
          )}

          {/* Formatted Output for searchProspectsAndContacts */}
          {state === "output-available" &&
            toolPart.type === "searchProspectsAndContacts" && (
              <ProspectsRenderer output={output} />
            )}

          {/* Formatted Output for other tools */}
          {state === "output-available" &&
            toolPart.type !== "getCampaignOverview" &&
            toolPart.type !== "searchProspectsAndContacts" && (
              <GenericOutputRenderer output={output} />
            )}

          {/* Collapsible Raw Technical Data */}
          {output && (
            <div className="pt-1 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors font-mono flex items-center gap-1"
              >
                <span>{showRawJson ? "Hide technical JSON" : "View technical JSON"}</span>
                <ChevronDown className={cn("size-2.5 transition-transform", showRawJson && "rotate-180")} />
              </button>

              {showRawJson && (
                <div className="mt-1.5 p-2 rounded-lg bg-muted/50 border border-border/40 font-mono text-[10px] text-muted-foreground overflow-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                  {JSON.stringify(output, null, 2)}
                </div>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function CampaignOverviewRenderer({ output }: { output?: Record<string, unknown> }) {
  const campaigns = (output as any)?.campaigns as any[] | undefined;

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="py-2 px-3 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground text-center">
        No active outreach campaigns found in this workspace.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {campaigns.map((camp: any) => (
        <div
          key={camp.id}
          className="p-2.5 rounded-lg border border-border/60 bg-background/80 space-y-1.5 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-foreground text-xs truncate">
                {camp.companyName}
              </span>
              <span className="text-[10px] text-muted-foreground/60">·</span>
              <span className="text-[11px] text-muted-foreground truncate">
                {camp.segmentName}
              </span>
            </div>

            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 capitalize font-mono shrink-0",
                camp.status === "in_progress"
                  ? "border-tertiary/30 bg-tertiary/10 text-tertiary"
                  : camp.status === "done"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border text-muted-foreground"
              )}
            >
              {camp.status.replace(/_/g, " ")}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
            <span className="font-mono text-[10px] bg-muted/70 px-1.5 py-0.5 rounded">
              Stage: {camp.currentStage?.replace(/_/g, " ")}
            </span>
            <span>👥 {camp.prospectCount ?? 0} prospects</span>
            <span>✉️ {camp.draftCount ?? 0} drafts</span>
            {camp.pendingDrafts > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ {camp.pendingDrafts} review needed
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProspectsRenderer({ output }: { output?: Record<string, unknown> }) {
  const results = (output as any)?.results as any[] | undefined;

  if (!results || results.length === 0) {
    return (
      <div className="py-2 px-3 rounded-lg bg-muted/30 border border-border/40 text-xs text-muted-foreground text-center">
        No matching prospect companies or decision-makers found.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((comp: any) => (
        <div
          key={comp.companyId || comp.companyName}
          className="p-2.5 rounded-lg border border-border/60 bg-background/80 space-y-2 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 className="size-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground text-xs truncate">
                {comp.companyName}
              </span>
              {comp.domain && (
                <span className="text-[10px] text-muted-foreground/70 font-mono truncate">
                  ({comp.domain})
                </span>
              )}
            </div>
          </div>

          {comp.contacts && comp.contacts.length > 0 ? (
            <div className="space-y-1 pt-1 border-t border-border/40">
              {comp.contacts.map((contact: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px] py-0.5"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-foreground truncate">
                      {contact.name}
                    </span>
                    <span className="text-muted-foreground text-[10px] truncate">
                      ({contact.title})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] text-muted-foreground/80">
                      {contact.email}
                    </span>
                    {contact.verified ? (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-0.5"
                      >
                        <BadgeCheck className="size-2.5" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      >
                        Guessed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              No individual decision-maker contacts scraped yet.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function GenericOutputRenderer({ output }: { output?: Record<string, unknown> }) {
  if (!output || Object.keys(output).length === 0) {
    return (
      <div className="text-xs text-muted-foreground">Action completed.</div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      {Object.entries(output).map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          return null; // Let raw json viewer show deep trees
        }
        return (
          <div
            key={key}
            className="p-2 rounded-lg bg-background/60 border border-border/40 flex flex-col"
          >
            <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider">
              {key.replace(/([A-Z])/g, " $1")}
            </span>
            <span className="font-medium text-foreground mt-0.5 truncate">
              {String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
