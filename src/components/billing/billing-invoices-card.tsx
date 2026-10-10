"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Download, ExternalLink } from "lucide-react";
import { ManagePortalButton } from "./billing-modals";

interface Invoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  downloadUrl?: string;
}

export function BillingInvoicesCard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/invoices")
      .then((res) => res.json())
      .then((data) => {
        setInvoices(data.invoices || []);
      })
      .catch((err) => console.error("Failed to load invoices:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="border-border/70 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-base font-semibold break-words">
              Invoice & Payment History
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 break-words">
            Past billing statements and payment receipts issued by Dodo Payments
          </CardDescription>
        </div>
        <div className="shrink-0">
          <ManagePortalButton />
        </div>
      </div>

      <CardContent className="p-0">
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Loading invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-border/40">
            No payments or invoices recorded yet for this organization.
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[600px]">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Invoice Date</th>
                    <th className="py-2.5 px-3 font-medium">Description</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invoices.map((inv) => {
                    const dateStr = new Date(inv.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const desc = inv.description || "Scrunity Platform";

                    return (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td
                          className="py-2.5 px-3 font-medium text-foreground min-w-[200px] break-words"
                          title={desc}
                        >
                          {desc}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge
                            className={`text-[10px] h-4 font-medium ${
                              inv.status === "succeeded" || inv.status === "paid"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                          ${inv.amount.toFixed(2)} {inv.currency}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          {inv.downloadUrl ? (
                            <a
                              href={inv.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                            >
                              <Download className="h-3 w-3" />
                              PDF
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
