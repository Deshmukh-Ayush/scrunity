"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  CopyIcon,
  CheckIcon,
  DownloadSimpleIcon,
  EyeIcon,
  PenNibIcon,
} from "@phosphor-icons/react";
import type { ContractWithSignatures } from "./contract-vault-client";

export type ContractStatusCardProps = {
  contracts: ContractWithSignatures[];
  currentUserId: string;
  onSignContract: (contractId: string) => void;
  onPreviewContract?: (contract: ContractWithSignatures) => void;
};

const DOC_TYPE_MAP: Record<string, { label: string; tag: string }> = {
  sow: { label: "Statement of Work", tag: "SOW" },
  nda: { label: "Non-Disclosure Agreement", tag: "NDA" },
  noc: { label: "NOC / IP Transfer", tag: "NOC" },
  msa: { label: "Master Services Agreement", tag: "MSA" },
  addendum: { label: "Addendum / Change Order", tag: "ADD" },
  other: { label: "General Agreement", tag: "DOC" },
};

export function ContractStatusCard({
  contracts,
  currentUserId,
  onSignContract,
  onPreviewContract,
}: ContractStatusCardProps) {
  // Default to the first contract that requires the current user's signature, or fallback to the first contract
  const initialIndex = contracts.findIndex((c) => {
    const isSigned = c.contract.status === "signed" || c.contract.status === "fully_signed";
    if (isSigned) return false;
    const mySig = c.signatures.find((s) => s.userId === currentUserId);
    return mySig && !mySig.signedAt;
  });

  const [selectedIndex, setSelectedIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0
  );
  const [copiedHash, setCopiedHash] = useState(false);

  if (contracts.length === 0) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-md border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide py-0.5 px-1">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-500" /> Executive Legal Status & Audit Trail
        </span>
        <div className="rounded-md bg-white p-6 dark:bg-neutral-950 flex flex-col items-center justify-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3">
            <FileTextIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No legal agreements vaulted</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md">
            Upload a Statement of Work (SOW) or NDA above to track digital execution and cryptographic audit trails.
          </p>
        </div>
      </div>
    );
  }

  const selected = contracts[selectedIndex] || contracts[0];
  const contract = selected.contract;
  const isFullySigned = contract.status === "signed" || contract.status === "fully_signed";
  const isPartiallySigned = contract.status === "partially_signed";
  const isDraft = contract.status === "draft";
  const isPending = contract.status === "pending_signature" || contract.status === "sent";

  const typeConfig = DOC_TYPE_MAP[contract.documentType] || {
    label: "Agreement",
    tag: "DOC",
  };

  const mySignature = selected.signatures.find((s) => s.userId === currentUserId);
  const needsMySignature =
    !isFullySigned && !isDraft && mySignature && !mySignature.signedAt;

  const handleCopyHash = () => {
    if (!contract.documentHash) return;
    navigator.clipboard.writeText(contract.documentHash);
    setCopiedHash(true);
    toast.success("Cryptographic SHA-256 hash copied to clipboard");
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900">
      {/* Header bar */}
      <div className="flex items-center justify-between py-0.5 px-1">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-500" /> Executive Legal Status & Audit Trail
        </span>

        {/* Multi-contract selector pills if > 1 contract */}
        {contracts.length > 1 && (
          <div className="flex items-center gap-1.5">
            {contracts.map((c, idx) => {
              const tag = DOC_TYPE_MAP[c.contract.documentType]?.tag || `DOC ${idx + 1}`;
              const isCurrent = idx === selectedIndex;
              return (
                <button
                  key={c.contract.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-full transition-colors ${
                    isCurrent
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Card Content */}
      <div className="rounded-md bg-white p-5 dark:bg-neutral-950 flex flex-col gap-5">
        {/* Document Header & Execution Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-muted text-foreground border border-border/40">
                {typeConfig.tag}
              </span>
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                {typeConfig.label}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {contract.fileName} · Uploaded by{" "}
              <span className="font-medium text-foreground">{selected.uploaderName}</span> on{" "}
              {format(new Date(contract.createdAt), "MMM d, yyyy")}
            </p>
          </div>

          {/* Primary Status Badge */}
          <div className="self-start sm:self-center">
            {isFullySigned && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="h-4 w-4" /> Fully Executed & Sealed
              </span>
            )}
            {isPartiallySigned && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <ClockIcon className="h-4 w-4" /> Partially Signed (1/2 Signatures)
              </span>
            )}
            {isPending && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <ClockIcon className="h-4 w-4" /> Awaiting Signatures
              </span>
            )}
            {isDraft && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-500/10 border border-neutral-500/20 px-3 py-1 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                <FileTextIcon className="h-4 w-4" /> Draft Agreement
              </span>
            )}
          </div>
        </div>

        {/* Signer Progress & Audit Trail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Required Signatories
            </span>
            <div className="space-y-2">
              {selected.signatures.length === 0 ? (
                <p className="text-xs text-muted-foreground">No signatories assigned yet.</p>
              ) : (
                selected.signatures.map((sig) => {
                  const signed = Boolean(sig.signedAt);
                  return (
                    <div
                      key={sig.sigId}
                      className="flex items-center justify-between p-2.5 rounded-md border border-border/30 bg-muted/20"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                          {sig.userName?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {sig.userName}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {sig.userEmail}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {signed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            {format(new Date(sig.signedAt!), "MMM d, HH:mm")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                            <ClockIcon className="h-3.5 w-3.5" /> Awaiting
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cryptographic Hash & Verification */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Cryptographic Integrity
            </span>
            <div className="p-3 rounded-md border border-border/30 bg-muted/20 flex flex-col justify-between h-[calc(100%-24px)] gap-2">
              <div>
                <p className="text-xs font-medium text-foreground">
                  SHA-256 Document Fingerprint
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono break-all line-clamp-2">
                  {contract.documentHash || "Hash generation pending document sealing"}
                </p>
              </div>

              {contract.documentHash && (
                <div className="pt-2 border-t border-border/20 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Tamper-evident legal audit log
                  </span>
                  <button
                    onClick={handleCopyHash}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:text-brand transition-colors"
                  >
                    {copiedHash ? (
                      <>
                        <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="h-3.5 w-3.5" />
                        <span>Copy Hash</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            {onPreviewContract && (
              <button
                onClick={() => onPreviewContract(selected)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border/60 bg-background text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <EyeIcon className="h-3.5 w-3.5" />
                <span>Preview</span>
              </button>
            )}

            <a
              href={contract.signedDocumentUrl || contract.fileUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border/60 bg-background text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              <DownloadSimpleIcon className="h-3.5 w-3.5" />
              <span>{isFullySigned ? "Download Signed PDF" : "Download PDF"}</span>
            </a>
          </div>

          {needsMySignature && (
            <button
              onClick={() => onSignContract(contract.id)}
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md bg-brand text-xs font-semibold text-white hover:bg-brand-hover active:scale-[0.97] transition-all shadow-xs"
            >
              <PenNibIcon className="h-3.5 w-3.5" />
              <span>Sign Agreement</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
