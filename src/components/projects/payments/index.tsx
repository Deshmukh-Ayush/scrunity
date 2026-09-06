"use client";

import { useState } from "react";
import { Plus, FileText, DownloadSimple, Eye, ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/navigation";
import { PaymentsRadialChart } from "./payments-radial-chart";
import { MilestonesEmptyState } from "./milestones-empty-state";
import { MilestoneItem } from "./milestone-item";
import { PaymentConfirmModal } from "./payment-confirm-modal";
import { CreateMilestoneModal } from "./create-milestone-modal";
import { PaymentProofReviewModal, type PaymentProofItem } from "./payment-proof-review-modal";
import { InvoicePreviewModal } from "@/components/invoices/invoice-preview-modal";
import { useUIStore } from "@/store/ui-store";
import { usePaymentStore } from "@/store/payment-store";
import type { InvoiceData } from "@/lib/invoices/types";
import { formatInvoiceMoney } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";
import type {
  MilestoneWithDetails,
  PaymentsViewClientProps,
} from "./types";

export type { MilestoneWithDetails, PaymentsViewClientProps } from "./types";

export function PaymentsViewClient({
  projectId,
  milestones,
  payments,
  invoices = [],
  paymentProofs = [],
  userRole,
  deliverablesList,
}: PaymentsViewClientProps) {
  const router = useRouter();

  const setCreateMilestoneOpen = useUIStore((state) => state.setCreateMilestoneOpen);
  const setPayModalMilestone = usePaymentStore((state) => state.setPayModalMilestone);
  const setSelectedMethod = usePaymentStore((state) => state.setSelectedMethod);
  const setReferenceNote = usePaymentStore((state) => state.setReferenceNote);

  // Invoices & Review Modals
  const [activeTab, setActiveTab] = useState<"milestones" | "invoices">("milestones");
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null);
  const [reviewProof, setReviewProof] = useState<PaymentProofItem | null>(null);

  const isAgency = userRole === "owner" || userRole === "agency";
  const paymentRecordMap = new Map(payments.map((p) => [p.milestoneId, p]));
  const milestoneInvoiceMap = new Map(
    invoices.filter((inv) => inv.milestoneId).map((inv) => [inv.milestoneId!, inv])
  );

  const pendingProofByMilestone = new Map(
    paymentProofs
      .filter((p) => p.status === "pending_review")
      .map((p) => [p.milestoneId, p])
  );

  const pendingProofByInvoice = new Map(
    paymentProofs
      .filter((p) => p.status === "pending_review" && p.invoiceId)
      .map((p) => [p.invoiceId!, p])
  );

  const formatMoney = (amountInUnits: number, curr: string = "INR") => {
    const mainUnits = amountInUnits / 100;
    if (curr === "USD") {
      return `$${mainUnits.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `₹${mainUnits.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  const handleOpenPaymentModal = (milestone: MilestoneWithDetails) => {
    setPayModalMilestone(milestone);
    setSelectedMethod("upi");
    setReferenceNote("");
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm("Delete this payment milestone?")) return;
    try {
      const res = await axios.delete(`/api/milestones?milestoneId=${milestoneId}`);
      if (res.data.success) {
        toast.success("Milestone deleted");
        router.refresh();
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || "Failed to delete milestone"
        : "Failed to delete milestone";
      toast.error(message);
    }
  };

  const handleOpenInvoiceBuilder = (milestone?: MilestoneWithDetails) => {
    const url = `/projects/${projectId}/payments/invoices/new${
      milestone ? `?milestoneId=${milestone.id}` : ""
    }`;
    router.push(url);
  };

  const handleDownloadInvoicePdf = (inv: InvoiceData) => {
    if (inv.pdfUrl) {
      window.open(inv.pdfUrl, "_blank");
    } else {
      setPreviewInvoice(inv);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full pb-20 antialiased selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <h1 className="text-[36px] font-semibold tracking-tight text-foreground text-balance">
            Payments & Invoices
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 text-pretty">
            Manage project milestones, track payment receipts, and issue branded invoices.
          </p>
        </div>

        {isAgency && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleOpenInvoiceBuilder()}
              aria-label="Create invoice"
              className="active:scale-[0.96] transition-transform h-9 px-3.5 rounded-full border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs flex items-center gap-1.5 shadow-2xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
            >
              <FileText size={16} className="text-brand" aria-hidden="true" />
              <span>Create Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => setCreateMilestoneOpen(true)}
              aria-label="Create new milestone"
              className="active:scale-[0.96] transition-transform h-9 px-4 rounded-full bg-[#00AAF7] text-white font-semibold text-sm flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
            >
              <Plus size={20} weight="bold" aria-hidden="true" />
              <span>New Milestone</span>
            </button>
          </div>
        )}
      </div>

      {/* EvilCharts Radial Financial Breakdown Chart */}
      <PaymentsRadialChart milestones={milestones} formatMoney={formatMoney} />

      {/* Section Tabs: Milestones vs Invoices */}
      <div role="tablist" aria-label="Payments sections" className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/40 w-fit">
        <button
          type="button"
          role="tab"
          id="tab-milestones"
          aria-selected={activeTab === "milestones"}
          aria-controls="panel-milestones"
          onClick={() => setActiveTab("milestones")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden",
            activeTab === "milestones"
              ? "bg-background text-foreground shadow-2xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Milestones ({milestones.length})
        </button>

        <button
          type="button"
          role="tab"
          id="tab-invoices"
          aria-selected={activeTab === "invoices"}
          aria-controls="panel-invoices"
          onClick={() => setActiveTab("invoices")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden flex items-center gap-1.5",
            activeTab === "invoices"
              ? "bg-background text-foreground shadow-2xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>Invoices ({invoices.length})</span>
          {invoices.some((i) => i.status === "payment_submitted") && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* TAB 1: Milestones List Section */}
      {activeTab === "milestones" && (
        <section
          id="panel-milestones"
          role="tabpanel"
          aria-labelledby="tab-milestones"
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              All Scheduled Milestones ({milestones.length})
            </h2>
          </div>

          {milestones.length === 0 ? (
            <MilestonesEmptyState
              isAgency={isAgency}
              onCreateMilestone={() => setCreateMilestoneOpen(true)}
            />
          ) : (
            <div>
              {milestones.map((milestone, index) => (
                <MilestoneItem
                  key={milestone.id}
                  milestone={milestone}
                  paymentRecord={paymentRecordMap.get(milestone.id)}
                  linkedInvoice={milestoneInvoiceMap.get(milestone.id)}
                  pendingProof={pendingProofByMilestone.get(milestone.id)}
                  isAgency={isAgency}
                  formatMoney={formatMoney}
                  onMarkPaid={handleOpenPaymentModal}
                  onDeleteMilestone={handleDeleteMilestone}
                  onGenerateInvoice={handleOpenInvoiceBuilder}
                  onViewInvoice={(inv) => router.push(`/projects/${projectId}/payments/invoices/${inv.id}`)}
                  onReviewProof={(proof) => setReviewProof(proof)}
                  index={index}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: Invoices List Section */}
      {activeTab === "invoices" && (
        <section
          id="panel-invoices"
          role="tabpanel"
          aria-labelledby="tab-invoices"
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              All Project Invoices ({invoices.length})
            </h2>
            {isAgency && invoices.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenInvoiceBuilder()}
                className="h-8 px-3 rounded-lg border border-border/60 hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5 text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
              >
                <Plus size={14} aria-hidden="true" />
                <span>New Invoice</span>
              </button>
            )}
          </div>

          {invoices.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border/80 text-center space-y-3 bg-muted/10">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <FileText size={20} aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  No invoices created yet
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto text-pretty">
                  Issue professional split-pane invoices, sync them with milestones, and send them directly to clients.
                </p>
              </div>
              {isAgency && (
                <button
                  type="button"
                  onClick={() => handleOpenInvoiceBuilder()}
                  className="h-8 px-3.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover inline-flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>Create First Invoice</span>
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden bg-card/20">
              {invoices.map((inv) => {
                const isPaid = inv.status === "paid";
                const isPaymentSubmitted = inv.status === "payment_submitted";
                const isOverdue =
                  inv.status === "overdue" ||
                  (Boolean(inv.dueDate) &&
                    new Date(inv.dueDate).getTime() < Date.now() &&
                    !isPaid &&
                    !isPaymentSubmitted &&
                    inv.status !== "void" &&
                    inv.status !== "draft");
                return (
                  <div
                    key={inv.id}
                    className="p-3.5 sm:px-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    {/* Left: Number, Status & Details */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: inv.themeColor || "#00AAF7" }}
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/projects/${projectId}/payments/invoices/${inv.id}`)}
                            className="text-sm font-bold text-foreground font-mono hover:text-brand transition-colors truncate focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden rounded"
                          >
                            {inv.invoiceNumber}
                          </button>
                          <span
                            className={cn(
                              "px-2 py-0.2 rounded text-[10px] font-semibold tracking-wide uppercase shrink-0",
                              isPaid
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : isPaymentSubmitted
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : isOverdue
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : inv.status === "sent" || inv.status === "viewed"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isPaymentSubmitted ? "Payment Submitted" : isOverdue ? "Overdue" : inv.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          To: {(inv.clientSnapshot as any)?.name || "Client"}
                          {inv.milestoneId && " • Linked to milestone"}
                        </p>
                      </div>
                    </div>

                    {/* Right: Dates, Total & Actions */}
                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end w-full sm:w-auto">
                      <div className="text-right text-xs text-muted-foreground hidden sm:block">
                        <div>
                          Due: {new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>

                      <div className="text-sm font-bold text-foreground font-mono tabular-nums min-w-20 text-right">
                        {formatInvoiceMoney(inv.total, inv.currency)}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAgency && isPaymentSubmitted && (
                          <button
                            type="button"
                            onClick={() => {
                              const p =
                                pendingProofByInvoice.get(inv.id) ||
                                (inv.milestoneId ? pendingProofByMilestone.get(inv.milestoneId) : null);
                              if (p) setReviewProof(p);
                              else toast.info("No pending proof attached.");
                            }}
                            className="h-7 px-2.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-500/30 flex items-center gap-1 transition-colors"
                          >
                            <ShieldCheck size={14} weight="bold" />
                            <span>Review Proof</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => router.push(`/projects/${projectId}/payments/invoices/${inv.id}`)}
                          aria-label={`View invoice ${inv.invoiceNumber}`}
                          className="h-7 px-2.5 rounded-md border border-border/60 hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        >
                          <Eye size={14} className="text-muted-foreground" aria-hidden="true" />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadInvoicePdf(inv)}
                          aria-label={`Download invoice ${inv.invoiceNumber} PDF`}
                          className="h-7 w-7 rounded-md border border-border/60 hover:bg-muted text-foreground flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        >
                          <DownloadSimple size={14} className="text-muted-foreground" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Confirm Payment Drawer */}
      <PaymentConfirmModal formatMoney={formatMoney} isAgency={isAgency} />

      {/* Create Milestone Drawer */}
      <CreateMilestoneModal projectId={projectId} deliverablesList={deliverablesList} />

      {/* Agency Payment Proof Review Modal */}
      <PaymentProofReviewModal
        proof={reviewProof}
        isOpen={!!reviewProof}
        onClose={() => setReviewProof(null)}
      />

      {/* Invoice Document Preview Modal */}
      <InvoicePreviewModal
        invoice={previewInvoice}
        isOpen={!!previewInvoice}
        onClose={() => setPreviewInvoice(null)}
        isAgency={isAgency}
      />
    </div>
  );
}
