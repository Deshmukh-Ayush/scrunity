"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/navigation";
import { SignatureModal } from "./signature-modal";
import { ContractStatusCard } from "./contract-status-card";
import { ContractVaultHeader } from "./contract-vault-header";
import { ContractVaultItem } from "./contract-vault-item";
import { ContractVaultPreviewModal } from "./contract-vault-preview-modal";
import { ContractVaultUploadModal } from "./contract-vault-upload-modal";

import { ContractAIStepper } from "./contract-ai-stepper";
import { ContractAIDrawer } from "./contract-ai-drawer";
import { useAIStore } from "@/store/ai-store";
import posthog from "posthog-js";

import { AiProcessingModal } from "@/components/ui/ai-processing-modal";

export type ContractWithSignatures = {
  contract: {
    id: string;
    projectId: string;
    fileName: string;
    fileUrl: string;
    documentType: "sow" | "nda" | "noc" | "msa" | "addendum" | "other";
    uploadedByRole: "agency" | "client";
    status: "draft" | "sent" | "pending_signature" | "partially_signed" | "fully_signed" | "signed";
    signedDocumentUrl: string | null;
    documentHash: string | null;
    createdAt: Date;
  };
  uploaderName: string;
  signatures: Array<{
    sigId: string;
    userId: string | null;
    userName: string;
    userEmail: string;
    userImage: string | null;
    signedAt: Date | null;
  }>;
};

type ContractVaultClientProps = {
  projectId: string;
  contracts: ContractWithSignatures[];
  currentUserId: string;
  userRole: "owner" | "agency" | "client";
};

const DOC_TYPE_MAP: Record<string, { label: string; tag: string }> = {
  sow: { label: "Statement of Work", tag: "SOW" },
  nda: { label: "Non-Disclosure Agreement", tag: "NDA" },
  noc: { label: "NOC / IP Transfer", tag: "NOC" },
  msa: { label: "Master Services Agreement", tag: "MSA" },
  addendum: { label: "Addendum / Change Order", tag: "ADD" },
  other: { label: "General Agreement", tag: "DOC" },
};

