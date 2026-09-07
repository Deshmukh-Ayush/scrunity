import { getTenantContext } from "@/lib/tenant-context"
import { headers } from "next/headers"
import { db } from "@/utils/db"
import { inArray, eq, lt, or, and } from "drizzle-orm"
import { proposal, paymentMilestone, invoice, deliverable, contract } from "@/db/schema"
import { getAccessibleProjectIds } from "@/lib/project-queries"
import { getCachedOrg } from "@/utils/cached-org-queries"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { convertAndAggregate, getUsdToInrRate } from "@/lib/currency"

const DynamicDashboardKpiRowUI = dynamic(
  () => import("./kpi-row-client").then((mod) => mod.DashboardKpiRowUI),
  {
    loading: () => <Skeleton className="h-[140px] w-full rounded-md" />,
  }
)

export async function DashboardKpiRow() {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.user) {
    return null
  }

  // Fetch accessible projects and cached org currency in parallel
  const [projectIds, org] = await Promise.all([
    getAccessibleProjectIds(ctx.user.id, ctx.organizationId),
    ctx.organizationId ? getCachedOrg(ctx.organizationId) : Promise.resolve(null),
  ])
  const activeProjectsCount = projectIds.length

  let targetCurrency: "USD" | "INR" = "USD"
  if (org?.globalCurrency === "INR" || org?.globalCurrency === "USD") {
    targetCurrency = org.globalCurrency
  }

  if (projectIds.length === 0) {
    return (
      <DynamicDashboardKpiRowUI
        totalIncome={0}
        pendingCollection={0}
        activeProjectsCount={0}
        attentionItemsCount={0}
        currency={targetCurrency}
      />
    )
  }

  const now = new Date()

  // Concurrently query proposals, pending milestones, attention counts, and live FX rate
  const [
    proposalsList,
    pendingMilestonesList,
    overdueInvoices,
    reviewDeliverables,
    pendingContracts,
    usdToInrRate,
  ] = await Promise.all([
    db
      .select({
        price: proposal.price,
        currency: proposal.currency,
        status: proposal.status,
      })
      .from(proposal)
      .where(inArray(proposal.projectId, projectIds)),
    db
      .select({
        amount: paymentMilestone.amount,
        currency: paymentMilestone.currency,
        status: paymentMilestone.status,
      })
      .from(paymentMilestone)
      .where(
        and(
          inArray(paymentMilestone.projectId, projectIds),
          inArray(paymentMilestone.status, ["due", "overdue"])
        )
      ),
    db
      .select({ id: invoice.id })
      .from(invoice)
      .where(
        and(
          inArray(invoice.projectId, projectIds),
          or(
            eq(invoice.status, "overdue"),
            and(
              inArray(invoice.status, ["sent", "viewed"]),
              lt(invoice.dueDate, now)
            )
          )
        )
      ),
    db
      .select({ id: deliverable.id })
      .from(deliverable)
      .where(
        and(
          inArray(deliverable.projectId, projectIds),
          inArray(deliverable.status, ["in_review", "revision_requested"])
        )
      ),
    db
      .select({ id: contract.id })
      .from(contract)
      .where(
        and(
          inArray(contract.projectId, projectIds),
          inArray(contract.status, ["draft", "sent", "pending_signature", "partially_signed"])
        )
      ),
    getUsdToInrRate(),
  ])

  // Convert accepted proposals to targetCurrency at live exchange rate
  const acceptedItems = proposalsList
    .filter((p) => p.status === "accepted")
    .map((p) => ({ amount: p.price, currency: p.currency }))
  const { total: totalIncome } = convertAndAggregate(acceptedItems, targetCurrency, usdToInrRate)

  // Convert pending milestones (due/overdue) to targetCurrency at live exchange rate
  const pendingItems = pendingMilestonesList.map((m) => ({
    amount: m.amount,
    currency: m.currency,
  }))
  const { total: pendingCollection } = convertAndAggregate(pendingItems, targetCurrency, usdToInrRate)

  const attentionItemsCount =
    overdueInvoices.length + reviewDeliverables.length + pendingContracts.length

  return (
    <DynamicDashboardKpiRowUI
      totalIncome={totalIncome}
      pendingCollection={pendingCollection}
      activeProjectsCount={activeProjectsCount}
      attentionItemsCount={attentionItemsCount}
      currency={targetCurrency}
    />
  )
}
