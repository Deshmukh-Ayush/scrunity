"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DownloadSimple, X, CheckCircle, PaperPlaneTilt, SpinnerGap, FileText } from "@phosphor-icons/react";
import { InvoiceData } from "@/lib/invoices/types";
import { InvoiceDocumentView, getContrastTextColor } from "./invoice-document-view";

interface InvoicePreviewModalProps {
  invoice: InvoiceData | null;
  isOpen: boolean;
  onClose: () => void;
  isAgency: boolean;
}

export function InvoicePreviewModal({
  invoice,
  isOpen,
  onClose,
  isAgency,
}: InvoicePreviewModalProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const themeColor = invoice.themeColor || "#4F46E5";
  const primaryTextColor = getContrastTextColor(themeColor);

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      if (invoice.pdfUrl) {
        window.open(invoice.pdfUrl, "_blank");
      } else {
        const { generateInvoicePdf } = await import("@/lib/invoices/pdf-generator");
        const pdfBytes = await generateInvoicePdf(invoice);
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Invoice-${invoice.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download invoice PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAction = async (action: "mark_paid" | "send" | "void") => {
    setIsProcessing(true);
    try {
      const res = await axios.patch("/api/invoices", {
        invoiceId: invoice.id,
        action,
      });

      if (res.data.success) {
        toast.success(
          action === "mark_paid"
            ? "Invoice marked as paid!"
            : action === "send"
            ? "Invoice sent to client!"
            : "Invoice voided"
        );
        router.refresh();
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to update invoice";
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-preview-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200"
    >
      <div className="bg-background border border-border/60 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden focus-visible:outline-hidden">
        {/* Modal Top Bar */}
        <div className="px-6 py-3.5 border-b border-border/40 flex items-center justify-between bg-card/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-2xs"
              style={{ backgroundColor: themeColor }}
            >
              <FileText size={16} weight="bold" aria-hidden="true" />
            </div>
            <div>
              <h2 id="invoice-preview-title" className="text-sm font-bold text-foreground">
                Invoice #{invoice.invoiceNumber}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="active:scale-[0.96] transition-transform h-8.5 px-3.5 rounded-xl border border-border/70 bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 shadow-2xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
            >
              {isDownloading ? (
                <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <DownloadSimple size={14} className="text-brand" aria-hidden="true" />
              )}
              <span>Download PDF</span>
            </button>

            {isAgency && invoice.status === "draft" && (
              <button
                type="button"
                onClick={() => handleAction("send")}
                disabled={isProcessing}
                className="active:scale-[0.96] transition-transform h-8.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                style={{ backgroundColor: themeColor, color: primaryTextColor }}
              >
                {isProcessing ? (
                  <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <PaperPlaneTilt size={14} weight="bold" aria-hidden="true" />
                )}
                <span>Send to Client</span>
              </button>
            )}

            {invoice.status !== "paid" && invoice.status !== "void" && (
              <button
                type="button"
                onClick={() => handleAction("mark_paid")}
                disabled={isProcessing}
                className="active:scale-[0.96] transition-transform h-8.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              >
                {isProcessing ? (
                  <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle size={14} weight="bold" aria-hidden="true" />
                )}
                <span>Mark Paid</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice preview"
              className="h-8.5 w-8.5 rounded-xl hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable Document View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-muted/20 flex justify-center">
          <div className="w-full max-w-3xl">
            <InvoiceDocumentView invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  );
}