export function ContractVaultClient({
  projectId,
  contracts,
  currentUserId,
  userRole,
}: ContractVaultClientProps) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("sow");
  const [isUploading, setIsUploading] = useState(false);
  const [activePreviewContract, setActivePreviewContract] = useState<ContractWithSignatures | null>(null);
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  const router = useRouter();
  const isAgency = userRole === "owner" || userRole === "agency";

  const [isAiProcessingOpen, setIsAiProcessingOpen] = useState(false);
  const [isAiProcessingComplete, setIsAiProcessingComplete] = useState(false);
  const [lastUploadedContract, setLastUploadedContract] = useState<{ id: string; name: string } | null>(null);

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("projectId", projectId);
    formData.append("documentType", selectedDocType);

    try {
      const res = await axios.post("/api/contracts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data.success) {
        posthog.capture("contract_uploaded", { document_type: selectedDocType });
        toast.success("Document uploaded to vault");
        setIsUploadOpen(false);
        const uploadedContract = res.data.contract;

        // Run AI Scope Extraction with interactive AI Thinking Orb Modal
        if (uploadedContract?.id) {
          setLastUploadedContract({ id: uploadedContract.id, name: uploadedContract.fileName || "Contract PDF" });
          setIsAiProcessingOpen(true);
          setIsAiProcessingComplete(false);

          axios
            .post("/api/ai/extract-contract", { contractId: uploadedContract.id })
            .then((aiRes) => {
              if (aiRes.data.success) {
                toast.success(`✨ Scrunity AI extracted ${aiRes.data.extractedCount} scope clauses!`);
                useAIStore.getState().setTerms(aiRes.data.terms);
                setIsAiProcessingComplete(true);
              }
            })
            .catch(() => {
              toast.error("AI Scope Extraction encountered an issue.");
              setIsAiProcessingOpen(false);
            });
        }

        router.refresh();
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      toast.error(errorObj.response?.data?.error || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm("Are you sure you want to delete this agreement?")) return;
    try {
      const res = await axios.delete(`/api/contracts?contractId=${contractId}`);
      if (res.data.success) {
        toast.success("Agreement deleted");
        router.refresh();
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      toast.error(errorObj.response?.data?.error || "Failed to delete agreement");
    }
  };

  const handleConfirmSignature = async (signatureData: string, method: string) => {
    if (!signingContractId) return;
    try {
      const res = await axios.post("/api/contracts/sign", {
        contractId: signingContractId,
        signatureData,
        signatureMethod: method,
      });
      if (res.data.success) {
        posthog.capture("contract_signed", {
          signature_method: method,
          fully_signed: Boolean(res.data.fullySigned),
        });
        toast.success(
          res.data.fullySigned
            ? "Document fully signed and cryptographic seal generated."
            : "Signature recorded. Waiting for the remaining signers.",
        );
        setIsSignatureModalOpen(false);
        setSigningContractId(null);
        router.refresh();
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: string } } };
      toast.error(errorObj.response?.data?.error || "Failed to sign document");
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full pb-20 antialiased selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Header Bar */}
      <ContractVaultHeader isAgency={isAgency} onOpenUpload={() => setIsUploadOpen(true)} />

      {/* AI Stepper Banner */}
      <ContractAIStepper
        isExtracting={isAiProcessingOpen}
        extractedCount={contracts.length > 0 ? contracts.length * 3 : null}
      />

      {/* Executive Legal Status & Audit Trail Card */}
      <ContractStatusCard
        contracts={contracts}
        currentUserId={currentUserId}
        onSignContract={(contractId) => {
          setSigningContractId(contractId);
          setIsSignatureModalOpen(true);
        }}
        onPreviewContract={(contract) => setActivePreviewContract(contract)}
      />

      {/* Contract Agreements List Section */}
      <section aria-label="Project Agreements Vault" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-tight text-foreground text-balance">
            All Vaulted Agreements (<span className="tabular-nums">{contracts.length}</span>)
          </h2>
        </div>

        {contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/60 bg-muted/20">
            <div className="rounded-full bg-primary/10 p-4 mb-4 text-primary">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-foreground tracking-tight text-balance">No Agreements Vaulted</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md leading-relaxed text-pretty">
              Upload SOWs, NDAs, or Master Services Agreements to collect verified cryptographic e-signatures.
            </p>
          </div>
        ) : (
          <div>
            {contracts.map((item, index) => (
              <ContractVaultItem
                key={item.contract.id}
                item={item}
                currentUserId={currentUserId}
                isAgency={isAgency}
                docTypeMap={DOC_TYPE_MAP}
                index={index}
                onOpenSignModal={(id) => {
                  setSigningContractId(id);
                  setIsSignatureModalOpen(true);
                }}
                onOpenPreview={(c) => setActivePreviewContract(c)}
                onDeleteContract={handleDeleteContract}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upload Modal Component */}
      <ContractVaultUploadModal
        isOpen={isUploadOpen}
        selectedDocType={selectedDocType}
        isUploading={isUploading}
        onClose={() => setIsUploadOpen(false)}
        onDocTypeChange={setSelectedDocType}
        onSubmit={handleUploadSubmit}
      />

      {/* Preview Modal Component */}
      <ContractVaultPreviewModal
        contract={activePreviewContract}
        onClose={() => setActivePreviewContract(null)}
      />

      {/* Signature Modal Component */}
      {signingContractId && (
        <SignatureModal
          isOpen={isSignatureModalOpen}
          onClose={() => {
            setIsSignatureModalOpen(false);
            setSigningContractId(null);
          }}
          onConfirm={handleConfirmSignature}
        />
      )}
      {/* AI Processing Modal */}
      <AiProcessingModal
        isOpen={isAiProcessingOpen}
        isComplete={isAiProcessingComplete}
        title="Scrunity AI Parsing Contract PDF"
        subtitle={`Extracting scope clauses, revision limits, and payment terms from ${lastUploadedContract?.name || "document"}...`}
        onViewResults={() => {
          setIsAiProcessingOpen(false);
          if (lastUploadedContract) {
            useAIStore.getState().openDrawer(lastUploadedContract.id, lastUploadedContract.name);
          }
        }}
        onClose={() => setIsAiProcessingOpen(false)}
      />

      {/* AI Inspector Drawer */}
      <ContractAIDrawer />
    </div>
  );
}
