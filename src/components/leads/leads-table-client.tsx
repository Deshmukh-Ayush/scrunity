"use client";

import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  X,
  Users,
  Sparkles,
  Send,
  Inbox,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { isValidPersonName } from "@/lib/gtm-contact-matcher";
import { checkLeadQualificationGates } from "@/lib/gtm-stage-5-5";

function LinkedinIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

export type Lead = {
  id: string;
  name: string;
  title: string;
  email: string | null;
  verificationStatus: string;
  emailSource: string;
  linkedinUrl: string | null;
  createdAt: string;
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  campaignId: string;
  campaignName: string;
  status: string;
  draftId?: string | null;
  draftSubject?: string | null;
  draftBody?: string | null;
  draftStatus?: string | null;
  threadId?: string | null;
  rejectionReason?: string | null;
};

export type CampaignOption = {
  id: string;
  name: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "discovered", label: "Discovered" },
  { value: "drafted", label: "Drafted" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "replied", label: "Replied" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "disqualified", label: "Disqualified" },
  { value: "failed", label: "Failed" },
];

function getStatusBadge(
  leadOrStatus: { status: string; rejectionReason?: string | null; name?: string } | string
) {
  const status = typeof leadOrStatus === "string" ? leadOrStatus : leadOrStatus.status;
  const rejectionReason = typeof leadOrStatus === "string" ? null : leadOrStatus.rejectionReason;
  const name = typeof leadOrStatus === "string" ? "" : leadOrStatus.name;

  const isPendingRediscovery =
    (status === "disqualified" &&
      (Boolean(rejectionReason?.toLowerCase().includes("pending re-discovery")) ||
        (Boolean(name) && !isValidPersonName(name || "")))) ||
    (Boolean(name) && !isValidPersonName(name || ""));

  if (isPendingRediscovery) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-medium text-[11px] gap-1 inline-flex items-center"
      >
        <AlertTriangle className="size-3 text-amber-500 shrink-0" />
        Pending Re-discovery
      </Badge>
    );
  }

  switch (status) {
    case "meeting_booked":
      return <Badge variant="default">Meeting Booked</Badge>;
    case "replied":
      return <Badge variant="default">Replied</Badge>;
    case "sent":
      return <Badge variant="secondary">Sent</Badge>;
    case "approved":
      return <Badge variant="outline">Approved</Badge>;
    case "drafted":
      return <Badge variant="outline">Drafted</Badge>;
    case "disqualified":
      return <Badge variant="destructive">Disqualified</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "discovered":
    default:
      return <Badge variant="secondary">Discovered</Badge>;
  }
}

function getDraftStatusBadge(status: string) {
  switch (status) {
    case "sent":
      return <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Sent</Badge>;
    case "approved":
      return <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">Approved</Badge>;
    case "rejected":
      return <Badge variant="destructive" className="text-[10px]">Rejected</Badge>;
    case "failed":
      return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
    case "draft":
    default:
      return <Badge variant="outline" className="text-[10px]">Draft</Badge>;
  }
}

function getVerificationBadge(status: string) {
  switch (status) {
    case "enrich_verified":
      return <Badge variant="default" className="text-[10px]">Verified</Badge>;
    case "pattern_guessed_mx_valid":
      return <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">MX Valid</Badge>;
    case "pattern_guessed_unverified":
      return <Badge variant="secondary" className="text-[10px]">Pattern Guessed</Badge>;
    case "found_on_site":
      return <Badge variant="outline" className="text-[10px]">Found on Site</Badge>;
    case "company_fallback":
      return <Badge variant="secondary" className="text-[10px]">Company Fallback</Badge>;
    case "unverified":
    default:
      return <Badge variant="secondary" className="text-[10px]">Unverified</Badge>;
  }
}

export type LeadsTableClientProps = {
  initialLeads?: Lead[];
  initialTotal?: number;
  initialCampaigns?: CampaignOption[];
  initialCampaignId?: string;
  initialStatus?: string;
  initialSearch?: string;
  initialPage?: number;
};

