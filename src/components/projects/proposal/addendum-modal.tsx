"use client";

import Image from "next/image";
import { useState } from "react";
import { SparklesIcon, XIcon, Loader2Icon, CheckCircle2Icon } from "lucide-react";
import type { Addendum } from "@/lib/ai/schemas";
import { ThinkingOrb } from "thinking-orbs";

interface AddendumModalProps {
  isOpen: boolean;
  contractId: string;
  reason: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddendumModal({
  isOpen,
  contractId,
  reason,
  onClose,
  onSuccess,
}: AddendumModalProps) {
  const [addendum, setAddendum] = useState<Addendum | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/generate-addendum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, reason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate addendum");

      setAddendum(data.addendum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate addendum");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveAsProposal() {
    if (!addendum) return;
    setIsSaving(true);
    try {
      // Simulate saving proposal addendum
      await new Promise((resolve) => setTimeout(resolve, 800));
      onSuccess?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-border/40 bg-background p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00AAF7]/10 p-1 border border-[#00AAF7]/20">
              <Image
                src="/logo/scrunity_logo_svg.svg"
                alt="Scrunity AI Logo"
                width={20}
                height={20}
                className="h-4 w-4 object-contain dark:invert"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                AI Change Order Addendum
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Draft formal SOW addendum for scope revision
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        {!addendum && !isGenerating && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/40 p-4 space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                Scope Creep Reason
              </span>
              <p className="text-xs font-medium text-foreground">{reason}</p>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Scrunity AI will analyze your original contract terms and generate a structured Change Order Addendum SOW with line items and pricing estimates.
            </p>

            <button
              onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#00AAF7] py-2.5 text-xs font-semibold text-white shadow-md active:scale-[0.98] transition-transform"
            >
              <SparklesIcon className="h-4 w-4" />
              <span>Generate AI Addendum</span>
            </button>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <ThinkingOrb state="weaving" size={64} theme="auto" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Scrunity AI Drafting SOW Addendum</p>
              <p className="text-[11px] t-shimmer max-w-xs leading-relaxed" data-text="Calculating change order pricing & terms...">
                Calculating change order pricing &amp; terms...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-600">
            {error}
          </div>
        )}

        {addendum && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground">{addendum.title}</h4>
                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {addendum.currency} {addendum.additionalPrice.toLocaleString()}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {addendum.summary}
              </p>

              <div className="border-t border-emerald-500/20 pt-2.5 space-y-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Line Items
                </span>
                {addendum.lineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{item.description}</span>
                    <span className="font-medium text-foreground">
                      {addendum.currency} {item.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-border/40 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsProposal}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#00AAF7] py-2 text-xs font-semibold text-white shadow-md active:scale-[0.98] transition-transform"
              >
                {isSaving ? (
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="h-3.5 w-3.5" />
                )}
                <span>Save Change Order</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
