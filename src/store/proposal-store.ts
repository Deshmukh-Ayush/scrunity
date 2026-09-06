"use client";

import { create } from "zustand";
import type { ProposalLineItem, ProposalDraft } from "./types";

interface ProposalState {
  // Active Proposal Selected for Preview
  selectedProposal: any | null;
  
  // Builder Form State
  title: string;
  scopeSummary: string;
  validityDays: string;
  currency: string;
  lineItems: ProposalLineItem[];
  isSubmitting: boolean;
  
  // Actions
  setSelectedProposal: (proposal: any | null) => void;
  setDraftData: (data?: ProposalDraft) => void;
  setTitle: (title: string) => void;
  setScopeSummary: (summary: string) => void;
  setValidityDays: (days: string) => void;
  setCurrency: (currency: string) => void;
  setIsSubmitting: (submitting: boolean) => void;
  
  // Line item actions
  addLineItem: () => void;
  removeLineItem: (index: number) => void;
  updateLineItem: (index: number, field: keyof ProposalLineItem, value: any) => void;
  resetBuilder: () => void;
}

const DEFAULT_LINE_ITEMS: ProposalLineItem[] = [
  { description: "UI/UX Design & Prototyping", quantity: 1, unitPrice: 25000 },
  { description: "Full-Stack Development & API Integration", quantity: 1, unitPrice: 50000 },
];

export const useProposalStore = create<ProposalState>((set) => ({
  selectedProposal: null,
  title: "Project Scope Proposal",
  scopeSummary: "",
  validityDays: "30",
  currency: "INR",
  lineItems: DEFAULT_LINE_ITEMS,
  isSubmitting: false,

  setSelectedProposal: (proposal) => set({ selectedProposal: proposal }),

  setDraftData: (data) => {
    if (!data) {
      set({
        title: "Project Scope Proposal",
        scopeSummary: "",
        validityDays: "30",
        currency: "INR",
        lineItems: DEFAULT_LINE_ITEMS,
      });
      return;
    }
    set({
      title: data.title || "Project Scope Proposal",
      scopeSummary: data.scopeSummary || "",
      validityDays: data.validityDays || "30",
      currency: data.currency || "INR",
      lineItems: data.lineItems && data.lineItems.length > 0 ? data.lineItems : DEFAULT_LINE_ITEMS,
    });
  },

  setTitle: (title) => set({ title }),
  setScopeSummary: (scopeSummary) => set({ scopeSummary }),
  setValidityDays: (validityDays) => set({ validityDays }),
  setCurrency: (currency) => set({ currency }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),

  addLineItem: () =>
    set((state) => ({
      lineItems: [...state.lineItems, { description: "", quantity: 1, unitPrice: 0 }],
    })),

  removeLineItem: (index) =>
    set((state) => ({
      lineItems: state.lineItems.filter((_, i) => i !== index),
    })),

  updateLineItem: (index, field, value) =>
    set((state) => {
      const updated = [...state.lineItems];
      updated[index] = { ...updated[index], [field]: value };
      return { lineItems: updated };
    }),

  resetBuilder: () =>
    set({
      title: "Project Scope Proposal",
      scopeSummary: "",
      validityDays: "30",
      currency: "INR",
      lineItems: DEFAULT_LINE_ITEMS,
      isSubmitting: false,
    }),
}));
