"use client";

import { motion } from "framer-motion";
import { Eye, Trash2, Clock, XCircle, ArrowRight } from "lucide-react";
import { SealCheckIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";

interface ProposalCardProps {
  proposal: any;
  role: string;
  isSending: boolean;
  isDeleting: boolean;
  onView: (proposal: any) => void;
  onSend: (proposalId: string) => void;
  onDelete: (proposalId: string) => void;
  index?: number;
}

export function ProposalCard({
  proposal,
  role,
  isSending,
  isDeleting,
  onView,
  onSend,
  onDelete,
  index = 0,
}: ProposalCardProps) {
  const lineItemsCount = proposal.lineItems?.length || 0;

  const formatCurrency = (amount: number, currency: string = "INR") => {
    if (currency === "USD") {
      return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  const getStatusConfig = () => {
    switch (proposal.status) {
      case "accepted":
        return {
          label: "Accepted",
          Icon: SealCheckIcon,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        };
      case "sent":
        return {
          label: "Sent",
          Icon: PaperPlaneTiltIcon,
          color: "text-sky-500",
          bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
        };
      case "declined":
        return {
          label: "Declined",
          Icon: XCircle,
          color: "text-rose-500",
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
        };
      default:
        return {
          label: "Draft",
          Icon: Clock,
          color: "text-purple-500",
          bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
        };
    }
  };

  const status = getStatusConfig();
  const StatusIcon = status.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className="group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 py-2.5 px-3 hover:bg-muted/40 border-b border-border/40 last:border-0 transition-colors rounded-md"
    >
      {/* Left: Icon, Title & Badge */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusIcon className={`w-4 h-4 shrink-0 ${status.color}`} />

        <span className="text-sm font-medium tracking-tight text-foreground truncate max-w-50 sm:max-w-xs text-balance">
          {proposal.title}
        </span>

        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${status.bg} shrink-0`}>
          {status.label}
        </span>
      </div>

      {/* Right: Line Items Count, Amount & Actions */}
      <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end mt-2 sm:mt-0 ml-7 sm:ml-0">
        {/* Line items count */}
        <div className="text-xs text-muted-foreground whitespace-nowrap leading-tight">
          <span className="tabular-nums font-semibold">{lineItemsCount}</span> line item{lineItemsCount !== 1 ? "s" : ""}
        </div>

        {/* Amount */}
        <div className="text-sm font-semibold tabular-nums tracking-tight min-w-20 text-right">
          {formatCurrency(proposal.price, proposal.currency)}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-22.5 justify-end">
          <button
            onClick={() => onView(proposal)}
            aria-label={`View details for proposal ${proposal.title}`}
            className="flex items-center gap-1 h-7 px-2.5 text-[12px] font-medium rounded-full border border-border/60 bg-background text-foreground hover:bg-muted/60 transition-colors active:scale-[0.96]"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>

          {proposal.status === "draft" && (role === "owner" || role === "agency") && (
            <>
              <button
                disabled={isSending}
                onClick={() => onSend(proposal.id)}
                aria-label={`Send proposal ${proposal.title}`}
                className="flex items-center gap-1 h-7 px-2.5 text-[12px] font-medium rounded-full bg-[#00AAF7] text-white hover:bg-[#0088c4] transition-colors active:scale-[0.96]"
              >
                Send <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                disabled={isDeleting}
                onClick={() => onDelete(proposal.id)}
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-[0.96]"
                aria-label={`Delete proposal ${proposal.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
