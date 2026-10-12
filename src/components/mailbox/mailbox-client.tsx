"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  AlertTriangle,
  Inbox,
  VolumeX,
  Building2,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  User,
  Info,
  Server,
  Check,
  Loader2,
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
  provider?: string;
  status: string;
  dailySendCount?: number;
  metadata?: {
    smtp?: { host: string; port: number; secure: boolean; user: string };
    imap?: { host: string; port: number; secure: boolean; user: string };
    microsoftTenantId?: string;
    providerDisplayName?: string;
  };
}

export function MailboxClient() {
  const searchParams = useSearchParams();
  const targetContactId = searchParams?.get("contactId");
  const targetThreadId = searchParams?.get("threadId");
  const tabParam = searchParams?.get("tab");

  const [activeTab, setActiveTab] = React.useState<"conversations" | "settings">(
    () => (tabParam === "settings" ? "settings" : "conversations")
  );

  React.useEffect(() => {
    if (tabParam === "settings") {
      setActiveTab("settings");
    } else if (tabParam === "conversations") {
      setActiveTab("conversations");
    }
  }, [tabParam]);
  const [threads, setThreads] = React.useState<MailboxThread[]>([]);
  const [mailbox, setMailbox] = React.useState<ConnectedMailboxInfo | null>(null);
  const [selectedThreadId, setSelectedThreadId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [intentFilter, setIntentFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [isMuted, setIsMuted] = React.useState(false);

  // URL notification params
  const errorParam = searchParams?.get("error");
  const connectedParam = searchParams?.get("mailbox_connected");

  // IMAP/SMTP Connection State
  const [showImapSmtpForm, setShowImapSmtpForm] = React.useState(false);
  const [imapSmtpData, setImapSmtpData] = React.useState({
    email: "",
    displayName: "",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    sameCredentials: true,
    imapHost: "",
    imapPort: "993",
    imapSecure: true,
    imapUser: "",
    imapPass: "",
  });
  const [isConnectingImapSmtp, setIsConnectingImapSmtp] = React.useState(false);
  const [imapSmtpError, setImapSmtpError] = React.useState<string | null>(null);
  const [imapSmtpSuccess, setImapSmtpSuccess] = React.useState<string | null>(null);

  const handleConnectImapSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnectingImapSmtp(true);
    setImapSmtpError(null);
    setImapSmtpSuccess(null);

    try {
      const payload = {
        email: imapSmtpData.email.trim(),
        displayName: imapSmtpData.displayName.trim() || undefined,
        smtp: {
          host: imapSmtpData.smtpHost.trim(),
          port: parseInt(imapSmtpData.smtpPort, 10),
          secure: Boolean(imapSmtpData.smtpSecure),
          user: (imapSmtpData.smtpUser || imapSmtpData.email).trim(),
          pass: imapSmtpData.smtpPass,
        },
        imap: {
          host: imapSmtpData.imapHost.trim(),
          port: parseInt(imapSmtpData.imapPort, 10),
          secure: Boolean(imapSmtpData.imapSecure),
          user: (imapSmtpData.sameCredentials
            ? imapSmtpData.smtpUser || imapSmtpData.email
            : imapSmtpData.imapUser || imapSmtpData.email).trim(),
          pass: imapSmtpData.sameCredentials
            ? imapSmtpData.smtpPass
            : imapSmtpData.imapPass,
        },
      };

      const res = await fetch("/api/gtm/mailbox/imap-smtp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect mailbox");
      }

      setImapSmtpSuccess("Mailbox connected successfully!");
      setShowImapSmtpForm(false);
      await loadThreads();
    } catch (err: any) {
      setImapSmtpError(err.message || "Failed to connect mailbox");
    } finally {
      setIsConnectingImapSmtp(false);
    }
  };

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

      // Select requested thread/contact or first thread
      setSelectedThreadId((prev) => {
        if (targetContactId) {
          const match = data.threads?.find((t: MailboxThread) => t.contact.id === targetContactId);
          if (match) return match.id;
        }
        if (targetThreadId) {
          const match = data.threads?.find(
            (t: MailboxThread) => t.id === targetThreadId || t.threadId === targetThreadId || t.draftId === targetThreadId
          );
          if (match) return match.id;
        }
        if (prev && data.threads?.some((t: MailboxThread) => t.id === prev)) {
          return prev;
        }
        return data.threads?.[0]?.id || null;
      });
    } catch (err) {
      console.error("[MailboxClient] Load error:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, intentFilter]);

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
            variant="success"
            className="text-[10px] px-2 py-0.5 font-semibold gap-1 shrink-0"
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Interested
          </Badge>
        );
      case "question":
        return (
          <Badge
            variant="tertiary"
            className="text-[10px] px-2 py-0.5 font-semibold gap-1 shrink-0"
          >
            <span className="size-1.5 rounded-full bg-tertiary" />
            Question
          </Badge>
        );
      case "not_interested":
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 font-medium border-border/70 text-muted-foreground bg-muted/40 gap-1 shrink-0"
          >
            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
            Not Interested
          </Badge>
        );
      case "auto_reply":
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 font-medium border-border/70 text-muted-foreground bg-muted/30 gap-1 shrink-0"
          >
            Auto Reply
          </Badge>
        );
      case "unclear":
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-2 py-0.5 font-medium border-border/70 text-muted-foreground bg-muted/20 shrink-0"
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
        <div className="p-6 max-w-4xl mx-auto space-y-6 w-full">
          {/* Status Alerts from URL Callback */}
          {connectedParam && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold">Mailbox Connected Successfully</p>
                <p className="text-muted-foreground">
                  Your sending mailbox is verified. Throttled stage 7 campaign sends and stage 8 autonomous reply triage are now active.
                </p>
              </div>
            </div>
          )}

          {errorParam && (
            <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-3 text-rose-800 dark:text-rose-200">
              <AlertCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold">Mailbox Connection Error</p>
                <p className="text-muted-foreground">
                  {decodeURIComponent(errorParam)}
                </p>
              </div>
            </div>
          )}

          {imapSmtpSuccess && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3 text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold">{imapSmtpSuccess}</p>
                <p className="text-muted-foreground">
                  SMTP outbound transport and IMAP inbox reading are verified and ready.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Connected Sending Mailbox</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Account used for throttled stage 7 cold outreach dispatch and stage 8 autonomous reply triage.
                </p>
              </div>

              {mailbox && mailbox.status === "connected" ? (
                <div className="rounded-xl border border-border/80 p-5 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                          <span>{mailbox.email}</span>
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                            {mailbox.provider === "microsoft"
                              ? "Microsoft 365 / Outlook"
                              : mailbox.provider === "imap_smtp"
                                ? "Generic IMAP / SMTP"
                                : "Google Workspace"}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {mailbox.provider === "microsoft" &&
                            "Connected via Microsoft Graph OAuth 2.0 (Mail.Send, Mail.Read, Mail.ReadWrite)"}
                          {mailbox.provider === "imap_smtp" &&
                            `Connected via Custom SMTP (${mailbox.metadata?.smtp?.host || "configured"}:${mailbox.metadata?.smtp?.port || "587"}) & IMAP (${mailbox.metadata?.imap?.host || "configured"}:${mailbox.metadata?.imap?.port || "993"})`}
                          {(!mailbox.provider || mailbox.provider === "gmail") &&
                            "Connected via Google OAuth 2.0 (gmail.send & gmail.readonly)"}
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
                      className="text-xs h-8 cursor-pointer"
                    >
                      Disconnect Mailbox
                    </Button>
                  </div>

                  <div className="pt-3 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
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
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Today&apos;s Sends</span>
                      <span className="font-medium text-foreground text-xs mt-0.5 block">
                        {mailbox.dailySendCount || 0} / 50 dispatched
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border/80 bg-card/60 p-5 space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">
                      Choose Your Mailbox Connection Provider
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Connect your outbound mailbox to send approved outreach drafts and automatically capture inbound prospective replies. Both OAuth 2.0 and manual IMAP/SMTP configurations are supported.
                    </p>
                  </div>

                  {/* 3 Provider Options */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Option 1: Google */}
                    <div className="rounded-xl border border-border/80 p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all bg-card/40">
                      <div className="space-y-2">
                        <div className="size-9 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-semibold text-sm">
                          G
                        </div>
                        <h5 className="text-xs font-semibold text-foreground">Google Workspace / Gmail</h5>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Connect with OAuth 2.0 using least-privilege Gmail scopes (<code className="text-[10px]">gmail.send</code>, <code className="text-[10px]">gmail.readonly</code>).
                        </p>
                      </div>
                      <a
                        href="/api/gtm/mailbox/connect"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors w-full text-center"
                      >
                        <Mail className="size-3.5" />
                        Connect Google Account
                      </a>
                    </div>

                    {/* Option 2: Microsoft 365 (Coming Soon) */}
                    <div className="rounded-xl border border-border/50 p-5 flex flex-col justify-between space-y-4 bg-muted/20 opacity-80 relative select-none">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="size-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-semibold text-sm border border-border/40">
                            M
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground font-medium border border-border/60"
                          >
                            Coming Soon
                          </Badge>
                        </div>
                        <div>
                          <h5 className="text-xs font-semibold text-foreground/80">Microsoft 365 / Outlook</h5>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                            Microsoft 365 / Outlook support is coming soon — in the meantime, connect via Google or the generic IMAP/SMTP option.
                          </p>
                        </div>
                      </div>
                      <Button
                        disabled
                        variant="outline"
                        className="w-full text-xs h-9 cursor-not-allowed opacity-60 bg-muted/30 text-muted-foreground border-dashed border-border/80"
                      >
                        <Clock className="size-3.5 mr-1" />
                        Coming Soon
                      </Button>
                    </div>

                    {/* Option 3: Custom IMAP / SMTP */}
                    <div className="rounded-xl border border-border/80 p-5 flex flex-col justify-between space-y-4 hover:border-primary/50 transition-all bg-card/40">
                      <div className="space-y-2">
                        <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-semibold text-sm">
                          <Server className="size-4" />
                        </div>
                        <h5 className="text-xs font-semibold text-foreground">Generic IMAP / SMTP</h5>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Connect any custom provider (Zoho, Fastmail, iCloud, Private Email) with credentials encrypted using AES-256-GCM.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowImapSmtpForm(!showImapSmtpForm);
                          setImapSmtpError(null);
                        }}
                        className="text-xs h-9 w-full cursor-pointer border-border/80 hover:bg-muted"
                      >
                        <Server className="size-3.5 mr-1" />
                        {showImapSmtpForm ? "Close Form" : "Configure IMAP / SMTP"}
                      </Button>
                    </div>
                  </div>

                  {/* IMAP / SMTP Manual Form Drawer/Panel */}
                  {showImapSmtpForm && (
                    <form
                      onSubmit={handleConnectImapSmtp}
                      className="rounded-xl border border-border/90 p-6 bg-card/60 space-y-5 animate-in fade-in-50 duration-200"
                    >
                      <div className="flex items-start justify-between border-b border-border/60 pb-3">
                        <div>
                          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Server className="size-3.5 text-primary" />
                            <span>Generic IMAP / SMTP Mailbox Settings</span>
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Both SMTP (sending) and IMAP (reply listening) must be configured so autonomous stages function properly.
                          </p>
                        </div>
                      </div>

                      {/* Guidance banner on App Passwords */}
                      <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                        <Info className="size-4 shrink-0 text-amber-600 mt-0.5" />
                        <div className="space-y-1 text-[11px] leading-relaxed">
                          <p className="font-semibold">App-Specific Passwords Required for 2FA Accounts</p>
                          <p className="text-muted-foreground">
                            If your mail provider (Zoho, iCloud, Fastmail, Yahoo, Google) has Two-Factor Authentication enabled, generate and enter an <strong>App Password</strong> rather than your primary login password.
                          </p>
                        </div>
                      </div>

                      {imapSmtpError && (
                        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                          <AlertTriangle className="size-4 shrink-0 text-rose-600 mt-0.5" />
                          <div className="space-y-0.5 text-[11px]">
                            <p className="font-semibold">Connection Verification Failed</p>
                            <p className="text-muted-foreground">{imapSmtpError}</p>
                          </div>
                        </div>
                      )}

                      {/* General Identity */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-foreground">
                            Mailbox Email Address *
                          </label>
                          <Input
                            type="email"
                            required
                            placeholder="outreach@company.com"
                            value={imapSmtpData.email}
                            onChange={(e) =>
                              setImapSmtpData({ ...imapSmtpData, email: e.target.value })
                            }
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-foreground">
                            Sender Display Name (Optional)
                          </label>
                          <Input
                            placeholder="Sarah Jenkins"
                            value={imapSmtpData.displayName}
                            onChange={(e) =>
                              setImapSmtpData({ ...imapSmtpData, displayName: e.target.value })
                            }
                            className="h-8 text-xs bg-background"
                          />
                        </div>
                      </div>

                      {/* SMTP Section */}
                      <div className="space-y-3 pt-2 border-t border-border/40">
                        <h5 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                          Outbound SMTP Configuration (Stage 7 Dispatch)
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-[11px] font-medium text-foreground">
                              SMTP Host *
                            </label>
                            <Input
                              required
                              placeholder="smtp.zoho.com or mail.privateemail.com"
                              value={imapSmtpData.smtpHost}
                              onChange={(e) =>
                                setImapSmtpData({ ...imapSmtpData, smtpHost: e.target.value })
                              }
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-foreground">
                              SMTP Port *
                            </label>
                            <Input
                              required
                              type="number"
                              placeholder="587"
                              value={imapSmtpData.smtpPort}
                              onChange={(e) =>
                                setImapSmtpData({ ...imapSmtpData, smtpPort: e.target.value })
                              }
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-foreground">
                              SMTP Username *
                            </label>
                            <Input
                              required
                              placeholder="outreach@company.com"
                              value={imapSmtpData.smtpUser}
                              onChange={(e) =>
                                setImapSmtpData({ ...imapSmtpData, smtpUser: e.target.value })
                              }
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-foreground">
                              SMTP Password / App Password *
                            </label>
                            <Input
                              type="password"
                              required
                              placeholder="••••••••••••••••"
                              value={imapSmtpData.smtpPass}
                              onChange={(e) =>
                                setImapSmtpData({ ...imapSmtpData, smtpPass: e.target.value })
                              }
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="smtpSecure"
                            checked={imapSmtpData.smtpSecure}
                            onChange={(e) =>
                              setImapSmtpData({ ...imapSmtpData, smtpSecure: e.target.checked })
                            }
                            className="rounded border-border/80"
                          />
                          <label htmlFor="smtpSecure" className="text-xs text-muted-foreground cursor-pointer">
                            Use SSL/TLS (port 465). Leave unchecked for STARTTLS (port 587).
                          </label>
                        </div>
                      </div>

                      {/* IMAP Section */}
                      <div className="space-y-3 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                            Inbound IMAP Configuration (Stage 8 Reply Triage)
                          </h5>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={imapSmtpData.sameCredentials}
                              onChange={(e) =>
                                setImapSmtpData({
                                  ...imapSmtpData,
                                  sameCredentials: e.target.checked,
                                })
                              }
                              className="rounded border-border/80"
                            />
                            <span>Use same credentials as SMTP</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-[11px] font-medium text-foreground">
                              IMAP Host *
                            </label>
                            <Input
                              required
                              placeholder="imappro.zoho.com or mail.privateemail.com"
                              value={imapSmtpData.imapHost}
                              onChange={(e) =>
                                setImapSmtpData({ ...imapSmtpData, imapHost: e.target.value })
                              }
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-foreground">
                              IMAP Port *
                            </label>
                            <Input
                              required
                              type="number"
                              placeholder="993"
                              value={imapSmtpData.imapPort}
                              onChange={(e) =>
                                setImapSmtpData({ ...imapSmtpData, imapPort: e.target.value })
                              }
                              className="h-8 text-xs bg-background"
                            />
                          </div>
                        </div>

                        {!imapSmtpData.sameCredentials && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-foreground">
                                IMAP Username *
                              </label>
                              <Input
                                required
                                placeholder="outreach@company.com"
                                value={imapSmtpData.imapUser}
                                onChange={(e) =>
                                  setImapSmtpData({ ...imapSmtpData, imapUser: e.target.value })
                                }
                                className="h-8 text-xs bg-background"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-foreground">
                                IMAP Password *
                              </label>
                              <Input
                                type="password"
                                required
                                placeholder="••••••••••••••••"
                                value={imapSmtpData.imapPass}
                                onChange={(e) =>
                                  setImapSmtpData({ ...imapSmtpData, imapPass: e.target.value })
                                }
                                className="h-8 text-xs bg-background"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="imapSecure"
                            checked={imapSmtpData.imapSecure}
                            onChange={(e) =>
                              setImapSmtpData({ ...imapSmtpData, imapSecure: e.target.checked })
                            }
                            className="rounded border-border/80"
                          />
                          <label htmlFor="imapSecure" className="text-xs text-muted-foreground cursor-pointer">
                            Use SSL/TLS for IMAP (port 993, recommended).
                          </label>
                        </div>
                      </div>

                      {/* Submit Actions */}
                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowImapSmtpForm(false)}
                          className="text-xs h-8"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isConnectingImapSmtp}
                          className="text-xs h-8 gap-1.5 bg-primary text-white cursor-pointer"
                        >
                          {isConnectingImapSmtp ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Verifying & Saving...</span>
                            </>
                          ) : (
                            <>
                              <Check className="size-3.5" />
                              <span>Test & Save Mailbox</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
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
                  { id: "bounced", label: "Bounced" },
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
                          ? "bg-primary/10 dark:bg-primary/15 border-l-2 border-l-primary shadow-2xs"
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
                        {thread.isBounced && (
                          <Badge
                            variant="destructive"
                            className="text-[9px] px-1.5 py-0 bg-rose-500/10 text-rose-600 border-rose-500/30 gap-1 font-medium"
                          >
                            <AlertTriangle className="size-2.5" />
                            Bounced
                          </Badge>
                        )}
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
                      {selectedThread.isBounced && (
                        <Badge
                          variant="destructive"
                          className="text-[11px] bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1 font-semibold"
                        >
                          <AlertTriangle className="size-3" /> Delivery Bounced
                        </Badge>
                      )}
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

                {/* Bounced alert banner if thread failed */}
                {selectedThread.isBounced && (
                  <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                    <AlertCircle className="size-4 shrink-0 text-rose-500 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold">Email Delivery Failed (Bounced)</p>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedThread.bounceReason || "Recipient address not found (550). This contact requires re-discovery before outreach can resume."}
                      </p>
                    </div>
                  </div>
                )}

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
                            : "bg-tertiary/5 dark:bg-tertiary/10 border-tertiary/30"
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
