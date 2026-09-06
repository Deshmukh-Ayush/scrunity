"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Send, ShieldCheck, AlertCircle } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function ProposalClientView({ proposal, role, onAccepted }: { proposal: any; role: string; onAccepted?: () => void }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; action: "accept" | "decline" | null }>({ isOpen: false, action: null });

  const executeAction = async () => {
    if (!confirmDialog.action) return;
    
    setIsSubmitting(true);
    setConfirmDialog({ isOpen: false, action: null });
    
    try {
      await axios.patch('/api/proposals', { proposalId: proposal.id, action: confirmDialog.action });
      toast.success(`Proposal ${confirmDialog.action}ed successfully`);
      router.refresh();
      if (onAccepted) onAccepted();
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${confirmDialog.action} proposal`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isExpired = new Date(proposal.validUntil) < new Date();
  const validityText = isExpired 
    ? "Expired" 
    : `Valid for ${formatDistanceToNow(new Date(proposal.validUntil))}`;

  const formatCurrency = (amount: number, currency: string = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Draft
          </span>
        );
      case "sent":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Send className="w-3.5 h-3.5" /> Pending Client Review
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Declined
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header Summary Card */}
      <div className="bg-card/80 border border-border/50 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{proposal.title}</h1>
            {getStatusBadge(proposal.status)}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Created {new Date(proposal.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            {proposal.status === "sent" && (
              <span className={isExpired ? "text-rose-400 font-medium" : "text-muted-foreground font-medium"}>
                • {validityText}
              </span>
            )}
          </div>
        </div>

        <div className="bg-muted/40 border border-border/40 rounded-xl px-5 py-3 text-left md:text-right shrink-0">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Total Investment
          </span>
          <span className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight">
            {formatCurrency(proposal.price, proposal.currency)}
          </span>
        </div>
      </div>

      {/* Scope Summary Card */}
      {proposal.scopeSummary && (
        <div className="bg-card/80 border border-border/50 rounded-2xl p-6 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Scope Summary & Objectives
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {proposal.scopeSummary}
          </p>
        </div>
      )}

      {/* Line Items Table */}
      <div className="bg-card/80 border border-border/50 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-border/40">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Included Deliverables & Investment Breakdown
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30">
                <th className="py-3 px-5 text-left">Scope Line Item</th>
                <th className="py-3 px-5 text-center">Qty</th>
                <th className="py-3 px-5 text-right">Unit Price</th>
                <th className="py-3 px-5 text-right">Total Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {proposal.lineItems.map((item: any) => (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="py-4 px-5 text-foreground font-medium">{item.description}</td>
                  <td className="py-4 px-5 text-center tabular-nums text-muted-foreground">{item.quantity}</td>
                  <td className="py-4 px-5 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(item.unitPrice, proposal.currency)}
                  </td>
                  <td className="py-4 px-5 text-right tabular-nums font-semibold text-foreground">
                    {formatCurrency(item.total, proposal.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 border-t border-border/40 font-bold">
                <td colSpan={3} className="py-4 px-5 text-right text-xs uppercase tracking-wider text-muted-foreground">
                  Grand Total:
                </td>
                <td className="py-4 px-5 text-right text-lg tabular-nums text-foreground">
                  {formatCurrency(proposal.price, proposal.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Auto-Mapping Notice */}
      {role === "client" && proposal.status === "sent" && !isExpired && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-emerald-300">Accepting this proposal</h3>
              <p className="text-xs text-emerald-400/80">
                Will automatically map all included scope line items into project deliverables & milestone payment release triggers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDialog({ isOpen: true, action: "decline" })}
              disabled={isSubmitting}
              className="text-xs h-9 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 active:scale-[0.96] transition-transform"
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmDialog({ isOpen: true, action: "accept" })}
              disabled={isSubmitting}
              className="text-xs h-9 px-5 bg-emerald-500 text-black font-semibold hover:bg-emerald-400 active:scale-[0.96] transition-transform shadow-md"
            >
              Accept Proposal
            </Button>
          </div>
        </div>
      )}

      {/* Expiry Warning */}
      {proposal.status === "sent" && isExpired && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-center rounded-2xl text-xs font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> This proposal has expired. Please request a revised version from your agency.
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog({ isOpen: false, action: null })}>
        <DialogContent className="bg-background text-foreground border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {confirmDialog.action === "accept" ? "Accept Project Proposal" : "Decline Proposal"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Are you sure you want to {confirmDialog.action} this proposal? 
              {confirmDialog.action === "accept" ? " This will automatically create your project deliverables and payment milestones." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDialog({ isOpen: false, action: null })} className="text-xs">
              Cancel
            </Button>
            <Button 
              size="sm"
              variant={confirmDialog.action === "decline" ? "destructive" : "default"} 
              onClick={executeAction}
              disabled={isSubmitting}
              className="text-xs active:scale-[0.96] transition-transform"
            >
              {isSubmitting ? "Processing..." : "Confirm & Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
