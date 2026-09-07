import { headers } from "next/headers"
import { db } from "@/utils/db"
import { proposal, deliverable } from "@/db/schema"
import { inArray, and, gte } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrgProjects } from "@/utils/cached-org-queries"
import { subDays, subMonths, startOfYear } from "date-fns"
import {
  AnalyticsBreakdownsUI,
  ProposalBreakdownItem,
  DeliverableHealthItem,
} from "./analytics-breakdowns-client"

export async function AnalyticsBreakdowns({ range = "6m" }: { range?: string }) {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  // Fetch workspace projects (cached across sibling components)
  const orgProjects = await getCachedOrgProjects(ctx.organizationId)
  const projectIds = orgProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    const emptyProposals: ProposalBreakdownItem[] = [
      { name: "Accepted", value: 0, color: "#10B981" },
      { name: "Pending", value: 0, color: "#00AAF7" },
      { name: "Declined", value: 0, color: "#EF4444" },
      { name: "Draft", value: 0, color: "#64748B" },
    ]
    const emptyDeliverables: DeliverableHealthItem[] = [
      { label: "Approved", count: 0, percentage: 0, color: "#10B981" },
      { label: "In Review", count: 0, percentage: 0, color: "#00AAF7" },
      { label: "Revision Requested", count: 0, percentage: 0, color: "#F59F0B" },
      { label: "Pending", count: 0, percentage: 0, color: "#64748B" },
    ]
    return (
      <AnalyticsBreakdownsUI
        proposalBreakdown={emptyProposals}
        deliverableHealth={emptyDeliverables}
      />
    )
  }

  const today = new Date()
  let startDate: Date | null = null

  if (range === "30d") startDate = subDays(today, 30)
  else if (range === "90d") startDate = subDays(today, 90)
  else if (range === "ytd") startDate = startOfYear(today)
  else if (range === "6m") startDate = subMonths(today, 5)

  const proposalWhere =
    startDate !== null
      ? and(inArray(proposal.projectId, projectIds), gte(proposal.createdAt, startDate))
      : inArray(proposal.projectId, projectIds)

  // Execute database queries concurrently (Promise.all)
  const [proposalsList, deliverablesList] = await Promise.all([
    db.select({ status: proposal.status }).from(proposal).where(proposalWhere),
    db.select({ status: deliverable.status }).from(deliverable).where(inArray(deliverable.projectId, projectIds)),
  ])

  // Single-pass proposal counts
  let accepted = 0
  let pending = 0
  let declined = 0
  let draft = 0

  proposalsList.forEach((p) => {
    if (p.status === "accepted") accepted++
    else if (p.status === "sent") pending++
    else if (p.status === "declined") declined++
    else if (p.status === "draft") draft++
  })

  const proposalBreakdown: ProposalBreakdownItem[] = [
    { name: "Accepted", value: accepted, color: "#10B981" },
    { name: "Pending", value: pending, color: "#00AAF7" },
    { name: "Declined", value: declined, color: "#EF4444" },
    { name: "Draft", value: draft, color: "#64748B" },
  ]

  // Single-pass deliverable counts
  let dApproved = 0
  let dInReview = 0
  let dRevision = 0
  let dPending = 0
  const dTotal = deliverablesList.length

  deliverablesList.forEach((d) => {
    if (d.status === "approved") dApproved++
    else if (d.status === "in_review") dInReview++
    else if (d.status === "revision_requested") dRevision++
    else dPending++
  })

  const calcPct = (cnt: number) => (dTotal > 0 ? Math.round((cnt / dTotal) * 100) : 0)

  const deliverableHealth: DeliverableHealthItem[] = [
    { label: "Approved", count: dApproved, percentage: calcPct(dApproved), color: "#10B981" },
    { label: "In Review", count: dInReview, percentage: calcPct(dInReview), color: "#00AAF7" },
    { label: "Revision Requested", count: dRevision, percentage: calcPct(dRevision), color: "#F59F0B" },
    { label: "Pending", count: dPending, percentage: calcPct(dPending), color: "#64748B" },
  ]

  return (
    <AnalyticsBreakdownsUI
      proposalBreakdown={proposalBreakdown}
      deliverableHealth={deliverableHealth}
    />
  )
}
