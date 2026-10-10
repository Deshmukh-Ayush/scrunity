"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { TrendingUp, Activity, History, ArrowDownLeft, ArrowUpRight, RotateCcw } from "lucide-react";

type RangeType = "daily" | "weekly" | "monthly";

interface UsageDataPoint {
  date: string;
  label: string;
  creditsDebited: number;
  prospectsSent: number;
}

interface RecentTx {
  id: string;
  type: "debit" | "topup" | "period_reset" | string;
  amount: number;
  description: string | null;
  relatedCampaignId: string | null;
  createdAt: string;
}

const chartConfig: ChartConfig = {
  prospectsSent: {
    label: "Prospects Sent",
    color: "var(--color-primary, #6366f1)",
  },
};

export function CreditUsageSection() {
  const [range, setRange] = useState<RangeType>("daily");
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<UsageDataPoint[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTx[]>([]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    fetch(`/api/billing/usage?range=${range}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success) {
          setChartData(data.chartData || []);
          setRecentTransactions(data.recentTransactions || []);
        }
      })
      .catch((err) => console.error("Failed to load usage data:", err))
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [range]);

  const totalSentInRange = chartData.reduce((acc, curr) => acc + (curr.prospectsSent || 0), 0);

  return (
    <Card className="border-border/70 p-6 space-y-6">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-base font-semibold break-words">
              Credit Burn & Outreach Activity
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 break-words">
            Audit log of prospect outreach sends charged against your AI credit balance
          </CardDescription>
        </div>

        {/* Filter buttons: Daily, Weekly, Monthly */}
        <div className="flex flex-wrap items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 shrink-0">
          <Button
            variant={range === "daily" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setRange("daily")}
          >
            Daily (14d)
          </Button>
          <Button
            variant={range === "weekly" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setRange("weekly")}
          >
            Weekly (8w)
          </Button>
          <Button
            variant={range === "monthly" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setRange("monthly")}
          >
            Monthly (6m)
          </Button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {totalSentInRange.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">
          prospects sent in this {range === "daily" ? "14-day" : range === "weekly" ? "8-week" : "6-month"} period
        </span>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-64 w-full pt-2">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
            Loading usage trend...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
            No credit activity recorded in this time range.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 12, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  stroke="#888888"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  stroke="#888888"
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as UsageDataPoint;
                      return (
                        <div className="rounded-lg border border-border bg-popover p-2.5 shadow-md text-xs">
                          <p className="font-semibold text-foreground">{item.label}</p>
                          <p className="text-muted-foreground mt-1">
                            <span className="font-bold text-foreground">
                              {item.prospectsSent}
                            </span>{" "}
                            prospect{item.prospectsSent === 1 ? "" : "s"} sent (
                            {item.creditsDebited} AI credits debited)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="prospectsSent"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorUsage)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </div>

      {/* Step 4.5: Compact Recent Transactions Table */}
      <div className="space-y-3 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">
            Recent Credit Transactions
          </h3>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No transactions yet. Credit debits will appear as prospects are sent in Stage 7.
          </p>
        ) : (
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[540px]">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3 font-medium whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 font-medium">Description</th>
                    <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentTransactions.map((tx) => {
                    const isDebit = tx.type === "debit";
                    const isTopup = tx.type === "topup";
                    const isReset = tx.type === "period_reset";

                    const badge = isDebit ? (
                      <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">
                        Debit
                      </Badge>
                    ) : isTopup ? (
                      <Badge className="text-[10px] h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
                        Top-Up
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] h-4 font-medium">
                        Period Reset
                      </Badge>
                    );

                    const dateFormatted = new Date(tx.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    );

                    const descText =
                      tx.description || (isDebit ? "Sent email to prospect" : "Credit allocation");

                    return (
                      <tr key={tx.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{badge}</td>
                        <td
                          className="py-2.5 px-3 text-foreground font-medium min-w-[200px] break-words"
                          title={descText}
                        >
                          {descText}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                          {isDebit ? (
                            <span className="text-red-500">-{tx.amount}</span>
                          ) : isTopup ? (
                            <span className="text-emerald-500">+{tx.amount}</span>
                          ) : (
                            <span className="text-primary">{tx.amount}</span>
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
      </div>
    </Card>
  );
}
