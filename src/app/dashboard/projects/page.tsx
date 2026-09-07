import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getCachedTenant } from "@/utils/cached-tenant"
import { getAccessibleProjects } from "@/lib/project-queries"
import { ProjectsTableClient, ProjectTableItem } from "@/components/dashboard/projects/projects-table-client"
import { ProjectsKpiRow } from "@/components/dashboard/projects/projects-kpi-row"
import { CreateProjectDialog } from "@/components/create-project-dialog"
import { db } from "@/utils/db"
import { organization, invoice, paymentMilestone } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { convertAmount, getUsdToInrRate } from "@/lib/currency"

async function ProjectsData({
  status = "all",
  sort = "updated",
}: {
  status?: string
  sort?: string
}) {
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
  const now = new Date()

  // Concurrently fetch open invoices and milestones for project health classification
  const [invoicesList, milestonesList] = await Promise.all([
    projectIds.length > 0
      ? db
          .select({
            projectId: invoice.projectId,
            status: invoice.status,
            dueDate: invoice.dueDate,
          })
          .from(invoice)
          .where(inArray(invoice.projectId, projectIds))
      : [],
    projectIds.length > 0
      ? db
          .select({
            projectId: paymentMilestone.projectId,
            status: paymentMilestone.status,
          })
          .from(paymentMilestone)
          .where(inArray(paymentMilestone.projectId, projectIds))
      : [],
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

  const projectsData: ProjectTableItem[] = rawProjects.map((p) => {
    const acceptedProposal = p.proposals.find((prop) => prop.status === "accepted")
    const latestContract = p.contracts[0]

    // Classify health
    let healthStatus: "on_track" | "action_required" | "blocked" | "completed" = "on_track"
    if (p.status === "completed") {
      healthStatus = "completed"
    } else {
      const hasOverdueInvoice = overdueInvoicesByProject.has(p.id)
      const hasOverdueMilestone = overdueMilestonesByProject.has(p.id)
      const hasRevisions = p.deliverables.some((d) => d.status === "revision_requested")
      const hasPendingContract = p.contracts.some((c) =>
        ["draft", "sent", "pending_signature", "partially_signed"].includes(c.status)
      )
      const hasInReview = p.deliverables.some((d) => d.status === "in_review")
      const hasDueMilestone = dueMilestonesByProject.has(p.id)

      if (hasOverdueInvoice || hasOverdueMilestone || hasRevisions) {
        healthStatus = "blocked"
      } else if (hasPendingContract || hasInReview || hasDueMilestone) {
        healthStatus = "action_required"
      } else {
        healthStatus = "on_track"
      }
    }

    const val = acceptedProposal
      ? convertAmount(acceptedProposal.price, acceptedProposal.currency, targetCurrency, {
          liveRate: usdToInrRate,
        })
      : null

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      healthStatus,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      members: p.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      })),
      contractValue: val,
      currency: targetCurrency,
      contractStatus: latestContract ? latestContract.status : null,
      deliverableStats: {
        total: p.deliverables.length,
        approved: p.deliverables.filter((d) => d.status === "approved").length,
      },
    }
  })

  // Filter based on URL status param
  let filtered = projectsData
  if (status === "action") {
    filtered = projectsData.filter(
      (p) => p.healthStatus === "action_required" || p.healthStatus === "blocked"
    )
  } else if (status === "on_track") {
    filtered = projectsData.filter((p) => p.healthStatus === "on_track")
  } else if (status === "completed") {
    filtered = projectsData.filter((p) => p.status === "completed")
  }

  // Sort based on URL sort param
  if (sort === "value") {
    filtered.sort((a, b) => (b.contractValue || 0) - (a.contractValue || 0))
  } else if (sort === "deliverables") {
    filtered.sort((a, b) => b.deliverableStats.total - a.deliverableStats.total)
  } else {
    // default: updated
    filtered.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  return (
    <ProjectsTableClient
      projects={filtered}
      totalWorkspaceCount={rawProjects.length}
    />
  )
}

export default async function DashboardProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>
}) {
  const { status = "all", sort = "updated" } = await searchParams

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Header Bar: Clear page identification and primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage contracts, deliverables, and client collaboration across your workspace.
          </p>
        </div>

        <div className="shrink-0">
          <CreateProjectDialog />
        </div>
      </div>

      {/* Level 1: KPI Row & Portfolio Health Breakdown */}
      <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-xl" />}>
        <ProjectsKpiRow />
      </Suspense>

      {/* Level 2: Filtered & Sorted Projects Table with Unified Toolbar */}
      <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
        <ProjectsData status={status} sort={sort} />
      </Suspense>
    </div>
  )
}