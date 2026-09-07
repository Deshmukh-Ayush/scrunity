import { headers } from "next/headers"
import { db } from "@/utils/db"
import { activityLog } from "@/db/schema"
import { inArray, gte, and } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrg, getCachedOrgMembers, getCachedOrgProjects } from "@/utils/cached-org-queries"
import { subDays } from "date-fns"
import { TeamKpiRowClient, TeamKpiData } from "./team-kpi-row-client"
import { BILLING_CONFIG, type PlanTier } from "@/config/billing"

export async function TeamKpiRow({ range = "30d" }: { range?: string }) {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  const today = new Date()
  const sevenDaysAgo = subDays(today, 6)

  let rangeStartDate: Date
  let periodLabel = "Monthly"
  let periodDescription = "this month"

  if (range === "7d") {
    rangeStartDate = subDays(today, 6)
    periodLabel = "7-Day"
    periodDescription = "in the last 7 days"
  } else if (range === "90d") {
    rangeStartDate = subDays(today, 89)
    periodLabel = "Quarterly"
    periodDescription = "in the last 90 days"
  } else if (range === "all") {
    rangeStartDate = new Date(0)
    periodLabel = "All Time"
    periodDescription = "all time"
  } else {
    rangeStartDate = subDays(today, 29)
    periodLabel = "Monthly"
    periodDescription = "this month"
  }

  // Concurrent queries for org plan, members, and workspace projects (cached across siblings)
  const [org, orgMembers, orgProjects] = await Promise.all([
    getCachedOrg(ctx.organizationId),
    getCachedOrgMembers(ctx.organizationId),
    getCachedOrgProjects(ctx.organizationId),
  ])

  const projectIds = orgProjects.map((p) => p.id)

  // Query activity logs concurrently if projects exist
  const [recentActivities, rangeActivities] = projectIds.length > 0
    ? await Promise.all([
        db
          .select({ userId: activityLog.userId })
          .from(activityLog)
          .where(and(inArray(activityLog.projectId, projectIds), gte(activityLog.createdAt, sevenDaysAgo))),
        db
          .select({ id: activityLog.id })
          .from(activityLog)
          .where(and(inArray(activityLog.projectId, projectIds), gte(activityLog.createdAt, rangeStartDate))),
      ])
    : [[], []]

  // Seat capacity based on plan
  const plan = (org?.plan || "free") as PlanTier
  const planConfig = BILLING_CONFIG[plan] || BILLING_CONFIG.free
  const maxSeats = planConfig.maxSeats
  const activeSeats = orgMembers.length

  // Role distribution
  let ownerCount = 0
  let memberCount = 0

  orgMembers.forEach((m) => {
    if (m.role === "owner" || m.role === "admin") {
      ownerCount++
    } else {
      memberCount++
    }
  })

  // Active contributors in last 7 days
  const activeUserSet = new Set(recentActivities.map((a) => a.userId).filter(Boolean))
  const activeContributors = activeUserSet.size || (activeSeats > 0 ? 1 : 0)

  const kpiData: TeamKpiData = {
    activeSeats,
    maxSeats,
    activeContributors,
    ownerCount,
    adminCount: 0,
    memberCount,
    teamPace: rangeActivities.length,
    periodLabel,
    periodDescription,
  }

  return <TeamKpiRowClient data={kpiData} />
}
