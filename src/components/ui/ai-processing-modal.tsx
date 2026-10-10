"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThinkingOrb } from "thinking-orbs";
import { CheckCircle2Icon, SparklesIcon, FileTextIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "./button";

interface ProcessingStep {
  id: string;
  label: string;
}

interface AiProcessingModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  steps?: ProcessingStep[];
  isComplete?: boolean;
  onViewResults?: () => void;
  onClose?: () => void;
}

const defaultSteps: ProcessingStep[] = [
  { id: "read", label: "Reading PDF document stream" },
  { id: "analyze", label: "Analyzing scope clauses & exclusions" },
  { id: "extract", label: "Extracting revision limits & payment terms" },
  { id: "persist", label: "Persisting scope terms to contract vault" },
];

const orbStateMap: Array<"searching" | "working" | "solving" | "composing"> = [
  "searching",
  "working",
  "solving",
  "composing",
];

export function AiProcessingModal({
  isOpen,
  title = "Scrunity AI Processing Contract",
  subtitle = "Groq LLM Engine is parsing clauses and setting up scope guardian boundaries...",
  steps = defaultSteps,
  isComplete = false,
  onViewResults,
  onClose,
}: AiProcessingModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      return;
    }

    if (isComplete) {
      setCurrentStepIndex(steps.length - 1);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isOpen, isComplete, steps.length]);

  if (!isOpen) return null;

  const activeOrbState = isComplete
    ? "solving"
    : orbStateMap[currentStepIndex] || "working";

  const progressPercentage = isComplete
    ? 100
    : Math.min(100, Math.round(((currentStepIndex + 1) / steps.length) * 90));

  const currentStepText = steps[currentStepIndex]?.label || "Processing...";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        {/* Backdrop Fade */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-background/95 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95"
        >
          {/* Ambient Glow in Modal Header */}
          <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[#00aff9]/20 blur-3xl" />
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl" />

          {/* Installed ThinkingOrb Canvas Component */}
          <div className="relative mb-6 flex flex-col items-center justify-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-muted/20 border border-border/30 p-2 shadow-inner">
              <ThinkingOrb state={activeOrbState} size={64} theme="auto" />
            </div>

            {/* Document Laser Scanning Simulation Wave */}
            {!isComplete && (
              <div className="relative mt-4 w-full max-w-xs overflow-hidden rounded-lg border border-border/40 bg-muted/40 p-3 text-left shadow-inner">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-1.5">
                  <FileTextIcon className="h-3.5 w-3.5 text-[#00aff9]" />
                  <span className="t-shimmer" data-text={currentStepText.toUpperCase()}>
                    {currentStepText.toUpperCase()}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted/80 rounded-full overflow-hidden relative">
                  <motion.div
                    animate={{
                      x: ["-100%", "100%"],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#00aff9] to-transparent rounded-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Header Title */}
          <div className="text-center space-y-1.5 mb-6">
            <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
              <SparklesIcon className="h-4 w-4 text-[#00aff9] animate-pulse" />
              {isComplete ? "AI Clause Extraction Complete!" : title}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {isComplete
                ? "Scrunity AI has successfully structured the contract clauses, revision rules, and payment terms."
                : subtitle}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between items-center text-[11px] font-mono text-muted-foreground">
              <span>PROGRESS</span>
              <span className="font-semibold text-foreground">{progressPercentage}%</span>
            </div>
            <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-[#00aff9] via-[#8B5CF6] to-[#06B6D4] rounded-full shadow-[0_0_12px_rgba(0,170,247,0.6)]"
              />
            </div>
          </div>

          {/* Step Progression List */}
          <div className="space-y-2 mb-6 bg-muted/30 p-3.5 rounded-2xl border border-border/30">
            {steps.map((step, idx) => {
              const isDone = isComplete || idx < currentStepIndex;
              const isCurrent = !isComplete && idx === currentStepIndex;

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-center gap-2.5 text-xs"
                >
                  <div className="shrink-0">
                    {isDone ? (
                      <CheckCircle2Icon className="h-4 w-4 text-[#00aff9]" />
                    ) : isCurrent ? (
                      <div className="h-4 w-4 rounded-full border-2 border-[#00aff9] border-t-transparent animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-border/60 bg-muted/40" />
                    )}
                  </div>
                  <span
                    className={
                      isDone
                        ? "text-foreground font-medium"
                        : isCurrent
                        ? "text-[#00aff9] font-semibold"
                        : "text-muted-foreground/60"
                    }
                  >
                    {step.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Actions */}
          {isComplete ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              {onViewResults && (
                <Button
                  onClick={onViewResults}
                  className="flex-1 bg-gradient-to-r from-[#00aff9] to-[#0284C7] text-white hover:opacity-95 shadow-lg shadow-[#00aff9]/25 font-semibold text-xs py-5 rounded-xl"
                >
                  <span>Inspect AI Clauses</span>
                  <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              )}
              {onClose && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="rounded-xl text-xs py-5"
                >
                  Done
                </Button>
              )}
            </motion.div>
          ) : (
            <p className="text-[11px] text-center text-muted-foreground/70 font-mono">
              Please wait while Scrunity AI processes your document...
            </p>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
