import Link from "next/link";
import { FileText, CheckCircle2, Clock, FileSignature } from "lucide-react";
import type { OverviewProposal, OverviewContract } from "./project-overview-types";
import { ProjectOverviewCard } from "./project-overview-card";

type ProjectOverviewFinancialsProps = {
  projectId: string;
  proposal: OverviewProposal | null;
  contract: OverviewContract | null;
  userRole: string;
};

const PROPOSAL_STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "text-muted-foreground" },
  sent: { label: "Sent", className: "text-blue-500" },
  accepted: { label: "Accepted", className: "text-emerald-500" },
  declined: { label: "Declined", className: "text-red-500" },
};

const CONTRACT_STATUS: Record<string, { label: string; className: string }> = {
  none: { label: "No contract", className: "text-muted-foreground" },
  draft: { label: "Draft", className: "text-muted-foreground" },
  pending_signature: { label: "Pending Signature", className: "text-amber-500" },
  signed: { label: "Signed", className: "text-emerald-500" },
};

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProjectOverviewFinancials({
  projectId,
  proposal,
  contract,
  userRole,
}: ProjectOverviewFinancialsProps) {
  const proposalStatus = proposal ? (PROPOSAL_STATUS[proposal.status] ?? PROPOSAL_STATUS.draft) : null;
  const contractStatus = contract
    ? (CONTRACT_STATUS[contract.status] ?? CONTRACT_STATUS.draft)
    : CONTRACT_STATUS.none;

  return (
    <ProjectOverviewCard className="lg:col-span-2" padding="md">
      <h2 className="mb-4 text-[13px] font-semibold text-foreground">Financials</h2>

      <div className="space-y-4">
        {/* Proposal */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Proposal
          </div>
          {proposal ? (
            <div className="space-y-1.5 pl-5.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-semibold tabular-nums text-foreground tracking-tight">
                  {formatPrice(proposal.price, proposal.currency)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <span className={`font-medium ${proposalStatus!.className}`}>{proposalStatus!.label}</span>
                <span className="text-muted-foreground">· {proposal.title}</span>
              </div>
            </div>
          ) : (
            <p className="pl-5.5 text-[13px] text-muted-foreground">
              {userRole === "owner" || userRole === "agency" ? (
                <Link href={`/projects/${projectId}/proposal`} className="inline-block underline-offset-2 transition-all hover:underline active:scale-[0.96]">
                  Create a proposal →
                </Link>
              ) : (
                "No proposal yet"
              )}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Contract */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <FileSignature className="h-3.5 w-3.5" />
            Contract
          </div>
          <div className="flex items-center gap-2 pl-5.5 text-[13px]">
            {contract?.status === "signed" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={`font-medium ${contractStatus.className}`}>{contractStatus.label}</span>
            {contract ? (
              <span className="text-muted-foreground text-[12px]">· {contract.fileName}</span>
            ) : null}
          </div>
        </div>
      </div>
    </ProjectOverviewCard>
  );
}
