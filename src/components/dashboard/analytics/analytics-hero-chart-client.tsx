"use client"

import * as React from "react"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"
import { MonospaceMetricStat } from "@/components/dashboard/shared/monospace-metric-stat"
import { TrendUpIcon } from "@phosphor-icons/react"
import * as echarts from "echarts/core"
import { BarChart, LineChart } from "echarts/charts"
import { GridComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { useTheme } from "next-themes"

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, CanvasRenderer])

export interface MonthlyVelocityPoint {
  month: string
  revenue: number
  pipeline: number
  [key: string]: unknown
}

interface AnalyticsHeroChartUIProps {
  velocityData: MonthlyVelocityPoint[]
  peakMonthLabel: string
  peakMonthRevenue: number
  monthlyAvgRevenue: number
  totalWon?: number
  currency?: "USD" | "INR"
  windowLabel?: string
}

export function AnalyticsHeroChartUI({
  velocityData,
  peakMonthLabel,
  peakMonthRevenue,
  monthlyAvgRevenue,
  totalWon,
  currency = "USD",
  windowLabel = "Velocity Trend",
}: AnalyticsHeroChartUIProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const chartRef = React.useRef<HTMLDivElement>(null)
  const chartInstance = React.useRef<echarts.ECharts | null>(null)

  const sym = currency === "INR" ? "₹" : "$"
  const locale = currency === "INR" ? "en-IN" : "en-US"

  const formatMoney = React.useCallback(
    (amount: number) => `${sym}${amount.toLocaleString(locale)}`,
    [sym, locale]
  )

  const formatCompact = React.useCallback(
    (val: number) => {
      if (val >= 1000000) return `${sym}${(val / 1000000).toFixed(1)}M`
      if (val >= 1000) return `${sym}${(val / 1000).toFixed(0)}k`
      return `${sym}${val}`
    },
    [sym]
  )

  React.useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, undefined, {
        renderer: "canvas",
      })
    }

    const chart = chartInstance.current
    const months = velocityData.map((d) => d.month)
    const revenues = velocityData.map((d) => d.revenue)
    const pipelines = velocityData.map((d) => d.pipeline)

    const option: echarts.EChartsCoreOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
          shadowStyle: {
            color: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
          },
        },
        backgroundColor: isDark ? "#0A0A0A" : "#FFFFFF",
        borderColor: isDark ? "#262626" : "#E5E5E5",
        textStyle: {
          color: isDark ? "#FAFAFA" : "#0A0A0A",
          fontSize: 12,
        },
        formatter: (params: unknown) => {
          const items = params as Array<{
            seriesName: string
            value: number
            color: string
          }>
          if (!items || !items.length) return ""
          const first = (params as Array<{ axisValue: string }>)[0]
          let html = `<div style="font-weight:600;margin-bottom:4px;font-size:11px;color:${
            isDark ? "#A3A3A3" : "#737373"
          }">${first?.axisValue}</div>`
          items.forEach((item) => {
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;">
              <span style="display:flex;align-items:center;gap:4px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background-color:${
                  item.color
                };"></span>
                <span>${item.seriesName}</span>
              </span>
              <span style="font-weight:600;font-variant-numeric:tabular-nums;">${formatMoney(
                item.value
              )}</span>
            </div>`
          })
          return html
        },
      },
      grid: {
        top: 20,
        right: 16,
        bottom: 24,
        left: 16,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: months,
        axisLine: {
          lineStyle: {
            color: isDark ? "#262626" : "#E5E5E5",
          },
        },
        axisTick: { show: false },
        axisLabel: {
          color: isDark ? "#A3A3A3" : "#737373",
          fontSize: 11,
          fontFamily: "inherit",
        },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
            type: "dashed",
          },
        },
        axisLabel: {
          color: isDark ? "#A3A3A3" : "#737373",
          fontSize: 11,
          fontFamily: "inherit",
          formatter: formatCompact,
        },
      },
      series: [
        {
          name: "Won Revenue",
          type: "bar",
          data: revenues,
          barMaxWidth: 32,
          itemStyle: {
            color: "#10B981", // Emerald
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: "Active Pipeline",
          type: "line",
          data: pipelines,
          itemStyle: {
            color: "#00AAF7", // Sky
          },
          lineStyle: {
            width: 2.5,
            color: "#00AAF7",
          },
          symbol: "circle",
          symbolSize: 6,
        },
      ],
    }

    chart.setOption(option, true)

    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [velocityData, isDark, formatMoney, formatCompact])

  React.useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [])

  return (
    <ConcentricCard
      headerExtra={
        <div className="flex items-center justify-between w-full">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <TrendUpIcon className="h-4 w-4 text-emerald-500" /> Revenue & Pipeline Execution Velocity
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500 inline-block" /> Won Revenue
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" /> Active Pipeline
            </span>
          </div>
        </div>
      }
    >
      {/* Header Metric Stats */}
      <div className="flex flex-col gap-4 pb-4 border-b border-border/20 sm:flex-row sm:items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[32px] leading-none font-bold tracking-tight text-foreground tabular-nums">
              {formatMoney(totalWon !== undefined ? totalWon : peakMonthRevenue)}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              {windowLabel}
            </span>
          </div>
          <span className="mt-1 block text-xs font-medium text-pretty text-muted-foreground">
            Composed bar (won revenue) vs line (proposals in flight) — zero visual occlusion
          </span>
        </div>

        <div className="flex items-center gap-6 shrink-0 text-right sm:text-right">
          <MonospaceMetricStat
            tag="[⬆] Peak Period"
            value={peakMonthLabel}
            subtext={`(${formatMoney(peakMonthRevenue)})`}
          />
          <MonospaceMetricStat
            tag="[~] Period Avg"
            value={formatMoney(monthlyAvgRevenue)}
            subtext="won/period"
          />
        </div>
      </div>

      {/* Composed ECharts Container */}
      <div ref={chartRef} className="h-[280px] w-full min-h-[280px] min-w-0" />
    </ConcentricCard>
  )
}
