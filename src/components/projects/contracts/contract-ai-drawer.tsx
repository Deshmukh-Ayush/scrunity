"use client";

import Image from "next/image";
import { useEffect } from "react";
import axios from "axios";
import { useAIStore } from "@/store/ai-store";
import { ContractAIDrawerTabs } from "./contract-ai-drawer-tabs";
import { ContractAIDrawerContent } from "./contract-ai-drawer-content";
import { XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ThinkingOrb } from "thinking-orbs";

export function ContractAIDrawer() {
  const {
    isOpen,
    activeContractId,
    activeContractName,
    activeTab,
    terms,
    isLoading,
    error,
    closeDrawer,
    setActiveTab,
    setTerms,
    setLoading,
    setError,
  } = useAIStore();

  useEffect(() => {
    if (isOpen && activeContractId) {
      setLoading(true);
      axios
        .get(`/api/ai/extract-contract?contractId=${activeContractId}`)
        .then((res) => {
          if (res.data.success && res.data.terms) {
            setTerms(res.data.terms);
          } else {
            setError("No clauses extracted for this contract yet.");
          }
        })
        .catch((err) => {
          setError(err.response?.data?.error || "Failed to load contract clauses.");
        });
    }
  }, [isOpen, activeContractId, setLoading, setTerms, setError]);

  if (!isOpen) return null;

  const scopeCount = terms?.scopeItems.length ?? 0;
  const exclusionsCount = terms?.exclusions.length ?? 0;
  const revisionsCount = terms?.revisionLimits.length ?? 0;
  const paymentCount = terms?.paymentTerms.length ?? 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeDrawer}
          className="absolute inset-0"
        />

        {/* Slide-over Drawer Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="relative flex h-full w-full max-w-md flex-col bg-background p-6 shadow-2xl border-l border-border/40"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00AAF7]/10 p-1 dark:bg-[#00AAF7]/20 border border-[#00AAF7]/20">
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
                  AI Clause Inspector
                </h3>
                <p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                  {activeContractName || "Contract Terms"}
                </p>
              </div>
            </div>

            <button
              onClick={closeDrawer}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground text-center">
                <ThinkingOrb state="searching" size={64} theme="auto" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Scrunity AI Analyzing Clauses</p>
                  <p className="text-[11px] t-shimmer max-w-[220px]" data-text="Reading PDF stream & structuring terms...">
                    Reading PDF stream &amp; structuring terms...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                Failed to load contract terms: {error}
              </div>
            )}

            {terms && !isLoading && (
              <>
                <ContractAIDrawerTabs
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  scopeCount={scopeCount}
                  exclusionsCount={exclusionsCount}
                  revisionsCount={revisionsCount}
                  paymentCount={paymentCount}
                />

                <ContractAIDrawerContent activeTab={activeTab} terms={terms} />
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
