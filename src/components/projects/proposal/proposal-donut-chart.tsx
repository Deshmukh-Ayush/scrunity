"use client";

import { cn } from "@/lib/utils";
import { FilesIcon } from "@phosphor-icons/react";

type Proposal = {
  price?: number;
  currency?: "INR" | "USD";
  status: "accepted" | "sent" | "draft" | "declined";
};

type ProposalDonutChartProps = {
  proposals: Proposal[];
  formatMoney: (amountInUnits: number, curr?: string) => string;
};

export function formatProposalMultiCurrencyTotals(
  proposals: Proposal[],
  filterFn?: (p: Proposal) => boolean,
  formatMoneyFn?: (amount: number, curr?: string) => string
) {
  const filtered = filterFn ? proposals.filter(filterFn) : proposals;
  if (filtered.length === 0) return "₹0";

  const formatFn = formatMoneyFn || ((amt, curr) => {
    if (curr === "USD") {
      return `$${amt.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    return `₹${amt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  });

  const inrSum = filtered
    .filter((p) => p.currency === "INR" || !p.currency)
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const usdSum = filtered
    .filter((p) => p.currency === "USD")
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const parts: string[] = [];
  if (inrSum > 0 || (usdSum === 0 && inrSum === 0)) {
    parts.push(formatFn(inrSum, "INR"));
  }
  if (usdSum > 0) {
    parts.push(formatFn(usdSum, "USD"));
  }

  return parts.join(" + ");
}

export function ProposalDonutChart({
  proposals,
  formatMoney,
}: ProposalDonutChartProps) {
  const totalEstimatedValue = proposals.reduce((sum, p) => sum + (p.price || 0), 0);

  const acceptedAmount = proposals
    .filter((p) => p.status === "accepted")
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const sentAmount = proposals
    .filter((p) => p.status === "sent")
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const draftAmount = proposals
    .filter((p) => p.status === "draft")
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const declinedAmount = proposals
    .filter((p) => p.status === "declined")
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const calcPercent = (amt: number) => {
    if (totalEstimatedValue <= 0) return 0;
    return Math.round((amt / totalEstimatedValue) * 100);
  };

  const categories = [
    {
      name: "accepted",
      label: "Accepted",
      value: calcPercent(acceptedAmount),
      count: proposals.filter((p) => p.status === "accepted").length,
      amountText: formatProposalMultiCurrencyTotals(proposals, (p) => p.status === "accepted", formatMoney),
      color: "#10b981", // emerald-500
      swatch: "bg-emerald-500 dark:bg-emerald-400",
    },
    {
      name: "sent",
      label: "Sent to Client",
      value: calcPercent(sentAmount),
      count: proposals.filter((p) => p.status === "sent").length,
      amountText: formatProposalMultiCurrencyTotals(proposals, (p) => p.status === "sent", formatMoney),
      color: "#0ea5e9", // sky-500
      swatch: "bg-sky-500 dark:bg-sky-400",
    },
    {
      name: "draft",
      label: "Drafts",
      value: calcPercent(draftAmount),
      count: proposals.filter((p) => p.status === "draft").length,
      amountText: formatProposalMultiCurrencyTotals(proposals, (p) => p.status === "draft", formatMoney),
      color: "#9333ea", // purple-600
      swatch: "bg-purple-600 dark:bg-purple-600",
    },
    {
      name: "declined",
      label: "Declined",
      value: calcPercent(declinedAmount),
      count: proposals.filter((p) => p.status === "declined").length,
      amountText: formatProposalMultiCurrencyTotals(proposals, (p) => p.status === "declined", formatMoney),
      color: "#ef4444", // red-500
      swatch: "bg-red-500 dark:bg-red-400",
    },
  ];

  const totalEstimatedText = formatProposalMultiCurrencyTotals(proposals, undefined, formatMoney);

  // Compute SVG Donut Slices
  let cumulativePercent = 0;
  const donutSlices = categories
    .filter((cat) => cat.value > 0)
    .map((cat) => {
      const startPercent = cumulativePercent;
      cumulativePercent += cat.value;
      const endPercent = cumulativePercent;
      return {
        ...cat,
        startPercent,
        endPercent,
      };
    });

  // Calculate SVG strokeDasharray & strokeDashoffset for continuous ring
  const strokeWidth = 14;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900">
      <span className="flex items-center gap-1 text-[12px] font-medium dark:text-neutral-400 py-0.5">
        <FilesIcon className="h-5 w-5" /> Proposal Pipeline Distribution
      </span>
      <div className="rounded-md bg-white p-4 dark:bg-neutral-950">
        {/* Header Section */}
        <div className="flex items-baseline justify-between gap-4 pb-6 border-b border-border/20 mb-6">
          <div>
            <span className="text-[18px] font-semibold block dark:text-neutral-300">
              Total Estimated Value
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Pipeline conversion ratio across {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-[18px] font-semibold tabular-nums dark:text-neutral-200">
            {totalEstimatedText}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart Ring Visual */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative py-2">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background Ring */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  className="text-muted/30"
                />
                {/* Dynamic Donut Slices */}
                {donutSlices.map((slice) => {
                  const strokeDasharray = `${(slice.value / 100) * circumference} ${circumference}`;
                  const strokeDashoffset = -((slice.startPercent / 100) * circumference);
                  return (
                    <circle
                      key={slice.name}
                      cx="60"
                      cy="60"
                      r={radius}
                      stroke={slice.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-500 ease-out hover:opacity-80"
                    />
                  );
                })}
              </svg>

              {/* Donut Center Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {proposals.length}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Proposals
                </span>
              </div>
            </div>
          </div>

          {/* Category Breakdown Rows */}
          <div className="md:col-span-7 flex flex-col gap-1.5">
            {categories.map(({ name, label, value, amountText, swatch }, index) => (
              <div
                key={name}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition-colors",
                  index % 2 === 0
                    ? "bg-muted/20 hover:bg-muted/40"
                    : "hover:bg-muted/20"
                )}
              >
                <span className={cn("size-3 shrink-0 rounded-xs", swatch)} />

                <span className="min-w-[3.5ch] text-xs font-bold text-foreground tabular-nums">
                  {value}%
                </span>

                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>

                <span className="ml-auto text-xs font-semibold text-foreground tabular-nums">
                  {amountText}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
