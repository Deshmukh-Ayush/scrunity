"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { LocalDate } from "@/components/ui/local-date"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import {
  TrendingUp,
  Activity,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
} from "@/components/ui/icons"

export type RangeType = "daily" | "weekly" | "monthly"

export interface UsageDataPoint {
  date: string
  label: string
  creditsDebited: number
  prospectsSent: number
}

export interface RecentTx {
  id: string
  type: "debit" | "topup" | "manual_grant" | "period_reset" | string
  amount: number
  description: string | null
  relatedCampaignId: string | null
  createdAt: string
}

const chartConfig: ChartConfig = {
  prospectsSent: {
    label: "Prospects Sent",
    color: "var(--chart-4)",
  },
}

/**
 * Credit burn chart and recent transactions. Renders the server-fetched daily
 * range immediately and fetches GET /api/billing/usage when the range changes.
 */
export function CreditUsageChart({
  initialChartData,
  initialTransactions,
}: {
  initialChartData: UsageDataPoint[]
  initialTransactions: RecentTx[]
}) {
  const [range, setRange] = useState<RangeType>("daily")
  const [loading, setLoading] = useState(false)
  const [chartData, setChartData] = useState<UsageDataPoint[]>(initialChartData)
  const [recentTransactions, setRecentTransactions] =
    useState<RecentTx[]>(initialTransactions)
  const hasMounted = useRef(false)

  useEffect(() => {
    // The server already rendered the default (daily) range.
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }

    let ignore = false
    setLoading(true)

    fetch(`/api/billing/usage?range=${range}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success) {
          setChartData(data.chartData || [])
          setRecentTransactions(data.recentTransactions || [])
        }
      })
      .catch((err) => console.error("Failed to load usage data:", err))
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [range])

  const totalSentInRange = chartData.reduce(
    (acc, curr) => acc + (curr.prospectsSent || 0),
    0
  )

  return (
    <Card className="space-y-6 border-border/70 p-6">
      {/* Header and Filter Buttons */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-primary" />
            <CardTitle className="text-base font-semibold break-words">
              Credit Burn & Outreach Activity
            </CardTitle>
          </div>
          <CardDescription className="mt-0.5 text-xs break-words text-muted-foreground">
            Audit log of prospect outreach sends charged against your AI credit
            balance
          </CardDescription>
        </div>

        {/* Filter buttons: Daily, Weekly, Monthly */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg bg-muted/60 p-1 shadow-surface">
          <Button
            variant={range === "daily" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRange("daily")}
          >
            Daily (14d)
          </Button>
          <Button
            variant={range === "weekly" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRange("weekly")}
          >
            Weekly (8w)
          </Button>
          <Button
            variant={range === "monthly" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRange("monthly")}
          >
            Monthly (6m)
          </Button>
        </div>
      </div>

      {/* Summary KPI */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground">
          {totalSentInRange.toLocaleString("en-US")}
        </span>
        <span className="text-xs text-muted-foreground">
          prospects sent in this{" "}
          {range === "daily"
            ? "14-day"
            : range === "weekly"
              ? "8-week"
              : "6-month"}{" "}
          period
        </span>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-64 w-full pt-2">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Loading usage trend...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
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
                    <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  opacity={0.2}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  stroke="var(--text-muted)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                  stroke="var(--text-muted)"
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as UsageDataPoint
                      return (
                        <div className="rounded-lg bg-popover p-2.5 text-xs shadow-md shadow-floating">
                          <p className="font-semibold text-foreground">
                            {item.label}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            <span className="font-bold text-foreground">
                              {item.prospectsSent}
                            </span>{" "}
                            prospect{item.prospectsSent === 1 ? "" : "s"} sent (
                            {item.creditsDebited} AI credits debited)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="prospectsSent"
                  stroke="var(--chart-4)"
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
      <div className="space-y-3 border-t border-border/50 pt-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Recent Credit Transactions
          </h3>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No transactions yet. Credit debits will appear as prospects are sent
            in Stage 7.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg shadow-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead className="border-b border-border/50 bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">
                      Type
                    </th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentTransactions.map((tx) => {
                    const isDebit = tx.type === "debit"
                    const isGrant = tx.type === "manual_grant"
                    const isTopup = tx.type === "topup" || isGrant

                    const badge = isDebit ? (
                      <Badge
                        variant="outline"
                        className="h-4 text-muted-foreground">
                        Debit
                      </Badge>
                    ) : isTopup ? (
                      <Badge variant="success" className="h-4">
                        {isGrant ? "Granted" : "Top-Up"}
                      </Badge>
                    ) : (
                      <Badge
                        variant="neutral"
                        className="h-4">
                        Period Reset
                      </Badge>
                    )

                    const descText =
                      tx.description ||
                      (isDebit ? "Sent email to prospect" : "Credit allocation")

                    return (
                      <tr key={tx.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          <LocalDate
                            value={tx.createdAt}
                            locale="en-US"
                            options={{
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }}
                          />
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {badge}
                        </td>
                        <td
                          className="min-w-[200px] px-3 py-2.5 font-medium break-words text-foreground"
                          title={descText}
                        >
                          {descText}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                          {isDebit ? (
                            <span className="text-danger">-{tx.amount}</span>
                          ) : isTopup ? (
                            <span className="text-success">
                              +{tx.amount}
                            </span>
                          ) : (
                            <span className="text-primary">{tx.amount}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
