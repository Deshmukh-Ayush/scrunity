"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Clock,
  Sparkles,
  Loader2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export function CampaignDetailClient() {
  const params = useParams();
  const campaignId = params.id as string;

  const [data, setData] = React.useState<any | null>(null);
  const [drafts, setDrafts] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [editingDraftId, setEditingDraftId] = React.useState<string | null>(null);
  const [editSubject, setEditSubject] = React.useState("");
  const [editBody, setEditBody] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);

  const fetchCampaign = async () => {
    try {
      const [campRes, draftsRes] = await Promise.all([
        fetch(`/api/gtm/campaigns/${campaignId}`),
        fetch(`/api/gtm/campaigns/${campaignId}/drafts`),
      ]);
      const [campData, draftsData] = await Promise.all([
        campRes.json(),
        draftsRes.json(),
      ]);

      if (campData.success) setData(campData);
      if (draftsData.success) setDrafts(draftsData.drafts);
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
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || `Failed to ${action} draft`);

      toast.success(`Draft marked as ${action}d`);
      setEditingDraftId(null);
      await fetchCampaign();
    } catch (err: any) {
      toast.error(err.message || `Failed to update draft`);
    } finally {
      setIsUpdating(false);
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

  const stageOrder = ["find_companies", "find_contacts", "write_emails", "awaiting_approval"];
  const currentStageIndex = stageOrder.indexOf(campaign.currentStage);

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
          <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/50 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="size-3" /> Pattern Guessed (MX Valid)
          </Badge>
        );
      case "pattern_guessed_unverified":
        return (
          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
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
          <Badge
            variant={campaign.status === "awaiting_approval" ? "default" : "secondary"}
            className="text-xs capitalize self-start sm:self-auto py-1 px-3"
          >
            {campaign.currentStage.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      {/* Pipeline Stage Progress Stepper */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs">
            {[
              { id: "find_companies", label: "1. Find Companies", icon: Building2 },
              { id: "find_contacts", label: "2. Find Contacts & MX", icon: Users },
              { id: "write_emails", label: "3. Write Emails", icon: Mail },
              { id: "awaiting_approval", label: "4. Human Review", icon: CheckCircle2 },
            ].map((st, i) => {
              const isPast = currentStageIndex > i;
              const isCurrent = campaign.currentStage === st.id;
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

      {/* Review Checkpoint Section (Stage 6 Output) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              Generated Email Drafts ({drafts.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and approve drafts before dispatch. Sending is deferred to the approval checkpoint.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            {drafts.filter((d) => d.status === "approved").length} Approved /{" "}
            {drafts.filter((d) => d.status === "rejected").length} Rejected
          </span>
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
                    d.status === "approved"
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : d.status === "rejected"
                      ? "border-rose-500/30 bg-rose-500/5 opacity-70"
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
                      <Badge
                        variant={
                          d.status === "approved"
                            ? "default"
                            : d.status === "rejected"
                            ? "destructive"
                            : "outline"
                        }
                        className="text-xs capitalize self-start sm:self-auto"
                      >
                        {d.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Recipient: <span className="text-foreground">{d.contact.email || "No email available"}</span>
                    </div>
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
            {companies.map((c: any) => {
              const snap = snapshots.find((s: any) => s.prospectCompanyId === c.id);
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
            {contacts.map((ct: any) => (
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
