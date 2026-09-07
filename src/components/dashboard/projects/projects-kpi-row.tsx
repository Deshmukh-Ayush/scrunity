import { getCachedTenant } from "@/utils/cached-tenant"
import { getAccessibleProjects } from "@/lib/project-queries"
import { db } from "@/utils/db"
import { invoice, paymentMilestone, organization } from "@/db/schema"
import { inArray, eq } from "drizzle-orm"
import { convertAmount, getUsdToInrRate } from "@/lib/currency"
import { ProjectsKpiRowClient, ProjectsKpiData } from "./projects-kpi-row-client"

export type ProjectHealthStatus = "on_track" | "action_required" | "blocked" | "completed"

export async function ProjectsKpiRow() {
  const { user, organizationId } = await getCachedTenant()
  if (!user) return null

  let targetCurrency: "USD" | "INR" = "USD"
  if (organizationId) {
    const [org] = await db
      .select({ globalCurrency: organization.globalCurrency })
      .from(organization)
      .where(eq(organization.id, organizationId))
    if (org?.globalCurrency === "INR" || org?.globalCurrency === "USD") {
      targetCurrency = org.globalCurrency
    }
  }

  const [rawProjects, usdToInrRate] = await Promise.all([
    getAccessibleProjects(user.id, organizationId),
    getUsdToInrRate(),
  ])

  const projectIds = rawProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    const emptyData: ProjectsKpiData = {
      activeProjectsCount: 0,
      totalCommittedValue: 0,
      attentionCount: 0,
      deliverableCompletionRate: 0,
      approvedDeliverablesCount: 0,
      totalDeliverablesCount: 0,
      currency: targetCurrency,
      portfolioHealth: {
        onTrack: 0,
        actionRequired: 0,
        blocked: 0,
        completed: 0,
      },
    }
    return <ProjectsKpiRowClient data={emptyData} />
  }

  const now = new Date()

  // Concurrently fetch open invoices and milestones for accurate health assessment
  const [invoicesList, milestonesList] = await Promise.all([
    db
      .select({
        projectId: invoice.projectId,
        status: invoice.status,
        dueDate: invoice.dueDate,
      })
      .from(invoice)
      .where(inArray(invoice.projectId, projectIds)),
    db
      .select({
        projectId: paymentMilestone.projectId,
        status: paymentMilestone.status,
      })
      .from(paymentMilestone)
      .where(inArray(paymentMilestone.projectId, projectIds)),
  ])

  const overdueInvoicesByProject = new Set<string>()
  for (const inv of invoicesList) {
    const isOverdue =
      inv.status === "overdue" ||
      (["sent", "viewed"].includes(inv.status) && new Date(inv.dueDate) < now)
    if (isOverdue) overdueInvoicesByProject.add(inv.projectId)
  }

  const overdueMilestonesByProject = new Set<string>()
  const dueMilestonesByProject = new Set<string>()
  for (const m of milestonesList) {
    if (m.status === "overdue") overdueMilestonesByProject.add(m.projectId)
    if (m.status === "due") dueMilestonesByProject.add(m.projectId)
  }

  let totalCommitted = 0
  let totalDeliverables = 0
  let approvedDeliverables = 0
  let onTrackCount = 0
  let actionCount = 0
  let blockedCount = 0
  let completedCount = 0

  for (const p of rawProjects) {
    // Tally accepted proposal values
    const acceptedProposal = p.proposals.find((prop) => prop.status === "accepted")
    if (acceptedProposal) {
      totalCommitted += convertAmount(
        acceptedProposal.price,
        acceptedProposal.currency,
        targetCurrency,
        { liveRate: usdToInrRate }
      )
    }

    // Deliverables stats
    totalDeliverables += p.deliverables.length
    approvedDeliverables += p.deliverables.filter((d) => d.status === "approved").length

    // Classify health
    if (p.status === "completed") {
      completedCount++
      continue
    }

    const hasOverdueInvoice = overdueInvoicesByProject.has(p.id)
    const hasOverdueMilestone = overdueMilestonesByProject.has(p.id)
    const hasRevisions = p.deliverables.some((d) => d.status === "revision_requested")

    const hasPendingContract = p.contracts.some((c) =>
      ["draft", "sent", "pending_signature", "partially_signed"].includes(c.status)
    )
    const hasInReview = p.deliverables.some((d) => d.status === "in_review")
    const hasDueMilestone = dueMilestonesByProject.has(p.id)

    if (hasOverdueInvoice || hasOverdueMilestone || hasRevisions) {
      blockedCount++
    } else if (hasPendingContract || hasInReview || hasDueMilestone) {
      actionCount++
    } else {
      onTrackCount++
    }
  }

  const activeProjectsCount = rawProjects.filter((p) => p.status !== "completed").length
  const deliverableCompletionRate =
    totalDeliverables > 0 ? Math.round((approvedDeliverables / totalDeliverables) * 100) : 0

  const kpiData: ProjectsKpiData = {
    activeProjectsCount,
    totalCommittedValue: totalCommitted,
    attentionCount: blockedCount + actionCount,
    deliverableCompletionRate,
    approvedDeliverablesCount: approvedDeliverables,
    totalDeliverablesCount: totalDeliverables,
    currency: targetCurrency,
    portfolioHealth: {
      onTrack: onTrackCount,
      actionRequired: actionCount,
      blocked: blockedCount,
      completed: completedCount,
    },
  }

  return <ProjectsKpiRowClient data={kpiData} />
}
