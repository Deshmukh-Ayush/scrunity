"use client";

import React, { useState } from "react";
import Link from "next/link";
import { InvoiceData } from "@/lib/invoices/types";
import { InvoiceDocumentView } from "@/components/invoices/invoice-document-view";
import { PaymentConfirmModal } from "@/components/projects/payments/payment-confirm-modal";
import { PaymentProofReviewModal, PaymentProofItem } from "@/components/projects/payments/payment-proof-review-modal";
import {
  ArrowLeft,
  DownloadSimple,
  Printer,
  CloudArrowUp,
  ShieldCheck,
  CheckCircle,
  Clock,
  CreditCard,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface InvoiceViewClientProps {
  invoice: InvoiceData;
  proof?: PaymentProofItem | null;
  projectId: string;
  isAgency: boolean;
}

export function InvoiceViewClient({
  invoice,
  proof,
  projectId,
  isAgency,
}: InvoiceViewClientProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const isPaid = invoice.status === "paid";
  const isPaymentSubmitted = invoice.status === "payment_submitted";
  const isOverdue =
    invoice.status === "overdue" ||
    (Boolean(invoice.dueDate) &&
      new Date(invoice.dueDate).getTime() < Date.now() &&
      !isPaid &&
      !isPaymentSubmitted &&
      invoice.status !== "void" &&
      invoice.status !== "draft");
  const isUnpaid = invoice.status === "sent" || invoice.status === "viewed" || isOverdue;

  const formatMoney = (amountInUnits: number, curr: string = invoice.currency || "INR") => {
    const mainUnits = amountInUnits / 100;
    if (curr === "USD") {
      return `$${mainUnits.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `₹${mainUnits.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (invoice.pdfUrl) {
      window.open(invoice.pdfUrl, "_blank");
    } else {
      window.print();
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] pb-16 bg-neutral-50/50 dark:bg-neutral-900/20">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 pb-6 print:hidden">
          <Link
            href={`/projects/${projectId}/payments`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Payments</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Agency Review CTA */}
            {isAgency && isPaymentSubmitted && (
              <button
                type="button"
                onClick={() => setIsReviewOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 text-xs font-semibold border border-amber-500/30 transition-transform active:scale-[0.96]"
              >
                <ShieldCheck size={15} weight="bold" />
                <span>Review Client Proof</span>
              </button>
            )}

            {/* Client Submit Proof CTA */}
            {!isAgency && isUnpaid && (
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-brand text-white hover:bg-brand-hover text-xs font-semibold shadow-xs transition-transform active:scale-[0.96]"
              >
                <CloudArrowUp size={15} weight="bold" />
                <span>Submit Payment Proof</span>
              </button>
            )}

            {!isAgency && isPaymentSubmitted && (
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-700 dark:text-amber-400 transition-colors"
              >
                <CloudArrowUp size={14} weight="bold" />
                <span>Update Proof</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-foreground text-background hover:bg-foreground/90 text-xs font-medium transition-colors"
            >
              <DownloadSimple size={14} />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Status Notification Banners (print:hidden) */}
        {!isAgency && isUnpaid && (
          <div className={cn(
            "max-w-4xl mx-auto mb-6 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden",
            isOverdue
              ? "border border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400"
              : "border border-brand/20 bg-brand/5"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                isOverdue ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-brand/10 text-brand"
              )}>
                <CreditCard size={18} weight="bold" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">
                  Invoice {isOverdue ? "is Overdue" : "is Awaiting Payment"}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isOverdue ? (
                    <>
                      Payment was due on <strong className="text-foreground">{new Date(invoice.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>. Total outstanding: <strong className="text-foreground">{formatMoney(invoice.total, invoice.currency)}</strong>. Please arrange payment and submit proof immediately.
                    </>
                  ) : (
                    <>
                      Total due: <strong className="text-foreground">{formatMoney(invoice.total, invoice.currency)}</strong>. Once paid via bank transfer or UPI, submit your payment proof for verification.
                    </>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className={cn(
                "h-8 px-4 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-transform active:scale-[0.96] shrink-0",
                isOverdue ? "bg-rose-600 hover:bg-rose-700" : "bg-brand text-white hover:bg-brand-hover"
              )}
            >
              <CloudArrowUp size={14} weight="bold" />
              <span>Submit Proof</span>
            </button>
          </div>
        )}

        {!isAgency && isPaymentSubmitted && (
          <div className="max-w-4xl mx-auto mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock size={18} weight="bold" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-foreground">Payment Proof Submitted</h3>
                  <span className="px-2 py-0.2 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                    Awaiting Agency Verification
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {proof?.fileName ? `Uploaded file: ${proof.fileName} • ` : ""}
                  Your proof is being reviewed by the agency. Once verified, this invoice will be marked as paid.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="h-7 px-3 rounded-lg border border-border/70 hover:bg-muted text-xs font-medium text-foreground transition-colors shrink-0"
            >
              Upload New Proof
            </button>
          </div>
        )}

        {isPaid && (
          <div className="max-w-4xl mx-auto mb-6 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3 print:hidden">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle size={16} weight="bold" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Invoice Paid in Full</h3>
              <p className="text-[11px] text-muted-foreground">
                Payment was confirmed on {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "record"}.
              </p>
            </div>
          </div>
        )}

        {isAgency && isPaymentSubmitted && (
          <div className="max-w-4xl mx-auto mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} weight="bold" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">Client Submitted Payment Proof</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {proof?.fileName ? `File: ${proof.fileName} • ` : ""}
                  Verify payment OCR details against bank records and finalize as paid.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              className="h-8 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-transform active:scale-[0.96] shrink-0"
            >
              <ShieldCheck size={14} weight="bold" />
              <span>Review Proof</span>
            </button>
          </div>
        )}

        {/* The Invoice Document */}
        <InvoiceDocumentView invoice={invoice} className="max-w-4xl mx-auto" />

        {/* Reused Shared Payment Confirmation / Upload Modal */}
        <PaymentConfirmModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          target={{
            invoiceId: invoice.id,
            milestoneId: invoice.milestoneId || null,
            title: `Invoice ${invoice.invoiceNumber}`,
            amount: invoice.total,
            currency: invoice.currency,
            projectId,
          }}
          formatMoney={formatMoney}
          isAgency={isAgency}
        />

        {/* Reused Agency Payment Proof Review Modal */}
        {proof && (
          <PaymentProofReviewModal
            proof={proof}
            isOpen={isReviewOpen}
            onClose={() => setIsReviewOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
