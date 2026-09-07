import { headers } from "next/headers"
import { db } from "@/utils/db"
import { activityLog } from "@/db/schema"
import { inArray, and, gte } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrgMembers, getCachedOrgProjects } from "@/utils/cached-org-queries"
import { subDays } from "date-fns"
import {
  TeamAnalyticsBreakdownUI,
  TopContributorItem,
  TeamActivityLogItem,
} from "./team-analytics-breakdown-client"

function getActivityMessage(type: string): string {
  const typeMap: Record<string, string> = {
    contract_uploaded: "uploaded a new contract SOW",
    contract_signed: "signed the contract SOW",
    file_uploaded: "uploaded a project file",
    deliverable_created: "created a new deliverable",
    deliverable_approved: "approved a deliverable",
    revision_requested: "requested revision on a deliverable",
    deliverable_completed: "completed a deliverable",
    project_completed: "marked project as completed",
    member_joined: "joined the project workspace",
    deliverable_in_review: "submitted deliverable for review",
    comment_added: "added a project comment",
    proposal_sent: "sent a new proposal",
    proposal_accepted: "accepted the proposal",
    proposal_declined: "declined the proposal",
    payment_completed: "processed a payment milestone",
  }
  return typeMap[type] || `performed ${type.replace(/_/g, " ")}`
}

export async function TeamAnalyticsBreakdown({ range = "30d" }: { range?: string }) {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  const today = new Date()
  let startDate: Date
  if (range === "7d") {
    startDate = subDays(today, 6)
  } else if (range === "90d") {
    startDate = subDays(today, 89)
  } else if (range === "all") {
    startDate = new Date(0)
  } else {
    // default 30d
    startDate = subDays(today, 29)
  }

  // Fetch workspace projects & members (cached across sibling components)
  const [orgMembers, orgProjects] = await Promise.all([
    getCachedOrgMembers(ctx.organizationId),
    getCachedOrgProjects(ctx.organizationId),
  ])

  const projectIds = orgProjects.map((p) => p.id)

  // Query activity logs concurrently: range-bounded for user action counts + recent stream
  const [rangeActivities, recentRawActivities] = projectIds.length > 0
    ? await Promise.all([
        db
          .select({ userId: activityLog.userId })
          .from(activityLog)
          .where(
            and(
              inArray(activityLog.projectId, projectIds),
              gte(activityLog.createdAt, startDate)
            )
          ),
        db.query.activityLog.findMany({
          where: inArray(activityLog.projectId, projectIds),
          with: {
            user: true,
          },
          orderBy: (act, { desc }) => [desc(act.createdAt)],
          limit: 8,
        }),
      ])
    : [[], []]

  // Count actions per user within the selected date range
  const actionCountMap = new Map<string, number>()
  rangeActivities.forEach((act) => {
    if (act.userId) {
      actionCountMap.set(act.userId, (actionCountMap.get(act.userId) || 0) + 1)
    }
  })

  const topContributors: TopContributorItem[] = orgMembers
    .map((m) => ({
      id: m.user.id,
      name: m.user.name || m.user.email.split("@")[0],
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      actionCount: actionCountMap.get(m.user.id) || 0,
    }))
    .sort((a, b) => b.actionCount - a.actionCount)
    .slice(0, 5)

  const recentActivities: TeamActivityLogItem[] = recentRawActivities.map((act) => ({
    id: act.id,
    type: act.type,
    message: getActivityMessage(act.type),
    createdAt: act.createdAt.toISOString(),
    user: act.user
      ? {
          name: act.user.name,
          email: act.user.email,
          image: act.user.image,
        }
      : null,
  }))

  return (
    <TeamAnalyticsBreakdownUI
      topContributors={topContributors}
      recentActivities={recentActivities}
    />
  )
}
