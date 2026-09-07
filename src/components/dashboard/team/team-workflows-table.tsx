import { headers } from "next/headers"
import { db } from "@/utils/db"
import { project } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { TeamWorkflowsTableClient, WorkflowItem } from "./team-workflows-table-client"

export async function TeamWorkflowsTable() {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  // Fetch raw projects with creator, deliverables, activity logs
  const rawProjects = await db.query.project.findMany({
    where: eq(project.organizationId, ctx.organizationId),
    with: {
      creator: true,
      deliverables: true,
      activityLogs: true,
    },
    orderBy: (p, { desc }) => [desc(p.updatedAt)],
    limit: 10,
  })

  const workflows: WorkflowItem[] = rawProjects.map((p) => {
    const approvedDeliverables = p.deliverables.filter((d) => d.status === "approved").length

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: (p.status as "active" | "completed" | "archived") || "active",
      activityCount: p.activityLogs.length,
      approvedDeliverables,
      totalDeliverables: p.deliverables.length,
      updatedAt: p.updatedAt.toISOString(),
      creator: p.creator
        ? {
            id: p.creator.id,
            name: p.creator.name,
            email: p.creator.email,
            image: p.creator.image,
          }
        : null,
    }
  }).sort((a, b) => b.activityCount - a.activityCount)

  return <TeamWorkflowsTableClient workflows={workflows} />
}
