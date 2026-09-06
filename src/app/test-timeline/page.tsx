"use client"

import React, { useState } from "react"
import { 
  Sparkles, 
  FileText, 
  Mail, 
  AlertCircle, 
  Loader2,
  ExternalLink
} from "lucide-react"

export default function TorchTimelineFeed() {
  const [approvals, setApprovals] = useState({
    fee: false,
    timeline: false,
    schedule: false,
  })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      
      {/* 1. TEXT NODE */}
      <div className="text-[16px] font-regular text-neutral-800">
        I&apos;ll draft all the 3 items as asked and ask Ayush for approval.
      </div>

      {/* 2. TIMELINE WRAPPER (Dashed Spine) */}
      <div className="relative flex flex-col gap-6 pl-7 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:border-l before:border-dashed before:border-neutral-300">

        {/* --- APPROVAL CARD ITEM --- */}
        <div className="relative">
          {/* Timeline Node Bullet */}
          <div className="absolute -left-7 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white">
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#E8E8E8] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            {/* Header */}
            <div className="flex items-center gap-1.5 border-b border-[#F0F0F0] bg-[#FAFAFA] px-4 py-2 text-xs font-medium text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>3 items needs your approval</span>
            </div>

            {/* List of Approvals */}
            <div className="divide-y divide-[#F0F0F0] p-4 space-y-4">
              
              {/* Item 1 */}
              <div className="flex items-start justify-between gap-4 pt-1 first:pt-0">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-medium text-neutral-900">
                    Set the project fee for Shing&apos;s redesign
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Website redesign proposal · $4,000 total
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setApprovals(p => ({ ...p, fee: !p.fee }))}
                    className={`h-7 px-3 text-[11px] font-medium rounded-md transition-all active:scale-95 ${
                      approvals.fee 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : "bg-black text-white hover:bg-neutral-800"
                    }`}
                  >
                    {approvals.fee ? "Approved" : "Approve amount"}
                  </button>
                  <button className="text-[11px] text-neutral-500 hover:text-neutral-900 px-1.5 py-1">
                    Adjust
                  </button>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start justify-between gap-4 pt-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-medium text-neutral-900">
                    Set the project timeline
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    8 weeks · Full website redesign
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setApprovals(p => ({ ...p, timeline: !p.timeline }))}
                    className={`h-7 px-3 text-[11px] font-medium rounded-md transition-all active:scale-95 ${
                      approvals.timeline 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : "bg-black text-white hover:bg-neutral-800"
                    }`}
                  >
                    {approvals.timeline ? "Approved" : "Approve 8 weeks"}
                  </button>
                  <button className="text-[11px] text-neutral-500 hover:text-neutral-900 px-1.5 py-1">
                    Adjust
                  </button>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start justify-between gap-4 pt-3">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-medium text-neutral-900">
                    Set the payment schedule
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    40% upfront · 30% after design · 30% on completion
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setApprovals(p => ({ ...p, schedule: !p.schedule }))}
                    className={`h-7 px-3 text-[11px] font-medium rounded-md transition-all active:scale-95 ${
                      approvals.schedule 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : "bg-black text-white hover:bg-neutral-800"
                    }`}
                  >
                    {approvals.schedule ? "Approved" : "Approve 3 milestones"}
                  </button>
                  <button className="text-[11px] text-neutral-500 hover:text-neutral-900 px-1.5 py-1">
                    Adjust
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* --- TOOL EXECUTION STEP --- */}
        <div className="relative flex items-center gap-2">
          <div className="absolute -left-7 flex h-6 w-6 items-center justify-center rounded-md border border-[#E0F2FE] bg-[#F0F9FF] text-[#0088C4]">
            <Sparkles className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "6s" }} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-700">
            <span>Launching Proposals Builder.... Drafting Proposal</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-[#EBF5FF] px-2 py-0.5 text-xs font-medium text-[#0088C4]">
              Shing India Proposal
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </span>
          </div>
        </div>

        {/* --- INTERMEDIATE TEXT MESSAGE --- */}
        <div className="text-sm font-normal text-neutral-800">
          Before I send it, I&apos;ll make sure the proposal contains the agreed scope, $4,000 total, 8-week timeline, and payment milestones.
        </div>

        {/* --- SUMMARY ARTIFACT CARD --- */}
        <div className="relative">
          <div className="overflow-hidden rounded-[14px] border border-[#E8E8E8] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            {/* Header */}
            <div className="flex items-center gap-1.5 border-b border-[#F0F0F0] bg-[#FAFAFA] px-4 py-2 text-xs font-medium text-[#0088C4]">
              <FileText className="h-3.5 w-3.5" />
              <span>Items to be sent</span>
            </div>

            {/* Table */}
            <div className="divide-y divide-[#F0F0F0] px-4 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-neutral-500">Amount</span>
                <span className="font-mono font-medium text-neutral-900">$5000</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-neutral-500">Duration</span>
                <span className="font-medium text-neutral-900">2 months</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-neutral-500">Payment Milestones</span>
                <span className="font-medium text-neutral-900">3</span>
              </div>
            </div>
          </div>
        </div>

        {/* --- EXTERNAL ACTION DISPATCH (GMAIL) --- */}
        <div className="relative flex items-center gap-2">
          <div className="absolute -left-7 flex h-6 w-6 items-center justify-center rounded-md border border-neutral-200 bg-white">
            <Mail className="h-3.5 w-3.5 text-rose-500" />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-700">
            <span>Proposal Sent to</span>
            <span className="rounded-md bg-[#EBF5FF] px-2 py-0.5 font-medium text-[#0088C4]">
              Shing India Pvt. Ltd.
            </span>
          </div>
        </div>

        {/* --- LIVE AGENT THINKING NODE --- */}
        <div className="relative flex items-center gap-2">
          <div className="absolute -left-7 flex h-6 w-6 items-center justify-center rounded-full bg-white">
            <Loader2 className="h-3.5 w-3.5 text-[#0088C4] animate-spin" />
          </div>
          <span className="text-xs text-neutral-400 italic">
            Waiting for client response webhook...
          </span>
        </div>

        {/* --- FINAL STATUS --- */}
        <div className="text-sm font-normal text-neutral-800">
          I&apos;ll track the proposal status and let you know when Shing responds.
        </div>

      </div>
    </div>
  )
}