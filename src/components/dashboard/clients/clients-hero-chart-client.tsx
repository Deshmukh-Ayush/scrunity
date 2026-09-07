"use client"

import { EChartsBarChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-bar-chart"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"
import { MonospaceMetricStat } from "@/components/dashboard/shared/monospace-metric-stat"
import { UsersThree } from "@phosphor-icons/react"

export interface MonthlyClientConversionPoint {
  month: string
  proposalsSent: number
  clientsClosed: number
  [key: string]: unknown
}

interface ClientsHeroChartUIProps {
  conversionData: MonthlyClientConversionPoint[]
  totalProposalsSent: number
  totalClientsClosed: number
  avgConversionRate: number
  periodLabel?: string
}

export function ClientsHeroChartUI({
  conversionData,
  totalProposalsSent,
  totalClientsClosed,
  avgConversionRate,
  periodLabel = "6 Months",
}: ClientsHeroChartUIProps) {
  const chartConfig = {
    proposalsSent: {
      label: "Proposals Sent",
      colors: { light: ["#00AAF7"], dark: ["#00AAF7"] },
    },
    clientsClosed: {
      label: "Clients Closed",
      colors: { light: ["#10B981"], dark: ["#10B981"] },
    },
  } satisfies ChartConfig

  return (
    <ConcentricCard
      headerExtra={
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <UsersThree className="h-4 w-4 text-sky-500" /> Client Acquisition Velocity ({periodLabel})
        </span>
      }
    >
      {/* Header Metric Stats */}
      <div className="flex flex-col gap-4 pb-4 border-b border-border/20 sm:flex-row sm:items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[32px] leading-none font-bold tracking-tight text-foreground tabular-nums">
              {totalClientsClosed} Clients Won
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              {avgConversionRate}% Win Rate
            </span>
          </div>
          <span className="mt-1 block text-xs font-medium text-pretty text-muted-foreground">
            Comparison between total proposals sent vs contracts signed by clients
          </span>
        </div>

        <div className="flex items-center gap-6 shrink-0 text-right sm:text-right">
          <MonospaceMetricStat
            tag="[⬆] Proposals Sent"
            value={totalProposalsSent}
            subtext="total proposals"
          />
          <MonospaceMetricStat
            tag="[~] Avg Conversion"
            value={`${avgConversionRate}%`}
            subtext="proposal-to-client"
          />
        </div>
      </div>

      {/* ECharts Bar Chart */}
      <div className="h-[280px] w-full min-h-[280px] min-w-0">
        <EChartsBarChart
          data={conversionData}
          config={chartConfig}
          className="h-full w-full min-h-[280px] min-w-0"
        >
          <EChartsBarChart.Bar dataKey="proposalsSent" />
          <EChartsBarChart.Bar dataKey="clientsClosed" />
          <EChartsBarChart.XAxis dataKey="month" />
          <EChartsBarChart.YAxis />
          <EChartsBarChart.Tooltip />
        </EChartsBarChart>
      </div>
    </ConcentricCard>
  )
}
