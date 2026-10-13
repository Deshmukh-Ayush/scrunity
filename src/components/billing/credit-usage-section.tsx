import { getTenantContext } from "@/lib/tenant-context"
import { getCreditUsageAnalytics } from "@/lib/gtm-ai-credits"
import { asJson } from "@/lib/data/serialize"
import { CreditUsageChart, type RecentTx, type UsageDataPoint } from "./credit-usage-chart"

/** Server-fetches the default (14-day) credit usage window for the billing page. */
export async function CreditUsageSection() {
  const { organizationId } = await getTenantContext()
  const usage = organizationId
    ? await getCreditUsageAnalytics(organizationId, "daily")
    : { chartData: [], recentTransactions: [] }

  return (
    <CreditUsageChart
      initialChartData={asJson<UsageDataPoint[]>(usage.chartData)}
      initialTransactions={asJson<RecentTx[]>(usage.recentTransactions)}
    />
  )
}
