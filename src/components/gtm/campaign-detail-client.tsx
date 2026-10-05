"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Send,
  Check,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  title: string;
  email: string | null;
  emailSource: string;
  linkedinUrl: string | null;
}

interface Company {
  id: string;
  name: string;
  domain: string;
  location: string;
  description: string;
}

interface Draft {
  id: string;
  subject: string;
  body: string;
  status: "draft" | "approved" | "rejected" | "sent" | "failed";
  providerMessageId?: string | null;
  sentAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  contact: Contact;
  company: Company;
}

interface CampaignData {
  campaign: {
    id: string;
    status: string;
    currentStage: string;
    createdAt: string;
  };
  segment: {
    id: string;
    name: string;
    painPoint: string;
  };
  researchRun: {
    id: string;
    companyName: string;
    websiteUrl: string;
  };
  companies: Company[];
  contacts: Contact[];
  snapshots: Array<{
    prospectCompanyId: string;
    employeeCountLabel: string | null;
    linkedinFollowerCount: number | null;
  }>;
}

interface MailboxInfo {
  id: string;
  email: string;
  provider: string;
  status: string;
  dailySendCount: number;
  lastSendResetDate: string | null;
}

export function CampaignDetailClient() {
  const params = useParams();
  const campaignId = params.id as string;

  const [data, setData] = React.useState<CampaignData | null>(null);
  const [drafts, setDrafts] = React.useState<Draft[]>([]);
  const [mailbox, setMailbox] = React.useState<MailboxInfo | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDispatching, setIsDispatching] = React.useState(false);
  const [editingDraftId, setEditingDraftId] = React.useState<string | null>(null);
  const [editSubject, setEditSubject] = React.useState("");
  const [editBody, setEditBody] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);

  const fetchCampaign = async () => {
    try {
      const [campRes, draftsRes, mailboxRes] = await Promise.all([
        fetch(`/api/gtm/campaigns/${campaignId}`),
        fetch(`/api/gtm/campaigns/${campaignId}/drafts`),
        fetch(`/api/gtm/mailbox`),
      ]);
      const [campData, draftsData, mailboxData] = await Promise.all([
        campRes.json(),
        draftsRes.json(),
        mailboxRes.json(),
      ]);

      if (campData.success) setData(campData);
      if (draftsData.success) setDrafts(draftsData.drafts);
      if (mailboxData.connected && mailboxData.mailbox) {
        setMailbox(mailboxData.mailbox);
      } else {
        setMailbox(null);
      }
    } catch (e) {
      console.error("Failed to load campaign data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCampaign();
    const interval = setInterval(fetchCampaign, 5000);
    return () => clearInterval(interval);
  }, [campaignId]);

  const handleAction = async (
    draftId: string,
    action: "approve" | "reject",
    edits?: { subject: string; body: string }
  ) => {
    setIsUpdating(true);
    try {
      const res = await fetch(
        `/api/gtm/campaigns/${campaignId}/drafts/${draftId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, edits }),
        }
      );
      const resData = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(resData.error || `Failed to ${action} draft`);

      toast.success(`Draft marked as ${action}d`);
      setEditingDraftId(null);
      await fetchCampaign();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update draft";
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartSending = async () => {
    if (!mailbox) {
      toast.error("Please connect your Gmail account before sending emails.");
      return;
    }

    setIsDispatching(true);
    try {
      const res = await fetch(`/api/gtm/campaigns/${campaignId}/send`, {
        method: "POST",
      });
      const resData = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(resData.error || "Failed to start sending campaign");
      }

      toast.success(resData.message || "Email dispatch initiated!");
      await fetchCampaign();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start sending";
      toast.error(msg);
    } finally {
      setIsDispatching(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { campaign, segment, researchRun, companies, contacts, snapshots } = data;

  const stageOrder = [
    "find_companies",
    "find_contacts",
    "write_emails",
    "awaiting_approval",
    "send_emails",
    "done",
  ];
  const currentStageIndex = stageOrder.indexOf(campaign.currentStage);

  const approvedDraftsCount = drafts.filter((d) => d.status === "approved").length;
  const sentDraftsCount = drafts.filter((d) => d.status === "sent").length;
  const rejectedDraftsCount = drafts.filter((d) => d.status === "rejected").length;

  const getEmailSourceBadge = (source: string) => {
    switch (source) {
      case "found_on_site":
        return (
          <Badge variant="default" className="text-[10px] gap-1 bg-emerald-600">
            <ShieldCheck className="size-3" /> Found on Site
          </Badge>
        );
      case "pattern_guessed_mx_valid":
        return (
          <Badge
            variant="outline"
            className="text-[10px] gap-1 border-blue-500/50 text-blue-600 dark:text-blue-400"
          >
            <ShieldCheck className="size-3" /> Pattern Guessed (MX Valid)
          </Badge>
        );
      case "pattern_guessed_unverified":
        return (
          <Badge
            variant="outline"
            className="text-[10px] gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"
          >
            <AlertCircle className="size-3" /> Pattern Guessed (Unverified)
          </Badge>
        );
      case "company_fallback":
        return (
          <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
            <HelpCircle className="size-3" /> Company Fallback
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px]">
            No Email Found
          </Badge>
        );
    }
  };

  const getDraftStatusBadge = (status: Draft["status"]) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="text-xs capitalize bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
            <Check className="size-3" /> Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs capitalize gap-1">
            <XCircle className="size-3" /> Failed
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="text-xs capitalize bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="text-xs capitalize">
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs capitalize">
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Navigation & Header */}
      <div>
        <Link
          href="/dashboard/campaigns"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3 -ml-2 text-xs gap-1")}
        >
          <ArrowLeft className="size-3.5 mr-1" />
          Back to Campaigns
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {segment.name} Outreach Pipeline
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Campaign targeting {researchRun.companyName}&apos;s verified ICP segment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                campaign.status === "done"
                  ? "default"
                  : campaign.status === "awaiting_approval"
                  ? "default"
                  : "secondary"
              }
              className="text-xs capitalize self-start sm:self-auto py-1 px-3"
            >
              {campaign.currentStage.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Mailbox Banner */}
      {!mailbox ? (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-semibold text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <Mail className="size-4 text-amber-600" />
              Gmail Mailbox Not Connected
            </div>
            <p className="text-xs text-muted-foreground">
              Connect a Google account with send-only permissions to dispatch approved outreach emails with safe throttling.
            </p>
          </div>
          <a
            href="/api/gtm/mailbox/connect"
            className={cn(buttonVariants({ size: "sm" }), "text-xs shrink-0 bg-amber-600 hover:bg-amber-700 text-white")}
          >
            Connect Gmail Account
          </a>
        </Card>
      ) : (
        <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px]">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Connected: {mailbox.email}
            </Badge>
            <span className="text-[11px]">
              Daily sends today: {mailbox.dailySendCount} / 50
            </span>
          </div>
          <button
            onClick={async () => {
              if (confirm("Disconnect this Gmail mailbox?")) {
                await fetch("/api/gtm/mailbox", { method: "DELETE" });
                await fetchCampaign();
                toast.success("Mailbox disconnected");
              }
            }}
            className="text-[11px] text-muted-foreground hover:text-rose-500 underline"
          >
            Disconnect Mailbox
          </button>
        </div>
      )}

      {/* Pipeline Stage Progress Stepper */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
            {[
              { id: "find_companies", label: "1. Find Companies", icon: Building2 },
              { id: "find_contacts", label: "2. Contacts & MX", icon: Users },
              { id: "write_emails", label: "3. Write Emails", icon: Mail },
              { id: "awaiting_approval", label: "4. Human Review", icon: CheckCircle2 },
              { id: "send_emails", label: "5. Throttled Sending", icon: Send },
            ].map((st, i) => {
              const isPast = currentStageIndex > i || campaign.status === "done";
              const isCurrent = campaign.currentStage === st.id && campaign.status !== "done";
              const Icon = st.icon;

              return (
                <div
                  key={st.id}
                  className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${
                    isCurrent
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : isPast
                      ? "border-border bg-muted/30 text-foreground"
                      : "border-dashed text-muted-foreground opacity-60"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{st.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Review & Dispatch Section (Stage 6/7 Output) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              Generated Email Drafts ({drafts.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and approve drafts before dispatch. Sending is throttled (30-90s delay) via Gmail.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">
              {approvedDraftsCount} Approved / {sentDraftsCount} Sent / {rejectedDraftsCount} Rejected
            </span>
            {approvedDraftsCount > 0 && campaign.currentStage !== "send_emails" && (
              <Button
                size="sm"
                onClick={handleStartSending}
                disabled={isDispatching || !mailbox}
                className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-sm"
              >
                {isDispatching ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Start Sending ({approvedDraftsCount})
              </Button>
            )}
          </div>
        </div>

        {drafts.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted-foreground border-dashed">
            {campaign.currentStage === "find_companies" || campaign.currentStage === "find_contacts"
              ? "Autonomous agent is researching companies and decision-makers. Drafts will appear here once ready."
              : "No drafts generated yet for this campaign."}
          </Card>
        ) : (
          <div className="space-y-4">
            {drafts.map((d) => {
              const isEditing = editingDraftId === d.id;

              return (
                <Card
                  key={d.id}
                  className={`border transition-all ${
                    d.status === "sent"
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : d.status === "failed"
                      ? "border-rose-500/50 bg-rose-500/5"
                      : d.status === "approved"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : d.status === "rejected"
                      ? "border-rose-500/20 bg-rose-500/5 opacity-70"
                      : "border-border"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">
                          {d.contact.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          — {d.contact.title} at {d.company.name}
                        </span>
                        {getEmailSourceBadge(d.contact.emailSource)}
                      </div>
                      {getDraftStatusBadge(d.status)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Recipient: <span className="text-foreground">{d.contact.email || "No email available"}</span>
                      </span>
                      {d.providerMessageId && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Gmail ID: <span className="text-foreground font-semibold">{d.providerMessageId}</span>
                        </span>
                      )}
                      {d.sentAt && (
                        <span className="text-[11px] text-muted-foreground">
                          Sent: {new Date(d.sentAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {d.errorMessage && (
                      <div className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono">
                        Error: {d.errorMessage}
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    {isEditing ? (
                      <div className="space-y-2 pt-2">
                        <Input
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          placeholder="Subject"
                          className="text-xs"
                        />
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={5}
                          className="text-xs font-sans"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingDraftId(null)}
                            className="text-xs h-7"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={isUpdating}
                            onClick={() =>
                              handleAction(d.id, "approve", {
                                subject: editSubject,
                                body: editBody,
                              })
                            }
                            className="text-xs h-7"
                          >
                            Save & Approve
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="border rounded-md p-3 bg-muted/20 space-y-2 text-xs">
                          <div className="font-medium text-foreground">
                            Subject: {d.subject}
                          </div>
                          <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                            {d.body}
                          </div>
                        </div>

                        {d.status !== "sent" && (
                          <div className="flex items-center justify-between pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 gap-1 text-muted-foreground"
                              onClick={() => {
                                setEditingDraftId(d.id);
                                setEditSubject(d.subject);
                                setEditBody(d.body);
                              }}
                            >
                              <Edit2 className="size-3" />
                              Edit Draft
                            </Button>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isUpdating}
                                onClick={() => handleAction(d.id, "reject")}
                                className="text-xs h-7 gap-1 text-rose-600 hover:text-rose-700"
                              >
                                <XCircle className="size-3" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={isUpdating || d.status === "approved"}
                                onClick={() => handleAction(d.id, "approve")}
                                className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CheckCircle2 className="size-3" />
                                Approve
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Candidate Companies & Sourced Contacts Section */}
      <div className="grid gap-6 md:grid-cols-2 pt-4">
        {/* Prospect Companies */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Prospect Companies ({companies.length})
          </h3>
          <div className="space-y-2">
            {companies.map((c) => {
              const snap = snapshots.find((s) => s.prospectCompanyId === c.id);
              return (
                <div
                  key={c.id}
                  className="border rounded-md p-3 text-xs bg-card space-y-1.5"
                >
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>{c.name}</span>
                    <a
                      href={`https://${c.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                  <p className="text-muted-foreground line-clamp-2">
                    {c.description}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                    <span>{c.location}</span>
                    {snap?.employeeCountLabel && (
                      <span>• {snap.employeeCountLabel}</span>
                    )}
                    {snap?.linkedinFollowerCount && (
                      <span>• {snap.linkedinFollowerCount.toLocaleString()} followers</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Contacts Identified */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Decision-Makers & Verification ({contacts.length})
          </h3>
          <div className="space-y-2">
            {contacts.map((ct) => (
              <div
                key={ct.id}
                className="border rounded-md p-3 text-xs bg-card space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{ct.name}</span>
                  {getEmailSourceBadge(ct.emailSource)}
                </div>
                <div className="text-muted-foreground">
                  {ct.title}
                </div>
                <div className="text-[11px] text-foreground/80 font-mono">
                  {ct.email || "No email available"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
