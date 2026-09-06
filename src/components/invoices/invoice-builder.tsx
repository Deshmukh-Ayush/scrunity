"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Trash,
  DownloadSimple,
  PaperPlaneTilt,
  FloppyDisk,
  CaretDown,
  X,
  SpinnerGap,
  Image as PhImage,
  PenNib,
  Columns,
  Eye,
  PencilSimple,
  TextAa,
} from "@phosphor-icons/react";
import {
  InvoiceData,
  InvoiceLineItemData,
  BillingDetailRow,
  CustomField,
  PaymentInfoRow,
  calculateInvoiceTotals,
  formatInvoiceMoney,
} from "@/lib/invoices/types";
import { InvoiceDocumentView, getContrastTextColor } from "./invoice-document-view";
import { cn } from "@/lib/utils";

interface InvoiceBuilderProps {
  projectId: string;
  projectName?: string;
  projectCurrency?: "USD" | "INR";
  initialMilestoneId?: string | null;
  initialMilestone?: {
    id: string;
    title: string;
    amount: number;
    currency: string;
    dueDate?: string | Date | null;
  } | null;
  onSuccess?: () => void;
  onClose?: () => void;
}

const THEME_COLORS = [
  { label: "Indigo Brand", value: "#4F46E5" },
  { label: "Scrunity Blue", value: "#00AAF7" },
  { label: "Emerald", value: "#10B981" },
  { label: "Violet", value: "#8B5CF6" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Charcoal", value: "#1E293B" },
];

const FONT_OPTIONS = [
  { label: "Sans (Modern)", value: "sans" },
  { label: "Serif (Classic)", value: "serif" },
  { label: "Mono (Technical)", value: "mono" },
];

export function InvoiceBuilder({
  projectId,
  projectName,
  projectCurrency,
  initialMilestoneId,
  initialMilestone,
  onSuccess,
  onClose,
}: InvoiceBuilderProps) {
  const router = useRouter();

  // Layout View Mode: "both" (Split Pane) | "form" (Form Only) | "preview" (Preview Only)
  const [viewMode, setViewMode] = useState<"both" | "form" | "preview">("both");

  // Loading States
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);

  // Accordion open states (single or multi expand)
  const [openSection, setOpenSection] = useState<string>("company");

  const toggleSection = (key: string) => {
    setOpenSection((prev) => (prev === key ? "" : key));
  };

  // Add Item Modal State with Smooth Enter & Exit
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAddItemVisible, setIsAddItemVisible] = useState(false);

  const openAddItemModal = () => {
    setIsAddItemOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAddItemVisible(true);
      });
    });
  };

  const closeAddItemModal = () => {
    setIsAddItemVisible(false);
    setTimeout(() => {
      setIsAddItemOpen(false);
    }, 180);
  };

  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState("");

  // Invoice Form State
  const [prefix, setPrefix] = useState("INV-");
  const [serialNumber, setSerialNumber] = useState<number>(1);
  const [currency, setCurrency] = useState<"USD" | "INR">(
    projectCurrency || (initialMilestone?.currency as "USD" | "INR") || "USD"
  );
  const [themeColor, setThemeColor] = useState("#4F46E5");
  const [fontFamily, setFontFamily] = useState<string>("sans");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // default Net 14
    return d.toISOString().split("T")[0];
  });
  const [paymentTerms, setPaymentTerms] = useState<string>("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    initialMilestoneId || null
  );

  // Snapshots State
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [companyCustomFields, setCompanyCustomFields] = useState<CustomField[]>([]);

  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [contactMethod, setContactMethod] = useState<"email" | "phone">("email");
  const [clientCustomFields, setClientCustomFields] = useState<CustomField[]>([]);

  // Billing Adjustments & Line Items
  const [billingDetails, setBillingDetails] = useState<BillingDetailRow[]>([]);
  const [lineItems, setLineItems] = useState<InvoiceLineItemData[]>([]);

  // Additional Information
  const [notes, setNotes] = useState("");
  const [additionalTerms, setAdditionalTerms] = useState("");
  const [paymentInformation, setPaymentInformation] = useState<PaymentInfoRow[]>([]);

  // Project milestones list for linking
  const [availableMilestones, setAvailableMilestones] = useState<
    Array<{ id: string; title: string; amount: number; currency: string; dueDate: any; status: string }>
  >([]);

  // 1. Fetch Organization Defaults & Project Prefill Context
  useEffect(() => {
    async function loadDefaults() {
      try {
        setIsLoadingDefaults(true);
        const res = await axios.get(
          `/api/invoices?projectId=${projectId}&getDefaults=true`
        );
        if (res.data.success) {
          const { defaults, clientPrefill, milestones } = res.data;

          setPrefix(defaults.defaultPrefix || "INV-");
          setSerialNumber(defaults.nextSerial || 1);
          setCompanyName(defaults.companyName || "My Agency");
          setCompanyAddress(defaults.companyAddress || "");
          setCompanyEmail(defaults.companyEmail || "");
          setCompanyPhone(defaults.companyPhone || "");
          setLogoUrl(defaults.logoUrl || null);
          setSignatureUrl(defaults.signatureUrl || null);
          setPaymentInformation(defaults.defaultPaymentInfo || []);
          setNotes("");
          setPaymentTerms("");
          setCompanyCustomFields(defaults.defaultCustomFields || []);

          setClientName(clientPrefill.name || "");
          setClientEmail(clientPrefill.email || "");
          setClientPhone(clientPrefill.phone || "");
          setClientAddress(clientPrefill.address || "");
          if (clientPrefill.contactMethod) {
            setContactMethod(clientPrefill.contactMethod);
          }

          setAvailableMilestones(milestones || []);

          // If launched from milestone, seed item from milestone
          if (initialMilestone) {
            setSelectedMilestoneId(initialMilestone.id);
            setCurrency((initialMilestone.currency as "USD" | "INR") || "INR");
            setLineItems([
              {
                id: crypto.randomUUID(),
                itemName: initialMilestone.title || "Project Milestone",
                description: `Payment for milestone: ${initialMilestone.title}`,
                quantity: 1,
                unitPrice: initialMilestone.amount,
                lineTotal: initialMilestone.amount,
              },
            ]);
            if (initialMilestone.dueDate) {
              setDueDate(
                new Date(initialMilestone.dueDate).toISOString().split("T")[0]
              );
            }
          } else if (milestones && milestones.length > 0) {
            const firstUpcoming = milestones.find((m: any) => m.status === "upcoming" || m.status === "due");
            if (firstUpcoming) {
              setCurrency((firstUpcoming.currency as "USD" | "INR") || "INR");
              setLineItems([
                {
                  id: crypto.randomUUID(),
                  itemName: firstUpcoming.title,
                  description: "Project Deliverable & Services",
                  quantity: 1,
                  unitPrice: firstUpcoming.amount,
                  lineTotal: firstUpcoming.amount,
                },
              ]);
            }
          } else {
            // Default seed item
            setLineItems([
              {
                id: crypto.randomUUID(),
                itemName: "Design & Development Services",
                description: "Milestone scope and deliverables",
                quantity: 1,
                unitPrice: 500000,
                lineTotal: 500000,
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Failed to load invoice defaults:", err);
        toast.error("Unable to load organization defaults");
      } finally {
        setIsLoadingDefaults(false);
      }
    }

    loadDefaults();
  }, [projectId, initialMilestone]);

  // Handle Milestone Selection Change
  const handleMilestoneSelect = (milestoneId: string) => {
    if (!milestoneId) {
      setSelectedMilestoneId(null);
      return;
    }
    const ms = availableMilestones.find((m) => m.id === milestoneId);
    if (!ms) return;

    setSelectedMilestoneId(ms.id);
    setCurrency((ms.currency as "USD" | "INR") || "INR");
    if (ms.dueDate) {
      setDueDate(new Date(ms.dueDate).toISOString().split("T")[0]);
    }
    setLineItems([
      {
        id: crypto.randomUUID(),
        itemName: ms.title,
        description: `Payment for milestone: ${ms.title}`,
        quantity: 1,
        unitPrice: ms.amount,
        lineTotal: ms.amount,
      },
    ]);
  };

  // Image Upload Handlers
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: "logo" | "signature"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isLogo = assetType === "logo";
    if (isLogo) setUploadingLogo(true);
    else setUploadingSig(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetType", assetType);

      const res = await axios.post("/api/invoices/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        if (isLogo) {
          setLogoUrl(res.data.url);
          toast.success("Logo uploaded successfully");
        } else {
          setSignatureUrl(res.data.url);
          toast.success("Signature uploaded successfully");
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to upload image";
      toast.error(msg);
    } finally {
      if (isLogo) setUploadingLogo(false);
      else setUploadingSig(false);
    }
  };

  // Custom Fields Handlers
  const addCompanyCustomField = () => {
    setCompanyCustomFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "Tax ID / GSTIN", value: "" },
    ]);
  };

  const removeCompanyCustomField = (id: string) => {
    setCompanyCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const addClientCustomField = () => {
    setClientCustomFields((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "Client VAT / Tax ID", value: "" },
    ]);
  };

  const removeClientCustomField = (id: string) => {
    setClientCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  // Billing Details Handlers
  const addBillingRow = (type: "percentage" | "fixed") => {
    setBillingDetails((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: type === "percentage" ? "GST / Tax" : "Discount",
        type,
        value: type === "percentage" ? 18 : 0,
      },
    ]);
  };

  const removeBillingRow = (id: string) => {
    setBillingDetails((prev) => prev.filter((b) => b.id !== id));
  };

  // Payment Info Handlers
  const addPaymentInfoRow = () => {
    setPaymentInformation((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "UPI ID / Wire", value: "" },
    ]);
  };

  const removePaymentInfoRow = (id: string) => {
    setPaymentInformation((prev) => prev.filter((p) => p.id !== id));
  };

  // Add Item to Line Items
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      toast.error("Enter an item name");
      return;
    }

    const priceNum = parseFloat(newItemPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Enter a valid unit price");
      return;
    }

    const unitPriceInUnits = Math.round(priceNum * 100);
    const qty = Math.max(1, newItemQty);

    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        itemName: newItemName.trim(),
        description: newItemDesc.trim() || null,
        quantity: qty,
        unitPrice: unitPriceInUnits,
        lineTotal: qty * unitPriceInUnits,
      },
    ]);

    setNewItemName("");
    setNewItemDesc("");
    setNewItemQty(1);
    setNewItemPrice("");
    closeAddItemModal();
  };

  const removeItem = (id?: string) => {
    if (!id) return;
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Current Live Invoice Object for Live Preview
  const formattedSerial = String(serialNumber || 1).padStart(3, "0");
  const invoiceNumber = `${prefix.trim() || "INV-"}${formattedSerial}`;

  const currentTotals = calculateInvoiceTotals(lineItems, billingDetails);
  const primaryTextColor = getContrastTextColor(themeColor);

  const liveInvoice: InvoiceData = {
    id: "preview-temp",
    projectId,
    organizationId: "preview-org",
    milestoneId: selectedMilestoneId,
    invoiceNumber,
    prefix: prefix.trim() || "INV-",
    serialNumber: Number(serialNumber) || 1,
    currency,
    themeColor,
    fontFamily,
    invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
    dueDate: dueDate ? new Date(dueDate) : new Date(),
    paymentTerms,
    companySnapshot: {
      name: companyName,
      address: companyAddress,
      email: companyEmail,
      phone: companyPhone,
      logoUrl,
      signatureUrl,
      customFields: companyCustomFields,
    },
    clientSnapshot: {
      name: clientName,
      address: clientAddress,
      email: clientEmail,
      phone: clientPhone,
      contactMethod,
      customFields: clientCustomFields,
    },
    billingDetails,
    lineItems,
    notes,
    additionalTerms,
    paymentInformation,
    subtotal: currentTotals.subtotal,
    total: currentTotals.total,
    status: "draft",
    createdAt: new Date(),
  };

  // Save / Send Handler
  const handleSubmit = async (action: "save_draft" | "send") => {
    if (!companyName.trim()) {
      toast.error("Enter your company name before saving");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Enter your client's name before saving");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Add at least one line item before sending");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        projectId,
        milestoneId: selectedMilestoneId || null,
        prefix: prefix.trim() || "INV-",
        serialNumber: Number(serialNumber) || 1,
        currency,
        themeColor,
        invoiceDate,
        dueDate,
        paymentTerms,
        companySnapshot: {
          name: companyName.trim(),
          logoUrl,
          signatureUrl,
          address: companyAddress.trim() || null,
          email: companyEmail.trim() || null,
          phone: companyPhone.trim() || null,
          customFields: companyCustomFields.filter((f) => f.label && f.value),
        },
        clientSnapshot: {
          name: clientName.trim(),
          address: clientAddress.trim() || null,
          email: clientEmail.trim() || null,
          phone: clientPhone.trim() || null,
          contactMethod,
          customFields: clientCustomFields.filter((f) => f.label && f.value),
        },
        billingDetails: billingDetails.filter((b) => b.label && b.value !== undefined),
        lineItems: lineItems.map((item) => ({
          itemName: item.itemName,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: notes.trim() || null,
        additionalTerms: additionalTerms.trim() || null,
        paymentInformation: paymentInformation.filter((p) => p.label && p.value),
        action,
      };

      const res = await axios.post("/api/invoices", payload);

      if (res.data.success) {
        toast.success(
          action === "send"
            ? `Invoice ${res.data.invoiceNumber} sent to client!`
            : `Invoice ${res.data.invoiceNumber} saved as draft.`
        );
        router.refresh();
        if (onSuccess) onSuccess();
        else if (onClose) onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to save invoice";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Direct PDF from Generator
  const handleDirectPdfDownload = async () => {
    setIsDownloadingPdf(true);
    try {
      const { generateInvoicePdf } = await import("@/lib/invoices/pdf-generator");
      const pdfBytes = await generateInvoicePdf(liveInvoice);
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoadingDefaults) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[550px] space-y-4">
        <SpinnerGap size={32} className="animate-spin text-brand" />
        <p className="text-sm font-medium text-muted-foreground">
          Loading invoice workspace...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background selection:bg-brand/20">
      {/* TOP APP BAR: Title, Mode View Controls & Primary Actions */}
      <header className="h-16 px-4 sm:px-6 border-b border-border/40 bg-card/80 backdrop-blur-md flex items-center justify-between gap-4 shrink-0 z-20">
        {/* Left Title */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
            style={{ backgroundColor: themeColor }}
          >
            <FileText size={20} weight="bold" aria-hidden="true" />
          </div>
          <div>
            <h1 id="invoice-builder-title" className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Create Invoice</span>
              {projectName && (
                <span className="text-xs font-normal text-muted-foreground hidden md:inline">
                  • {projectName}
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Right Actions & View Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Split Mode Toggle Button Group */}
          <div className="hidden sm:flex items-center rounded-lg bg-muted/60 p-0.5 border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("form")}
              aria-pressed={viewMode === "form"}
              className={cn(
                "ps-2 pe-2.5 py-1 rounded-md font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96] flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden",
                viewMode === "form"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PencilSimple size={14} aria-hidden="true" />
              <span>Form</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("both")}
              aria-pressed={viewMode === "both"}
              className={cn(
                "ps-2 pe-2.5 py-1 rounded-md font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96] flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden",
                viewMode === "both"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Columns size={14} aria-hidden="true" />
              <span>Both</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              aria-pressed={viewMode === "preview"}
              className={cn(
                "ps-2 pe-2.5 py-1 rounded-md font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96] flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden",
                viewMode === "preview"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Eye size={14} aria-hidden="true" />
              <span>Preview</span>
            </button>
          </div>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDirectPdfDownload}
            disabled={isDownloadingPdf}
            className="active:scale-[0.96] transition-transform duration-150 ease-out h-9 px-3.5 rounded-xl border border-border/70 bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 shadow-2xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
          >
            {isDownloadingPdf ? (
              <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <DownloadSimple size={14} className="text-brand" aria-hidden="true" />
            )}
            <span>Download PDF</span>
          </button>

          {/* Send to Client Primary Button */}
          <button
            type="button"
            onClick={() => handleSubmit("send")}
            disabled={isSubmitting}
            className="active:scale-[0.96] transition-transform duration-150 ease-out h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
            style={{ backgroundColor: themeColor, color: primaryTextColor }}
          >
            {isSubmitting ? (
              <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <PaperPlaneTilt size={14} weight="bold" aria-hidden="true" />
            )}
            <span>Send Invoice</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice builder"
              className="h-9 w-9 rounded-xl hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-[0.96] transition-transform duration-150 ease-out ml-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* TEMPLATE CUSTOMIZATION STRIP: Logo, Font & Accent Color */}
      <div className="px-4 sm:px-6 py-2.5 bg-card/40 border-b border-border/30 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/scrunity_logo_svg.svg"
            alt="Scrunity"
            className="h-5 opacity-60"
          />
          <span className="text-[11px] text-muted-foreground font-medium">Invoice Builder</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Font Selector */}
          <div className="flex items-center gap-1.5">
            <TextAa size={14} className="text-muted-foreground" aria-hidden="true" />
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              aria-label="Invoice typography font family"
              className="h-7 px-2 text-xs rounded-md bg-background border border-border/60 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Accent Color Palette */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Brand accent colors">
            {THEME_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setThemeColor(c.value)}
                title={c.label}
                aria-label={`Select ${c.label} color theme`}
                aria-pressed={themeColor === c.value}
                className={cn(
                  "w-4 h-4 rounded-full transition-all duration-150 ease-out active:scale-[0.90] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden",
                  themeColor === c.value
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                    : "opacity-60 hover:opacity-100 hover:scale-105"
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* MAIN SPLIT-PANE WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: Form Accordions */}
        {(viewMode === "both" || viewMode === "form") && (
          <div
            className={cn(
              "border-r border-border/40 flex flex-col h-full bg-card/20 overflow-y-auto",
              viewMode === "both" ? "w-full lg:w-[480px] xl:w-[540px] shrink-0" : "w-full max-w-4xl mx-auto"
            )}
          >
            <div className="p-4 sm:p-6 space-y-3.5 flex-1">
              {/* Optional Milestone Picker */}
              {availableMilestones.length > 0 && (
                <div className="bg-muted/30 rounded-xl p-3 border border-border/40 space-y-1.5">
                  <label htmlFor="milestone-select" className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                    <span>Link Project Milestone</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      Auto-fills amount & due date
                    </span>
                  </label>
                  <select
                    id="milestone-select"
                    value={selectedMilestoneId || ""}
                    onChange={(e) => handleMilestoneSelect(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs rounded-lg bg-background border border-border/60 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                  >
                    <option value="">-- Standalone Invoice (No Milestone) --</option>
                    {availableMilestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({formatInvoiceMoney(m.amount, m.currency as any)}) • {m.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ACCORDION 1: Company Details */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("company")}
                  aria-expanded={openSection === "company"}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/20 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                >
                  <span
                    className={cn(
                      "text-xs font-bold tracking-tight",
                      openSection === "company" ? "text-brand" : "text-foreground"
                    )}
                  >
                    Company Details
                  </span>
                  <CaretDown
                    size={16}
                    className={cn(
                      "text-muted-foreground transition-transform duration-200 ease-out",
                      openSection === "company" && "rotate-180 text-brand"
                    )}
                    aria-hidden="true"
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    openSection === "company" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-border/20 text-xs">
                      {/* Two Equal Upload Cards: Company Logo & Company Signature (Invoicely Style) */}
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        {/* Company Logo Card */}
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-semibold text-foreground block">
                            Company Logo
                          </span>
                          <div className="h-32 border-2 border-dashed border-border/70 hover:border-brand/60 rounded-xl p-3 flex flex-col items-center justify-center text-center bg-muted/10 hover:bg-muted/30 transition-[border-color,background-color] duration-150 ease-out relative">
                          {logoUrl ? (
                            <div className="flex flex-col items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={logoUrl}
                                alt="Company logo preview"
                                className="h-12 max-w-[120px] object-contain rounded ring-1 ring-black/10 dark:ring-white/10"
                              />
                              <button
                                type="button"
                                onClick={() => setLogoUrl(null)}
                                aria-label="Remove company logo"
                                className="text-[10px] text-destructive hover:underline flex items-center gap-1 font-medium focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-hidden"
                              >
                                <Trash size={12} aria-hidden="true" /> Remove
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center gap-1.5 w-full h-full justify-center">
                              <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground">
                                <PhImage size={16} aria-hidden="true" />
                              </div>
                              <span className="text-[11px] font-semibold text-foreground">
                                {uploadingLogo ? "Uploading..." : "Select Image"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Type: logo
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, "logo")}
                                disabled={uploadingLogo}
                                className="hidden"
                                aria-label="Upload company logo image"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Company Signature Card */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-foreground block">
                          Company Signature
                        </span>
                        <div className="h-32 border-2 border-dashed border-border/70 hover:border-brand/60 rounded-xl p-3 flex flex-col items-center justify-center text-center bg-muted/10 hover:bg-muted/30 transition-[border-color,background-color] duration-150 ease-out relative">
                          {signatureUrl ? (
                            <div className="flex flex-col items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={signatureUrl}
                                alt="Company signature preview"
                                className="h-12 max-w-[120px] object-contain rounded ring-1 ring-black/10 dark:ring-white/10"
                              />
                              <button
                                type="button"
                                onClick={() => setSignatureUrl(null)}
                                aria-label="Remove company signature"
                                className="text-[10px] text-destructive hover:underline flex items-center gap-1 font-medium focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-hidden"
                              >
                                <Trash size={12} aria-hidden="true" /> Remove
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center gap-1.5 w-full h-full justify-center">
                              <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground">
                                <PenNib size={16} aria-hidden="true" />
                              </div>
                              <span className="text-[11px] font-semibold text-foreground">
                                {uploadingSig ? "Uploading..." : "Select Image"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Type: signature
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileUpload(e, "signature")}
                                disabled={uploadingSig}
                                className="hidden"
                                aria-label="Upload company signature image"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inputs with subtle helper text */}
                    <div className="space-y-3">
                      <div>
                        <label htmlFor="company-name-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Company Name *
                        </label>
                        <input
                          id="company-name-input"
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Your business name"
                          className="w-full h-9 px-3 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                        />
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          ⓘ Name of your company or studio
                        </span>
                      </div>

                      <div>
                        <label htmlFor="company-address-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Company Address
                        </label>
                        <textarea
                          id="company-address-input"
                          rows={2}
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          placeholder="Street, City, State, Country, ZIP"
                          className="w-full p-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground resize-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label htmlFor="company-email-input" className="text-[11px] font-semibold text-foreground block mb-1">
                            Email
                          </label>
                          <input
                            id="company-email-input"
                            type="email"
                            value={companyEmail}
                            onChange={(e) => setCompanyEmail(e.target.value)}
                            placeholder="billing@company.com"
                            className="w-full h-8.5 px-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          />
                        </div>
                        <div>
                          <label htmlFor="company-phone-input" className="text-[11px] font-semibold text-foreground block mb-1">
                            Phone
                          </label>
                          <input
                            id="company-phone-input"
                            type="text"
                            value={companyPhone}
                            onChange={(e) => setCompanyPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full h-8.5 px-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Custom Fields */}
                      <div className="space-y-2 pt-2">
                        {companyCustomFields.map((field) => (
                          <div key={field.id} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) =>
                                setCompanyCustomFields((prev) =>
                                  prev.map((f) =>
                                    f.id === field.id ? { ...f, label: e.target.value } : f
                                  )
                                )
                              }
                              placeholder="Label (e.g. GSTIN)"
                              aria-label="Company custom field label"
                              className="w-1/3 h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) =>
                                setCompanyCustomFields((prev) =>
                                  prev.map((f) =>
                                    f.id === field.id ? { ...f, value: e.target.value } : f
                                  )
                                )
                              }
                              placeholder="Value"
                              aria-label="Company custom field value"
                              className="w-2/3 h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 font-mono focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => removeCompanyCustomField(field.id)}
                              aria-label="Remove company field"
                              className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-hidden"
                            >
                              <Trash size={14} aria-hidden="true" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={addCompanyCustomField}
                          className="w-full py-2 rounded-xl border border-dashed border-border/80 hover:border-brand/60 text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        >
                          <Plus size={14} className="text-brand" aria-hidden="true" />
                          <span>Add New Field</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* ACCORDION 2: Client Details */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("client")}
                  aria-expanded={openSection === "client"}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/20 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                >
                  <span
                    className={cn(
                      "text-xs font-bold tracking-tight",
                      openSection === "client" ? "text-brand" : "text-foreground"
                    )}
                  >
                    Client Details
                  </span>
                  <CaretDown
                    size={16}
                    className={cn(
                      "text-muted-foreground transition-transform duration-200 ease-out",
                      openSection === "client" && "rotate-180 text-brand"
                    )}
                    aria-hidden="true"
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    openSection === "client" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="p-4 sm:p-5 pt-0 space-y-3.5 border-t border-border/20 text-xs">
                      <div className="pt-2">
                        <label htmlFor="client-name-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Client Name *
                        </label>
                        <input
                          id="client-name-input"
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="John Doe / Client Company"
                          className="w-full h-9 px-3 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                        />
                      </div>

                      <div>
                        <label htmlFor="client-address-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Client Address
                        </label>
                        <textarea
                          id="client-address-input"
                          rows={2}
                          value={clientAddress}
                          onChange={(e) => setClientAddress(e.target.value)}
                          placeholder="456 Second St, Anytown, USA"
                          className="w-full p-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground resize-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label htmlFor="client-email-input" className="text-[11px] font-semibold text-foreground block mb-1">
                            Email
                          </label>
                          <input
                            id="client-email-input"
                            type="email"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                            placeholder="client@domain.com"
                            className="w-full h-8.5 px-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          />
                        </div>
                        <div>
                          <label htmlFor="client-phone-input" className="text-[11px] font-semibold text-foreground block mb-1">
                            Phone
                          </label>
                          <input
                            id="client-phone-input"
                            type="text"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            placeholder="+1 (555) 999-9999"
                            className="w-full h-8.5 px-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Client Custom Fields */}
                      <div className="space-y-2 pt-2">
                        {clientCustomFields.map((field) => (
                          <div key={field.id} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) =>
                                setClientCustomFields((prev) =>
                                  prev.map((f) =>
                                    f.id === field.id ? { ...f, label: e.target.value } : f
                                  )
                                )
                              }
                              placeholder="Label"
                              aria-label="Client custom field label"
                              className="w-1/3 h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) =>
                                setClientCustomFields((prev) =>
                                  prev.map((f) =>
                                    f.id === field.id ? { ...f, value: e.target.value } : f
                                  )
                                )
                              }
                              placeholder="Value"
                              aria-label="Client custom field value"
                              className="w-2/3 h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 font-mono focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => removeClientCustomField(field.id)}
                              aria-label="Remove client field"
                              className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-hidden"
                            >
                              <Trash size={14} aria-hidden="true" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={addClientCustomField}
                          className="w-full py-2 rounded-xl border border-dashed border-border/80 hover:border-brand/60 text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        >
                          <Plus size={14} className="text-brand" aria-hidden="true" />
                          <span>Add New Field</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACCORDION 3: Invoice Details */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("details")}
                  aria-expanded={openSection === "details"}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/20 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                >
                  <span
                    className={cn(
                      "text-xs font-bold tracking-tight",
                      openSection === "details" ? "text-brand" : "text-foreground"
                    )}
                  >
                    Invoice Details
                  </span>
                  <CaretDown
                    size={16}
                    className={cn(
                      "text-muted-foreground transition-transform duration-200 ease-out",
                      openSection === "details" && "rotate-180 text-brand"
                    )}
                    aria-hidden="true"
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    openSection === "details" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-border/20 text-xs">
                    {/* Currency & Serial Number */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-[11px] font-semibold text-foreground block mb-1">
                          Currency
                        </span>
                        {projectCurrency ? (
                          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40 border border-border/70">
                            <span className="text-xs font-bold text-foreground">
                              {currency === "USD" ? "USD ($)" : "INR (₹)"}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                              Project Currency
                            </span>
                          </div>
                        ) : (
                          <div className="flex rounded-xl bg-muted/40 p-0.5 border border-border/70" role="group" aria-label="Invoice currency">
                            <button
                              type="button"
                              onClick={() => setCurrency("USD")}
                              aria-pressed={currency === "USD"}
                              className={cn(
                                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden",
                                currency === "USD"
                                  ? "bg-background text-foreground shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              USD ($)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCurrency("INR")}
                              aria-pressed={currency === "INR"}
                              className={cn(
                                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden",
                                currency === "INR"
                                  ? "bg-background text-foreground shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              INR (₹)
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label htmlFor="prefix-input" className="text-[11px] font-semibold text-foreground block mb-1">
                            Prefix
                          </label>
                          <input
                            id="prefix-input"
                            type="text"
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                            placeholder="INV-"
                            className="w-full h-9 px-2 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground font-mono focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          />
                        </div>
                        <div>
                          <label htmlFor="serial-input" className="text-[11px] font-semibold text-foreground block mb-1">
                            Serial
                          </label>
                          <input
                            id="serial-input"
                            type="number"
                            min={1}
                            value={serialNumber}
                            onChange={(e) => setSerialNumber(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full h-9 px-2 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="invoice-date-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Issue Date
                        </label>
                        <input
                          id="invoice-date-input"
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          className="w-full h-9 px-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        />
                      </div>
                      <div>
                        <label htmlFor="due-date-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Due Date
                        </label>
                        <input
                          id="due-date-input"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full h-9 px-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Payment Terms */}
                    <div>
                      <label htmlFor="payment-terms-input" className="text-[11px] font-semibold text-foreground block mb-1">
                        Payment Terms
                      </label>
                      <input
                        id="payment-terms-input"
                        type="text"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="e.g. Net 14 days"
                        className="w-full h-9 px-3 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                      />
                    </div>

                    {/* Taxes & Adjustments */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground">
                          Taxes & Adjustments
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => addBillingRow("percentage")}
                            className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          >
                            <Plus size={12} aria-hidden="true" /> Add % Tax
                          </button>
                          <button
                            type="button"
                            onClick={() => addBillingRow("fixed")}
                            className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          >
                            <Plus size={12} aria-hidden="true" /> Add Fixed (+/-)
                          </button>
                        </div>
                      </div>

                      {billingDetails.map((b) => (
                        <div key={b.id} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={b.label}
                            onChange={(e) =>
                              setBillingDetails((prev) =>
                                prev.map((row) =>
                                  row.id === b.id ? { ...row, label: e.target.value } : row
                                )
                              )
                            }
                            placeholder="Label (e.g. GST)"
                            aria-label="Billing adjustment label"
                            className="w-1/2 h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          />
                          <div className="w-1/2 flex items-center gap-1">
                            <input
                              type="number"
                              value={b.type === "percentage" ? b.value : b.value / 100}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setBillingDetails((prev) =>
                                  prev.map((row) =>
                                    row.id === b.id
                                      ? {
                                          ...row,
                                          value: b.type === "percentage" ? val : Math.round(val * 100),
                                        }
                                      : row
                                  )
                                );
                              }}
                              placeholder={b.type === "percentage" ? "18%" : "Amount"}
                              aria-label="Billing adjustment value"
                              className="w-full h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            <span className="text-[10px] text-muted-foreground shrink-0 font-bold">
                              {b.type === "percentage" ? "%" : currency === "USD" ? "$" : "₹"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBillingRow(b.id)}
                            aria-label="Remove adjustment"
                            className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-hidden"
                          >
                            <Trash size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* ACCORDION 4: Invoice Items */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-2xs">
                <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleSection("items")}
                    aria-expanded={openSection === "items"}
                    className="flex items-center gap-2 text-left flex-1 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                  >
                    <span
                      className={cn(
                        "text-xs font-bold tracking-tight",
                        openSection === "items" ? "text-brand" : "text-foreground"
                      )}
                    >
                      Invoice Items ({lineItems.length})
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openAddItemModal}
                      className="active:scale-[0.96] transition-transform duration-150 ease-out h-7 px-2.5 text-[11px] font-bold rounded-lg flex items-center gap-1 shadow-2xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                      style={{ backgroundColor: themeColor, color: primaryTextColor }}
                    >
                      <Plus size={12} weight="bold" aria-hidden="true" /> Add Item
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSection("items")}
                      aria-label="Toggle invoice items section"
                      className="focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                    >
                      <CaretDown
                        size={16}
                        className={cn(
                          "text-muted-foreground transition-transform duration-200 ease-out",
                          openSection === "items" && "rotate-180 text-brand"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    openSection === "items" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="p-4 sm:p-5 pt-0 space-y-2.5 border-t border-border/20 text-xs">
                      {lineItems.length === 0 ? (
                        <p className="text-center py-5 text-muted-foreground italic text-[11px]">
                          No items added yet. Click &quot;Add Item&quot; to add billable services.
                        </p>
                      ) : (
                        lineItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/50 hover:border-border transition-colors duration-150 ease-out"
                          >
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <p className="font-bold text-foreground truncate">
                                {item.itemName}
                              </p>
                              {item.description && (
                                <p className="text-[11px] text-muted-foreground truncate text-pretty">
                                  {item.description}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
                                {item.quantity} × {formatInvoiceMoney(item.unitPrice, currency)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-foreground font-mono tabular-nums">
                                {formatInvoiceMoney(item.lineTotal, currency)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                aria-label={`Remove ${item.itemName}`}
                                className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-hidden"
                              >
                                <Trash size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ACCORDION 5: Additional Information */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("additional")}
                  aria-expanded={openSection === "additional"}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/20 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                >
                  <span
                    className={cn(
                      "text-xs font-bold tracking-tight",
                      openSection === "additional" ? "text-brand" : "text-foreground"
                    )}
                  >
                    Additional Information
                  </span>
                  <CaretDown
                    size={16}
                    className={cn(
                      "text-muted-foreground transition-transform duration-200 ease-out",
                      openSection === "additional" && "rotate-180 text-brand"
                    )}
                    aria-hidden="true"
                  />
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    openSection === "additional" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="p-4 sm:p-5 pt-0 space-y-3.5 border-t border-border/20 text-xs">
                      {/* Payment Information */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-foreground">
                            Payment Information
                          </span>
                          <button
                            type="button"
                            onClick={addPaymentInfoRow}
                            className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-0.5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                          >
                            <Plus size={12} aria-hidden="true" /> Add Detail
                          </button>
                        </div>

                        {paymentInformation.map((info) => (
                          <div key={info.id} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={info.label}
                              onChange={(e) =>
                                setPaymentInformation((prev) =>
                                  prev.map((i) =>
                                    i.id === info.id ? { ...i, label: e.target.value } : i
                                  )
                                )
                              }
                              placeholder="Label (e.g. Bank / UPI)"
                              aria-label="Payment detail label"
                              className="w-1/3 h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            <input
                              type="text"
                              value={info.value}
                              onChange={(e) =>
                                setPaymentInformation((prev) =>
                                  prev.map((i) =>
                                    i.id === info.id ? { ...i, value: e.target.value } : i
                                  )
                                )
                              }
                              placeholder="Value"
                              aria-label="Payment detail value"
                              className="w-2/3 h-8 px-2.5 text-base sm:text-xs rounded-lg bg-muted/20 border border-border/70 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => removePaymentInfoRow(info.id)}
                              aria-label="Remove payment detail"
                              className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-hidden"
                            >
                              <Trash size={14} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div>
                        <label htmlFor="invoice-notes-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Invoice Notes
                        </label>
                        <textarea
                          id="invoice-notes-input"
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Thank you for your business..."
                          className="w-full p-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground resize-none text-pretty focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                        />
                      </div>

                      <div>
                        <label htmlFor="additional-terms-input" className="text-[11px] font-semibold text-foreground block mb-1">
                          Terms & Conditions
                        </label>
                        <textarea
                          id="additional-terms-input"
                          rows={2}
                          value={additionalTerms}
                          onChange={(e) => setAdditionalTerms(e.target.value)}
                          placeholder="Late payment penalty or jurisdiction terms..."
                          className="w-full p-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground resize-none text-pretty focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Form Actions Bar */}
            <div className="p-4 border-t border-border/40 bg-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleSubmit("save_draft")}
                disabled={isSubmitting}
                className="flex-1 active:scale-[0.96] transition-transform duration-150 ease-out h-9 px-3 rounded-xl border border-border/70 hover:bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
              >
                <FloppyDisk size={14} aria-hidden="true" />
                <span>Save Draft</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit("send")}
                disabled={isSubmitting}
                className="flex-1 active:scale-[0.96] transition-transform duration-150 ease-out h-9 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                style={{ backgroundColor: themeColor, color: primaryTextColor }}
              >
                {isSubmitting ? (
                  <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <PaperPlaneTilt size={14} aria-hidden="true" />
                )}
                <span>Send to Client</span>
              </button>
            </div>
          </div>
        )}

        {/* RIGHT PANE: Live Document Sheet Preview */}
        {(viewMode === "both" || viewMode === "preview") && (
          <div className="flex-1 flex flex-col bg-muted/30 overflow-y-auto">
            <div className="p-4 sm:p-8 flex justify-center items-start">
              <div className="w-full max-w-3xl">
                <InvoiceDocumentView invoice={liveInvoice} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POPUP: Add Item Modal */}
      {isAddItemOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-item-modal-title"
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4",
            "transition-opacity duration-200 ease-out",
            isAddItemVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div
            className={cn(
              "bg-background border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4",
              "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isAddItemVisible
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-[0.96] translate-y-2"
            )}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h2 id="add-item-modal-title" className="text-sm font-bold text-foreground">
                Add Invoice Item
              </h2>
              <button
                type="button"
                onClick={closeAddItemModal}
                aria-label="Close add item dialog"
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted active:scale-[0.96] transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3.5 text-xs">
              <div>
                <label htmlFor="modal-item-name" className="text-[11px] font-semibold text-foreground block mb-1">
                  Item Name *
                </label>
                <input
                  id="modal-item-name"
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Website Redesign Milestone 1"
                  className="w-full h-9 px-3 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="modal-item-desc" className="text-[11px] font-semibold text-foreground block mb-1">
                  Description
                </label>
                <textarea
                  id="modal-item-desc"
                  rows={2}
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  placeholder="Scope details or deliverable description"
                  className="w-full p-2.5 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground resize-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="modal-item-qty" className="text-[11px] font-semibold text-foreground block mb-1">
                    Quantity
                  </label>
                  <input
                    id="modal-item-qty"
                    type="number"
                    min={1}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-9 px-3 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                  />
                </div>
                <div>
                  <label htmlFor="modal-item-price" className="text-[11px] font-semibold text-foreground block mb-1">
                    Unit Price ({currency === "USD" ? "$" : "₹"}) *
                  </label>
                  <input
                    id="modal-item-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-3 text-base sm:text-xs rounded-xl bg-muted/20 border border-border/70 text-foreground font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={closeAddItemModal}
                  className="h-8.5 px-3.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold active:scale-[0.96] transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="active:scale-[0.96] transition-transform duration-150 ease-out h-8.5 px-4 rounded-xl text-xs font-bold shadow-xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-hidden"
                  style={{ backgroundColor: themeColor, color: primaryTextColor }}
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
