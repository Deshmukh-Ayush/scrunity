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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  X,
  Users,
} from "lucide-react";

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

function getStatusBadge(status: string) {
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

function getVerificationBadge(status: string) {
  switch (status) {
    case "enrich_verified":
      return <Badge variant="default">Verified</Badge>;
    case "pattern_guessed_mx_valid":
      return <Badge variant="outline">MX Valid</Badge>;
    case "pattern_guessed_unverified":
      return <Badge variant="secondary">Pattern Guessed</Badge>;
    case "found_on_site":
      return <Badge variant="outline">Found on Site</Badge>;
    case "company_fallback":
      return <Badge variant="secondary">Company Fallback</Badge>;
    case "unverified":
    default:
      return <Badge variant="secondary">Unverified</Badge>;
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
              <TableHead className="w-[200px] font-semibold text-xs">Contact Name</TableHead>
              <TableHead className="w-[180px] font-semibold text-xs">Title</TableHead>
              <TableHead className="w-[220px] font-semibold text-xs">Company</TableHead>
              <TableHead className="w-[200px] font-semibold text-xs">Campaign</TableHead>
              <TableHead className="w-[140px] font-semibold text-xs">Status</TableHead>
              <TableHead className="font-semibold text-xs">Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                    <span>Loading leads...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center text-xs text-muted-foreground">
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
                  <TableCell>{getStatusBadge(lead.status)}</TableCell>

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
    </div>
  );
}
