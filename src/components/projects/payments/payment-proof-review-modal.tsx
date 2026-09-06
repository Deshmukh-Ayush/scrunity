"use client";

import React, { useState } from "react";
import { Drawer } from "vaul";
import { X, Check, ArrowSquareOut, Warning, FilePdf, Image as PhImage, ShieldCheck } from "@phosphor-icons/react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export type PaymentProofItem = {
  id: string;
  invoiceId?: string | null;
  milestoneId?: string | null;
  projectId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  extractedData?: {
    referenceId?: string | null;
    amount?: number | null;
    currency?: string | null;
    paymentDate?: string | null;
    paymentMethod?: string | null;
    bankOrApp?: string | null;
    confidence?: "high" | "medium" | "low";
  } | null;
  status: "pending_review" | "confirmed" | "rejected";
  rejectionReason?: string | null;
  submittedBy: string;
  createdAt: string | Date;
  milestoneTitle?: string;
  milestoneAmount?: number;
  invoiceNumber?: string;
  invoiceTotal?: number;
  currency?: string;
};

interface PaymentProofReviewModalProps {
  proof: PaymentProofItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentProofReviewModal({
  proof,
  isOpen,
  onClose,
}: PaymentProofReviewModalProps) {
  const router = useRouter();

  const [referenceId, setReferenceId] = useState(
    proof?.extractedData?.referenceId || ""
  );
  const [amount, setAmount] = useState<string>(
    proof?.extractedData?.amount
      ? String(proof.extractedData.amount)
      : proof?.milestoneAmount
      ? String(proof.milestoneAmount / 100)
      : proof?.invoiceTotal
      ? String(proof.invoiceTotal / 100)
      : ""
  );
  const [paymentMethod, setPaymentMethod] = useState(
    proof?.extractedData?.paymentMethod || "upi"
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever active proof changes
  React.useEffect(() => {
    if (proof) {
      setReferenceId(proof.extractedData?.referenceId || "");
      setAmount(
        proof.extractedData?.amount
          ? String(proof.extractedData.amount)
          : proof.milestoneAmount
          ? String(proof.milestoneAmount / 100)
          : proof.invoiceTotal
          ? String(proof.invoiceTotal / 100)
          : ""
      );
      setPaymentMethod(proof.extractedData?.paymentMethod || "upi");
      setRejectionReason("");
      setIsRejecting(false);
    }
  }, [proof]);

  if (!proof) return null;

  const isPdf =
    proof.fileType === "application/pdf" ||
    proof.fileName.toLowerCase().endsWith(".pdf");

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await axios.post("/api/payments/proof/review", {
        proofId: proof.id,
        action: "confirm",
        referenceId: referenceId.trim() || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        paymentMethod: paymentMethod.trim() || undefined,
      });

      if (res.data.success) {
        toast.success("Payment confirmed & finalized as paid!");
        onClose();
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || "Failed to confirm payment"
        : "Failed to confirm payment";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please enter a reason for rejecting this payment proof.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axios.post("/api/payments/proof/review", {
        proofId: proof.id,
        action: "reject",
        rejectionReason: rejectionReason.trim(),
      });

      if (res.data.success) {
        toast.info("Payment proof rejected. The client has been prompted to re-upload.");
        onClose();
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error || "Failed to reject proof"
        : "Failed to reject proof";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 transition-opacity" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 max-h-[94vh] h-[94vh] z-50 flex flex-col rounded-t-[24px] bg-background border-t border-border/40 shadow-2xl overflow-hidden focus:outline-hidden">
          <div className="mx-auto w-12 h-1.5 shrink-0 rounded-full bg-muted-foreground/30 my-3" />

          {/* Header */}
          <div className="px-6 pb-4 border-b border-border/40 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-brand" weight="bold" />
                <Drawer.Title className="text-lg font-semibold tracking-tight text-foreground">
                  Review Client Payment Proof
                </Drawer.Title>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Verification Required
                </span>
              </div>
              <Drawer.Description className="text-xs text-muted-foreground mt-0.5">
                Verify the client&apos;s uploaded proof against AI-extracted fields before finalizing payment.
              </Drawer.Description>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body: Side-by-Side View */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
            {/* Left Column: Uploaded Document Viewer (lg:col-span-7) */}
            <div className="lg:col-span-7 h-full bg-muted/20 border-b lg:border-b-0 lg:border-r border-border/40 flex flex-col overflow-hidden">
              <div className="p-3 bg-muted/40 border-b border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2 truncate">
                  {isPdf ? (
                    <FilePdf size={16} className="text-rose-500 shrink-0" weight="fill" />
                  ) : (
                    <PhImage size={16} className="text-blue-500 shrink-0" weight="fill" />
                  )}
                  <span className="font-medium text-foreground truncate max-w-xs">{proof.fileName}</span>
                  <span className="text-[11px] opacity-70">({(proof.fileSize / 1024).toFixed(1)} KB)</span>
                </div>
                <a
                  href={proof.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline shrink-0"
                >
                  <span>Open original</span>
                  <ArrowSquareOut size={13} />
                </a>
              </div>

              <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-neutral-900/5 dark:bg-black/30">
                {isPdf ? (
                  <iframe
                    src={proof.fileUrl}
                    className="w-full h-full rounded-xl border border-border/40 bg-white"
                    title="PDF Proof Preview"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proof.fileUrl}
                    alt="Payment Proof"
                    className="max-h-full max-w-full object-contain rounded-xl shadow-md border border-border/40"
                  />
                )}
              </div>
            </div>

            {/* Right Column: AI Extraction Verification Form (lg:col-span-5) */}
            <div className="lg:col-span-5 h-full overflow-y-auto p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                {/* Confidence banner */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">AI Extraction Confidence</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                        proof.extractedData?.confidence === "high"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : proof.extractedData?.confidence === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {proof.extractedData?.confidence || "Low"} Confidence
                    </span>
                  </div>
                  {proof.extractedData?.bankOrApp && (
                    <p className="text-[11px] text-muted-foreground">
                      Source detected: <strong className="text-foreground">{proof.extractedData.bankOrApp}</strong>
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
                    Target: <strong className="text-foreground">{proof.milestoneTitle || (proof.invoiceNumber ? `Invoice ${proof.invoiceNumber}` : "Invoice")}</strong>
                  </p>
                </div>

                {/* Form Fields for Agency to Confirm / Correct */}
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground block">
                      Transaction / UTR Reference ID
                    </label>
                    <input
                      type="text"
                      value={referenceId}
                      onChange={(e) => setReferenceId(e.target.value)}
                      placeholder="e.g. UPI987654321012"
                      className="w-full h-9 px-3 text-xs rounded-xl border border-border/60 bg-background text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground block">
                        Confirmed Amount ({proof.currency || "INR"})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 25000"
                        className="w-full h-9 px-3 text-xs rounded-xl border border-border/60 bg-background text-foreground font-semibold focus:outline-hidden focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground block">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full h-9 px-2.5 text-xs rounded-xl border border-border/60 bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-brand"
                      >
                        <option value="upi">UPI / Instant Transfer</option>
                        <option value="bank_transfer">Bank Wire / NEFT / IMPS</option>
                        <option value="card">Card / Payment Link</option>
                        <option value="other">Cash / Other</option>
                      </select>
                    </div>
                  </div>

                  {proof.extractedData?.paymentDate && (
                    <div className="text-[11px] text-muted-foreground">
                      Transaction Date Detected: <span className="font-mono text-foreground">{proof.extractedData.paymentDate}</span>
                    </div>
                  )}
                </div>

                {/* Rejection input when toggled */}
                {isRejecting && (
                  <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <Warning size={14} weight="bold" />
                      <span>Reason for Rejection</span>
                    </div>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. UTR number not valid, or transaction amount does not match milestone total."
                      className="w-full p-2 text-xs rounded-lg border border-rose-200 dark:border-rose-900 bg-background text-foreground focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border/40 space-y-2">
                {!isRejecting ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(true)}
                      disabled={isSubmitting}
                      className="h-10 px-4 rounded-xl border border-border/60 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Reject Proof…
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isSubmitting}
                      className="flex-1 h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                    >
                      <Check size={16} weight="bold" />
                      <span>{isSubmitting ? "Confirming…" : "Confirm & Finalize as Paid"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(false)}
                      disabled={isSubmitting}
                      className="h-10 px-4 rounded-xl border border-border/60 hover:bg-muted text-xs font-medium text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={isSubmitting}
                      className="flex-1 h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? "Rejecting…" : "Submit Rejection"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
