import { getTenantContext } from "@/lib/tenant-context"
import { getAccessibleProjectIds } from "@/lib/project-queries"
import { headers } from "next/headers"
import { db } from "@/utils/db"
import { invoice, deliverable, contract, project } from "@/db/schema"
import { inArray, eq, lt, or, and } from "drizzle-orm"
import Link from "next/link"
import { format } from "date-fns"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"
import {
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react/dist/ssr"
import { AttentionItemsList, type AttentionItem } from "./attention-items-list"

export async function DashboardAttentionTable() {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.user) {
    return null
  }

  const projectIds = await getAccessibleProjectIds(ctx.user.id, ctx.organizationId)

  if (projectIds.length === 0) {
    return (
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" /> Projects Requiring Attention
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              All clear
            </span>
          </div>
        }
      >
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No active projects yet</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Create your first client project to track deliverables, contracts, and cash flow.
          </p>
        </div>
      </ConcentricCard>
    )
  }

  const now = new Date()

  // Concurrently query overdue invoices, in-review deliverables, and pending contracts
  const [overdueInvoices, reviewDeliverables, pendingContracts] = await Promise.all([
    db
      .select({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        projectId: invoice.projectId,
        total: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        status: invoice.status,
        projectName: project.name,
      })
      .from(invoice)
      .innerJoin(project, eq(invoice.projectId, project.id))
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
      .select({
        id: deliverable.id,
        title: deliverable.title,
        projectId: deliverable.projectId,
        status: deliverable.status,
        dueDate: deliverable.dueDate,
        projectName: project.name,
      })
      .from(deliverable)
      .innerJoin(project, eq(deliverable.projectId, project.id))
      .where(
        and(
          inArray(deliverable.projectId, projectIds),
          inArray(deliverable.status, ["in_review", "revision_requested"])
        )
      ),
    db
      .select({
        id: contract.id,
        fileName: contract.fileName,
        documentType: contract.documentType,
        projectId: contract.projectId,
        status: contract.status,
        createdAt: contract.createdAt,
        projectName: project.name,
      })
      .from(contract)
      .innerJoin(project, eq(contract.projectId, project.id))
      .where(
        and(
          inArray(contract.projectId, projectIds),
          inArray(contract.status, ["draft", "sent", "pending_signature", "partially_signed"])
        )
      ),
  ])

  // Assemble attention items
  const items: AttentionItem[] = []

  for (const inv of overdueInvoices) {
    const formattedAmount =
      inv.currency === "INR"
        ? `₹${inv.total.toLocaleString("en-IN")}`
        : `$${inv.total.toLocaleString("en-US")}`
    items.push({
      id: inv.id,
      projectId: inv.projectId,
      projectName: inv.projectName,
      title: `Invoice ${inv.invoiceNumber} (${formattedAmount})`,
      subtitle: `Due ${format(new Date(inv.dueDate), "MMM d, yyyy")}`,
      type: "invoice",
      priority: 1,
      badgeText: "Overdue",
      badgeClass: "border-destructive/30 bg-destructive/10 text-destructive",
      actionLabel: "View invoice",
      href: `/projects/${inv.projectId}/payments/invoices`,
    })
  }

  for (const deliv of reviewDeliverables) {
    const isRevision = deliv.status === "revision_requested"
    items.push({
      id: deliv.id,
      projectId: deliv.projectId,
      projectName: deliv.projectName,
      title: deliv.title,
      subtitle: isRevision ? "Client requested revisions" : "Awaiting review & approval",
      type: "deliverable",
      priority: isRevision ? 2 : 3,
      badgeText: isRevision ? "Revision requested" : "In review",
      badgeClass: isRevision
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
      actionLabel: "Review task",
      href: `/projects/${deliv.projectId}/deliverables`,
    })
  }

  for (const ctr of pendingContracts) {
    const isPartiallySigned = ctr.status === "partially_signed"
    const isDraft = ctr.status === "draft"
    items.push({
      id: ctr.id,
      projectId: ctr.projectId,
      projectName: ctr.projectName,
      title: ctr.fileName,
      subtitle: isDraft
        ? "Draft agreement not yet sent"
        : isPartiallySigned
        ? "Waiting for counter-party signature"
        : "Awaiting e-signatures",
      type: "contract",
      priority: isDraft ? 5 : 4,
      badgeText: isDraft
        ? "Draft agreement"
        : isPartiallySigned
        ? "Partially signed"
        : "Pending signature",
      badgeClass: isDraft
        ? "border-neutral-500/30 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400"
        : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
      actionLabel: "View agreement",
      href: `/projects/${ctr.projectId}/contract`,
    })
  }

  // Sort by priority (most urgent first)
  items.sort((a, b) => a.priority - b.priority)

  const totalCount = items.length

  return (
    <ConcentricCard
      headerExtra={
        <div className="flex items-center justify-between w-full">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {totalCount > 0 ? (
              <WarningCircleIcon className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
            )}
            Projects Requiring Attention
          </span>
          <span
            className={
              totalCount > 0
                ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive tabular-nums"
                : "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            }
          >
            {totalCount > 0
              ? `${totalCount} item${totalCount !== 1 ? "s" : ""} needing action`
              : "All systems healthy"}
          </span>
        </div>
      }
    >
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">All projects on track</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            No overdue invoices, pending deliverable reviews, or unsigned agreements require your attention right now.
          </p>
        </div>
      ) : (
        <AttentionItemsList items={items} />
      )}
    </ConcentricCard>
  )
}
