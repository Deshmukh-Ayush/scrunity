"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  Mail,
  Search,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Inbox,
  VolumeX,
  Building2,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  User,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MailboxThread, MailboxMessage } from "@/app/api/gtm/mailbox/threads/route";

interface ConnectedMailboxInfo {
  id: string;
  email: string;
  status: string;
  dailySendCount?: number;
}

export function MailboxClient() {
  const [activeTab, setActiveTab] = React.useState<"conversations" | "settings">("conversations");
  const [threads, setThreads] = React.useState<MailboxThread[]>([]);
  const [mailbox, setMailbox] = React.useState<ConnectedMailboxInfo | null>(null);
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [intentFilter, setIntentFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [isMuted, setIsMuted] = React.useState(false);

  // Load threads
  const loadThreads = React.useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (intentFilter !== "all") params.set("intent", intentFilter);

      const res = await fetch(`/api/gtm/mailbox/threads?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load threads");
      const data = await res.json();

      setThreads(data.threads || []);
      setMailbox(data.mailbox || null);

      // Select first thread if none selected
      if (!selectedThreadId && data.threads?.length > 0) {
        setSelectedThreadId(data.threads[0].id);
      }
    } catch (err) {
      console.error("[MailboxClient] Load error:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, intentFilter, selectedThreadId]);

  React.useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Active selected thread
  const selectedThread = React.useMemo(() => {
    if (!threads.length) return null;
    return threads.find((t) => t.id === selectedThreadId) || threads[0];
  }, [threads, selectedThreadId]);

  // Relative time helper
  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < 1) {
        return format(d, "h:mm a");
      }
      if (diffDays < 7) {
        return format(d, "EEE");
      }
      return format(d, "MMM d");
    } catch {
      return dateStr;
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return dateStr;
    }
  };

  // Render intent badge with design system tokens
  const renderIntentBadge = (intent: MailboxThread["classifiedIntent"]) => {
    if (!intent) return null;

    switch (intent) {
      case "interested":
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-medium border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1 shrink-0"
          >
            <span className="size-1 rounded-full bg-emerald-500" />
            Interested
          </Badge>
        );
      case "question":
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-medium border-tertiary/40 text-tertiary bg-tertiary/10 gap-1 shrink-0"
          >
            <span className="size-1 rounded-full bg-tertiary" />
            Question
          </Badge>
        );
      case "not_interested":
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-medium border-border text-muted-foreground bg-muted/40 gap-1 shrink-0"
          >
            <span className="size-1 rounded-full bg-muted-foreground" />
            Not Interested
          </Badge>
        );
      case "auto_reply":
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-medium border-border text-muted-foreground bg-muted/30 gap-1 shrink-0"
          >
            Auto Reply
          </Badge>
        );
      case "unclear":
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-medium border-border text-muted-foreground bg-muted/20 shrink-0"
          >
            Unclear
          </Badge>
        );
    }
  };

  const unreadCount = threads.filter((t) => t.isUnread).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground">
      {/* ─── Top Bar / Navigation ─── */}
      <div className="border-b border-border/70 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Mail className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-foreground">Mailbox</h1>
              {unreadCount > 0 && (
                <Badge className="bg-tertiary text-white text-[10px] px-1.5 py-0 font-medium">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Sent outreach threads & classified prospect responses across all campaigns
            </p>
          </div>
        </div>

        {/* Tab switch & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center rounded-md border border-border/80 p-0.5 bg-muted/40">
            <button
              onClick={() => setActiveTab("conversations")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-all",
                activeTab === "conversations"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Conversations ({threads.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded transition-all",
                activeTab === "settings"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mailbox Settings
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadThreads(true)}
            disabled={isRefreshing}
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin text-primary")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      {activeTab === "settings" ? (
        /* Mailbox Settings Screen */
        <div className="p-6 max-w-3xl mx-auto space-y-6 w-full">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Connected Sending Mailbox</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Google Workspace or Gmail account used for throttled stage 7 cold outreach dispatch and stage 8 reply polling.
                </p>
              </div>

              {mailbox && mailbox.status === "connected" ? (
                <div className="rounded-lg border border-border/80 p-4 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                          <span>{mailbox.email}</span>
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px]">
                            Connected
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Provider: Gmail OAuth 2.0 (send & readonly permissions)
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (confirm("Disconnect this mailbox? Outgoing email sends will pause until reconnected.")) {
                          await fetch("/api/gtm/mailbox", { method: "DELETE" });
                          await loadThreads();
                        }
                      }}
                      className="text-xs h-7"
                    >
                      Disconnect Mailbox
                    </Button>
                  </div>

                  <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Daily Dispatch Throttling</span>
                      <span className="font-medium text-foreground text-xs mt-0.5 block">50 emails/day cap</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Reply Classification</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 text-xs mt-0.5 block">
                        Autonomous Stage 8 Polling Active
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                        No Active Gmail Account Connected
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Connect an outbound mailbox to send approved outreach drafts and automatically capture inbound prospective replies.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/gtm/mailbox/connect"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
                  >
                    <Mail className="size-3.5" />
                    Connect Google Workspace Account
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* ─── TWO-PANE CONVERSATIONS VIEW ─── */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ─── MIDDLE PANE: THREAD LIST ─── */}
          <div className="w-full sm:w-80 md:w-96 border-r border-border/70 flex flex-col min-h-0 bg-card/40">
            {/* Search & Filter Header */}
            <div className="p-3 border-b border-border/70 space-y-2.5 bg-background/50">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts, subjects..."
                  className="h-8 pl-8 text-xs bg-muted/40 border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 hide-scrollbar text-[11px]">
                {[
                  { id: "all", label: "All" },
                  { id: "unread", label: "Unread" },
                  { id: "interested", label: "Interested" },
                  { id: "question", label: "Questions" },
                  { id: "not_interested", label: "Not Interested" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setIntentFilter(f.id)}
                    className={cn(
                      "px-2 py-0.5 rounded-full font-medium whitespace-nowrap transition-colors",
                      intentFilter === f.id
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Thread Rows Container */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {isLoading ? (
                <div className="p-6 text-center space-y-2">
                  <RefreshCw className="size-4 animate-spin text-primary mx-auto" />
                  <p className="text-xs text-muted-foreground">Loading mailbox threads...</p>
                </div>
              ) : threads.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <div className="size-10 rounded-full bg-muted/50 border border-border/60 flex items-center justify-center mx-auto text-muted-foreground">
                    <Inbox className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">No conversations found</p>
                    <p className="text-[11px] text-muted-foreground">
                      {searchQuery
                        ? "No threads match your search query."
                        : "Approved emails sent through campaigns will appear here once dispatched."}
                    </p>
                  </div>
                </div>
              ) : (
                threads.map((thread) => {
                  const isSelected = selectedThread?.id === thread.id;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={cn(
                        "p-3.5 cursor-pointer transition-colors relative flex flex-col gap-1.5 select-none",
                        isSelected
                          ? "bg-primary-8 dark:bg-primary-16 border-l-2 border-l-primary"
                          : "hover:bg-muted/40"
                      )}
                    >
                      {/* Row 1: Sender + Timestamp */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {thread.isUnread && (
                            <span className="size-2 rounded-full bg-tertiary shrink-0" title="Unread response" />
                          )}
                          <span
                            className={cn(
                              "text-xs truncate",
                              thread.isUnread || isSelected ? "font-semibold text-foreground" : "font-medium text-foreground"
                            )}
                          >
                            {thread.contact.name}
                          </span>
                          {thread.company.name && (
                            <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                              • {thread.company.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 font-mono">
                          {formatTimestamp(thread.lastActivityAt)}
                        </span>
                      </div>

                      {/* Row 2: Subject */}
                      <div className="text-xs font-medium text-foreground/90 truncate">
                        {thread.subject}
                      </div>

                      {/* Row 3: 2-line preview snippet */}
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {thread.latestSnippet}
                      </p>

                      {/* Row 4: Signal Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 border-border/80 text-muted-foreground truncate max-w-[140px]"
                        >
                          {thread.campaign.name}
                        </Badge>
                        {renderIntentBadge(thread.classifiedIntent)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ─── RIGHT PANE: DETAIL VIEW ─── */}
          <div className="hidden sm:flex flex-1 flex-col min-h-0 bg-background overflow-hidden">
            {selectedThread ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Detail Header */}
                <div className="p-4 border-b border-border/70 flex items-start justify-between gap-4 bg-card/30">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
                        {selectedThread.subject}
                      </h2>
                      {renderIntentBadge(selectedThread.classifiedIntent)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1 text-foreground font-medium">
                        <User className="size-3.5 text-muted-foreground" />
                        <span>{selectedThread.contact.name}</span>
                        {selectedThread.contact.title && (
                          <span className="text-muted-foreground font-normal">({selectedThread.contact.title})</span>
                        )}
                      </div>
                      {selectedThread.company.name && (
                        <div className="flex items-center gap-1">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span>{selectedThread.company.name}</span>
                        </div>
                      )}
                      <Link
                        href={`/dashboard/campaigns/${selectedThread.campaign.id}`}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        <span>Campaign: {selectedThread.campaign.name}</span>
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </div>

                  {/* Contact info pill */}
                  <div className="shrink-0 text-right">
                    <span className="text-[11px] font-mono text-muted-foreground block">
                      {selectedThread.contact.email || "No email"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 block mt-0.5">
                      First sent: {formatTimestamp(selectedThread.sentAt)}
                    </span>
                  </div>
                </div>

                {/* Messages Timeline (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {selectedThread.messages.map((msg, index) => {
                    const isOutbound = msg.isOutbound;
                    return (
                      <div
                        key={msg.id || index}
                        className={cn(
                          "rounded-xl border p-4.5 space-y-3 shadow-2xs transition-all",
                          isOutbound
                            ? "bg-card border-border/80"
                            : "bg-tertiary-4 dark:bg-tertiary-8 border-tertiary/20"
                        )}
                      >
                        {/* Message Header */}
                        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-border/50">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={cn(
                                "size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                                isOutbound
                                  ? "bg-primary/10 text-primary border border-primary/20"
                                  : "bg-tertiary/10 text-tertiary border border-tertiary/30"
                              )}
                            >
                              {msg.fromName.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-foreground">
                                  {msg.fromName}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] px-1 py-0 font-medium",
                                    isOutbound
                                      ? "border-primary/30 text-primary bg-primary/5"
                                      : "border-tertiary/30 text-tertiary bg-tertiary/5"
                                  )}
                                >
                                  {isOutbound ? "Outbound Sent Email" : "Prospect Inbound Reply"}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                from: {msg.from} • to: {msg.to}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {formatFullDate(msg.timestamp)}
                            </span>
                          </div>
                        </div>

                        {/* Message Body */}
                        <div className="text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans space-y-2">
                          {msg.body}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ─── REPLY COMPOSER (Bottom) ─── */}
                <div className="p-4 border-t border-border/70 bg-card/50 space-y-3">
                  <div className="relative">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder={`Write a reply to ${selectedThread.contact.name}...`}
                      className="w-full text-xs p-3 rounded-lg border border-border/80 bg-background focus:outline-hidden focus:ring-1 focus:ring-primary leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    {/* Mute toggle */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                          isMuted
                            ? "bg-muted text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <VolumeX className="size-3.5" />
                        <span>{isMuted ? "Thread Muted" : "Mute Thread"}</span>
                      </button>

                      <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground/80 pl-2">
                        <Info className="size-3" />
                        <span>Sending is throttled via stage 7 Gmail pipeline</span>
                      </div>
                    </div>

                    {/* Send Button — Honestly Disabled */}
                    <div className="flex items-center gap-2">
                      <Button
                        disabled
                        variant="default"
                        size="sm"
                        className="text-xs gap-1.5 opacity-60 cursor-not-allowed bg-primary text-white"
                        title="Direct manual response sending routes through background Stage 7 dispatch queue"
                      >
                        <Send className="size-3.5" />
                        <span>Send Reply (Automated Queue)</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                <Mail className="size-8 stroke-[1.5] text-muted-foreground/40" />
                <p className="text-xs font-medium text-foreground">No conversation selected</p>
                <p className="text-[11px] max-w-xs">
                  Select a thread from the list on the left to read full message details and prospect replies.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