export function LeadsTableClient({
  initialLeads = [],
  initialTotal = 0,
  initialCampaigns = [],
  initialCampaignId = "all",
  initialStatus = "all",
  initialSearch = "",
  initialPage = 1,
}: LeadsTableClientProps) {
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads);
  const [campaigns, setCampaigns] = React.useState<CampaignOption[]>(initialCampaigns);
  const [total, setTotal] = React.useState(initialTotal);
  const [totalPages, setTotalPages] = React.useState(Math.max(1, Math.ceil(initialTotal / 20)));
  const [isLoading, setIsLoading] = React.useState(false);
  const isInitialMount = React.useRef(true);

  // Filters state
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [campaignId, setCampaignId] = React.useState(initialCampaignId);
  const [status, setStatus] = React.useState(initialStatus);
  const [page, setPage] = React.useState(initialPage);
  const pageSize = 20;

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 on new search
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch leads when filters change
  const fetchLeads = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (campaignId && campaignId !== "all") params.set("campaignId", campaignId);
      if (status && status !== "all") params.set("status", status);
      if (typeof window !== "undefined") {
        const testOrg = new URLSearchParams(window.location.search).get("test_org");
        if (testOrg) params.set("test_org", testOrg);
      }

      const res = await fetch(`/api/gtm/leads?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load leads: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.campaigns) {
          setCampaigns(data.campaigns);
        }
      }
    } catch (err) {
      console.error("[LeadsTableClient] Error fetching leads:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch, campaignId, status]);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialLeads.length === 0 && initialTotal === 0) {
        fetchLeads();
      }
      return;
    }
    fetchLeads();
  }, [fetchLeads, initialLeads.length, initialTotal]);

  // Action state for Stage 6 / Stage 7 dispatch
  const [draftingLeadId, setDraftingLeadId] = React.useState<string | null>(null);
  const [reviewLead, setReviewLead] = React.useState<Lead | null>(null);
  const [editSubject, setEditSubject] = React.useState("");
  const [editBody, setEditBody] = React.useState("");
  const [isActionPending, setIsActionPending] = React.useState(false);

  const handleDraftEmail = async (lead: Lead) => {
    if (!isValidPersonName(lead.name)) {
      toast.error(`Cannot generate draft: "${lead.name}" is not a valid person name (pending re-discovery).`);
      return;
    }
    const gateCheck = checkLeadQualificationGates(lead);
    if (!gateCheck.qualified) {
      toast.error(`Cannot generate draft: ${gateCheck.reason}`);
      return;
    }
    setDraftingLeadId(lead.id);
    try {
      const res = await fetch(`/api/gtm/leads/${lead.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate email draft");
      }
      toast.success(`Draft generated for ${lead.name}`);
      await fetchLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate email draft";
      toast.error(msg);
    } finally {
      setDraftingLeadId(null);
    }
  };

  const handleOpenReview = async (lead: Lead) => {
    if (!isValidPersonName(lead.name)) {
      toast.error(`Cannot review or send draft: "${lead.name}" is not a valid person name (pending re-discovery).`);
      return;
    }
    const gateCheck = checkLeadQualificationGates(lead);
    if (!gateCheck.qualified) {
      toast.error(`Cannot review draft: ${gateCheck.reason}`);
      return;
    }
    setReviewLead(lead);
    if (lead.draftSubject || lead.draftBody) {
      setEditSubject(lead.draftSubject || "");
      setEditBody(lead.draftBody || "");
      return;
    }

    // Fallback: fetch campaign drafts if draft content wasn't cached on lead
    try {
      const res = await fetch(`/api/gtm/campaigns/${lead.campaignId}/drafts`);
      const data = await res.json();
      if (data.drafts) {
        const found = data.drafts.find(
          (d: { id: string; contact?: { id: string }; subject: string; body: string }) =>
            d.id === lead.draftId || d.contact?.id === lead.id
        );
        if (found) {
          setEditSubject(found.subject || "");
          setEditBody(found.body || "");
          return;
        }
      }
    } catch {
      // ignore fallback error
    }
    setEditSubject(lead.draftSubject || "");
    setEditBody(lead.draftBody || "");
  };

  const handleRejectDraft = async () => {
    if (!reviewLead) return;
    setIsActionPending(true);
    try {
      const draftId = reviewLead.draftId;
      if (draftId) {
        const res = await fetch(
          `/api/gtm/campaigns/${reviewLead.campaignId}/drafts/${draftId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject" }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reject draft");
      }
      toast.success("Draft rejected");
      setReviewLead(null);
      await fetchLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject draft";
      toast.error(msg);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSaveAndApprove = async () => {
    if (!reviewLead) return;
    setIsActionPending(true);
    try {
      const draftId = reviewLead.draftId;
      if (draftId) {
        const res = await fetch(
          `/api/gtm/campaigns/${reviewLead.campaignId}/drafts/${draftId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "approve",
              edits: { subject: editSubject, body: editBody },
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to approve draft");
      }
      toast.success("Draft approved");
      setReviewLead(null);
      await fetchLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve draft";
      toast.error(msg);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSendViaGmail = async () => {
    if (!reviewLead) return;
    if (!isValidPersonName(reviewLead.name)) {
      toast.error(`Sending blocked: "${reviewLead.name}" is not a valid person name.`);
      return;
    }
    const gateCheck = checkLeadQualificationGates(reviewLead);
    if (!gateCheck.qualified) {
      toast.error(`Sending blocked: ${gateCheck.reason}`);
      return;
    }
    setIsActionPending(true);
    try {
      const res = await fetch(`/api/gtm/leads/${reviewLead.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approveFirst: true,
          edits: { subject: editSubject, body: editBody },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch email");
      }
      toast.success(`Email sent via Gmail to ${reviewLead.email || reviewLead.name}`);
      setReviewLead(null);
      await fetchLeads();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to dispatch email";
      toast.error(msg);
    } finally {
      setIsActionPending(false);
    }
  };

  const renderLeadAction = (lead: Lead) => {
    const isNameValid = isValidPersonName(lead.name);

    // 4. Disqualified: show qualification reason
    if (lead.status === "disqualified") {
      const reason = lead.rejectionReason || "Disqualified during review";
      const isPendingRediscovery = reason.toLowerCase().includes("pending re-discovery") || !isNameValid;
      return (
        <span
          className={cn(
            "text-[11px] italic truncate max-w-[150px] inline-flex items-center gap-1",
            isPendingRediscovery ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"
          )}
          title={reason}
        >
          {isPendingRediscovery && <AlertTriangle className="size-3 text-amber-500 shrink-0" />}
          <span className="truncate">{reason}</span>
        </span>
      );
    }

    // Structurally invalid contact name (job title, etc.): disabled action
    if (!isNameValid) {
      return (
        <Button
          variant="outline"
          size="sm"
          disabled
          className="h-7 px-2.5 text-xs gap-1.5 opacity-60 border-amber-500/40 text-amber-600 dark:text-amber-400 cursor-not-allowed bg-amber-500/5"
          title="Contact name is a job title — pending re-discovery"
        >
          <AlertCircle className="size-3 text-amber-500" />
          Pending Re-discovery
        </Button>
      );
    }

    // Hard qualification gates: Email confidence floor & LinkedIn profile required
    const gateCheck = checkLeadQualificationGates(lead);
    if (!gateCheck.qualified) {
      return (
        <span
          className="text-[11px] italic truncate max-w-[150px] inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium"
          title={gateCheck.reason}
        >
          <AlertTriangle className="size-3 text-amber-500 shrink-0" />
          <span className="truncate">{gateCheck.reason}</span>
        </span>
      );
    }

    // 3. Sent or later: "View in Mailbox"
    if (lead.status === "sent" || lead.status === "replied" || lead.status === "meeting_booked") {
      const targetUrl = lead.threadId
        ? `/dashboard/mailbox?threadId=${encodeURIComponent(lead.threadId)}`
        : `/dashboard/mailbox?contactId=${encodeURIComponent(lead.id)}`;
      return (
        <Link
          href={targetUrl}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-border/80"
          )}
        >
          <Inbox className="size-3" />
          View in Mailbox
        </Link>
      );
    }

    // 2. Drafted, not yet sent: "Review & Send"
    if (
      lead.status === "drafted" ||
      lead.status === "approved" ||
      (lead.draftId && lead.status !== "failed")
    ) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenReview(lead)}
          className="h-7 px-2.5 text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 font-medium"
        >
          <Send className="size-3" />
          Review & Send
        </Button>
      );
    }

    // Failed status: Retry
    if (lead.status === "failed") {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDraftEmail(lead)}
          disabled={draftingLeadId === lead.id}
          className="h-7 px-2 text-xs gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
        >
          {draftingLeadId === lead.id ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Retry
        </Button>
      );
    }

    // 1. No draft yet: "Draft Email"
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleDraftEmail(lead)}
        disabled={draftingLeadId === lead.id}
        className="h-7 px-2.5 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary font-medium"
      >
        {draftingLeadId === lead.id ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Sparkles className="size-3" />
        )}
        Draft Email
      </Button>
    );
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCampaignId("all");
    setStatus("all");
    setPage(1);
  };

  const hasActiveFilters = search !== "" || campaignId !== "all" || status !== "all";

  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, total);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads</h1>
            <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
              {total} {total === 1 ? "lead" : "leads"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            All contacts and prospect companies across your active campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLeads()}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Toolbar using shadcn Input, Select, and Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card p-3 rounded-lg border border-border/60">
        {/* Text Search using shadcn Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by contact, company, title, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearch("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X className="size-3" />
            </Button>
          )}
        </div>

        {/* Campaign Filter Select */}
        <div className="w-full sm:w-[220px]">
          <Select
            value={campaignId}
            onValueChange={(val) => {
              if (typeof val === "string") {
                setCampaignId(val);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-full h-8 text-xs bg-background">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter Select */}
        <div className="w-full sm:w-[170px]">
          <Select
            value={status}
            onValueChange={(val) => {
              if (typeof val === "string") {
                setStatus(val);
                setPage(1);
              }
            }}
          >
            <SelectTrigger className="w-full h-8 text-xs bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reset Filters Button using shadcn Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Main Table using shadcn Table */}
      <div className="rounded-md border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[180px] font-semibold text-xs">Contact Name</TableHead>
              <TableHead className="w-[160px] font-semibold text-xs">Title</TableHead>
              <TableHead className="w-[200px] font-semibold text-xs">Company</TableHead>
              <TableHead className="w-[180px] font-semibold text-xs">Campaign</TableHead>
              <TableHead className="w-[120px] font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs">Email</TableHead>
              <TableHead className="w-[150px] text-right font-semibold text-xs pr-4">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                    <span>Loading leads...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                    <Users className="size-8 text-muted-foreground/40 mb-1" />
                    <p className="font-medium text-foreground">No leads found</p>
                    <p className="text-muted-foreground max-w-sm">
                      {hasActiveFilters
                        ? "No contacts match your current filter combination. Try clearing some filters."
                        : "No leads discovered yet for this organization."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearFilters}
                        className="mt-2 h-7 text-xs"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/40 transition-colors">
                  {/* Contact Name */}
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[180px] text-foreground font-medium" title={lead.name}>
                        {lead.name}
                      </span>
                      {lead.linkedinUrl && (
                        <a
                          href={lead.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-blue-500 transition-colors inline-flex shrink-0"
                          title="Open LinkedIn profile"
                        >
                          <LinkedinIcon className="size-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>

                  {/* Title */}
                  <TableCell>
                    <span
                      className="text-muted-foreground truncate block max-w-[170px]"
                      title={lead.title}
                    >
                      {lead.title || "—"}
                    </span>
                  </TableCell>

                  {/* Company */}
                  <TableCell>
                    <div className="flex flex-col max-w-[210px]">
                      <span className="font-medium text-foreground truncate" title={lead.companyName}>
                        {lead.companyName}
                      </span>
                      {lead.companyDomain && (
                        <a
                          href={`https://${lead.companyDomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate transition-colors"
                          title={`Visit ${lead.companyDomain}`}
                        >
                          <span>{lead.companyDomain}</span>
                          <ExternalLink className="size-2.5 shrink-0 opacity-60" />
                        </a>
                      )}
                    </div>
                  </TableCell>

                  {/* Campaign */}
                  <TableCell>
                    <Link
                      href={`/dashboard/campaigns`}
                      className="text-xs text-foreground hover:text-primary hover:underline truncate block max-w-[190px] transition-colors"
                      title={lead.campaignName}
                    >
                      {lead.campaignName}
                    </Link>
                  </TableCell>

                  {/* Status using shadcn Badge */}
                  <TableCell>{getStatusBadge(lead)}</TableCell>

                  {/* Email + Verification using shadcn Badge */}
                  <TableCell>
                    {lead.email ? (
                      <div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
                        <span className="text-foreground font-mono text-[11px] truncate" title={lead.email}>
                          {lead.email}
                        </span>
                        {getVerificationBadge(lead.verificationStatus)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Per-row Action Button */}
                  <TableCell className="text-right pr-4">
                    {renderLeadAction(lead)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer using shadcn Button */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-1">
          <div>
            Showing <span className="font-medium text-foreground">{startRecord}</span> to{" "}
            <span className="font-medium text-foreground">{endRecord}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span> leads
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>

            <span className="px-2 text-xs font-medium text-foreground">
              Page {page} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || isLoading}
              className="h-8 px-2.5 text-xs gap-1"
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Stage 6 Review & Send Modal Dialog */}
      <Dialog open={!!reviewLead} onOpenChange={(open) => !open && setReviewLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Mail className="size-4 text-primary" />
              Review & Send Outreach Email
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review and customize the AI-generated draft before dispatching through your connected Gmail mailbox.
            </DialogDescription>
          </DialogHeader>

          {reviewLead && (
            <div className="space-y-4 pt-2">
              {/* Contact Card */}
              <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-2 border border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{reviewLead.name}</span>
                    <span className="text-muted-foreground">— {reviewLead.title}</span>
                  </div>
                  {getStatusBadge(reviewLead)}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
                  <div>
                    <span className="font-medium text-foreground">Company: </span>
                    {reviewLead.companyName}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Email: </span>
                    <span className="font-mono text-foreground">{reviewLead.email || "No email available"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Campaign: </span>
                    {reviewLead.campaignName}
                  </div>
                </div>
              </div>

              {/* Subject & Body Editor */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Subject Line</label>
                  <Input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="Subject line..."
                    className="text-xs font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email Body</label>
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={8}
                    placeholder="Email body..."
                    className="text-xs font-sans leading-relaxed resize-y"
                  />
                </div>
              </div>

              {/* Alert if contact name invalid */}
              {!isValidPersonName(reviewLead.name) && (
                <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>
                    <strong>Sending Blocked:</strong> &quot;{reviewLead.name}&quot; is not a valid individual name (pending re-discovery). Real outreach is disabled for this lead.
                  </span>
                </div>
              )}

              {/* Alert if lead fails qualification gates */}
              {!checkLeadQualificationGates(reviewLead).qualified && (
                <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>
                    <strong>Sending Blocked:</strong> {checkLeadQualificationGates(reviewLead).reason}. Real outreach is disabled for this lead.
                  </span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRejectDraft}
                  disabled={isActionPending}
                  className="text-xs h-8 gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30 w-full sm:w-auto"
                >
                  <XCircle className="size-3.5" />
                  Reject Draft
                </Button>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAndApprove}
                    disabled={isActionPending}
                    className="text-xs h-8 gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Save & Approve
                  </Button>

                  {/* Surface verification confidence badge directly next to Send button */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/60 border border-border/40 text-xs">
                    <span className="text-[11px] text-muted-foreground font-medium">Confidence:</span>
                    {getVerificationBadge(reviewLead.verificationStatus)}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSendViaGmail}
                    disabled={
                      isActionPending ||
                      !reviewLead.email ||
                      !isValidPersonName(reviewLead.name) ||
                      !checkLeadQualificationGates(reviewLead).qualified
                    }
                    className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-sm"
                    title={
                      !isValidPersonName(reviewLead.name)
                        ? "Sending blocked: Contact name is invalid (pending re-discovery)"
                        : !checkLeadQualificationGates(reviewLead).qualified
                        ? `Sending blocked: ${checkLeadQualificationGates(reviewLead).reason}`
                        : undefined
                    }
                  >
                    {isActionPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Send via Gmail
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
