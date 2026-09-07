import { headers } from "next/headers"
import { db } from "@/utils/db"
import { projectMember, user, invitation, proposal, organization } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrgProjects } from "@/utils/cached-org-queries"
import { ClientsTableClient, ClientTableItem } from "./clients-table-client"
import { convertAndAggregate, getUsdToInrRate } from "@/lib/currency"

export async function ClientsTable({ status = "all" }: { status?: string }) {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  // Fetch workspace projects (cached across sibling components)
  const orgProjects = await getCachedOrgProjects(ctx.organizationId)

  const [org] = await db
    .select({ globalCurrency: organization.globalCurrency })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId))
  const targetCurrency = (org?.globalCurrency as "USD" | "INR") || "USD"

  const projectIds = orgProjects.map((p) => p.id)

  // Concurrent queries for client members, invitations, proposals, and live FX rate (Promise.all)
  const [clientMembers, pendingInvites, proposalsList, usdToInrRate] = await Promise.all([
    projectIds.length > 0
      ? db
          .select({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userImage: user.image,
            projectId: projectMember.projectId,
            createdAt: projectMember.createdAt,
          })
          .from(projectMember)
          .innerJoin(user, eq(projectMember.userId, user.id))
          .where(and(inArray(projectMember.projectId, projectIds), eq(projectMember.role, "client")))
      : [],
    db
      .select({
        id: invitation.id,
        email: invitation.email,
        createdAt: invitation.createdAt,
      })
      .from(invitation)
      .where(and(eq(invitation.organizationId, ctx.organizationId), eq(invitation.status, "pending"))),
    projectIds.length > 0
      ? db
          .select({
            projectId: proposal.projectId,
            price: proposal.price,
            currency: proposal.currency,
            status: proposal.status,
          })
          .from(proposal)
          .where(inArray(proposal.projectId, projectIds))
      : [],
    getUsdToInrRate(),
  ])

  // Build client items
  const clientMap = new Map<string, ClientTableItem>()

  // Process active clients
  clientMembers.forEach((m) => {
    const existing = clientMap.get(m.userEmail)
    const projectProposals = proposalsList.filter((p) => p.projectId === m.projectId)
    const acceptedItems = projectProposals
      .filter((p) => p.status === "accepted")
      .map((p) => ({ amount: p.price, currency: p.currency }))
    const { total: acceptedVal } = convertAndAggregate(acceptedItems, targetCurrency, usdToInrRate)

    if (existing) {
      existing.activeProjectsCount += 1
      existing.totalContractValue += acceptedVal
    } else {
      clientMap.set(m.userEmail, {
        id: m.userId,
        name: m.userName,
        email: m.userEmail,
        image: m.userImage,
        status: "active",
        activeProjectsCount: 1,
        totalContractValue: acceptedVal,
        currency: targetCurrency,
        joinedDate: m.createdAt.toISOString(),
        projectId: m.projectId,
      })
    }
  })

  // Process invited clients
  pendingInvites.forEach((inv) => {
    if (!clientMap.has(inv.email)) {
      clientMap.set(inv.email, {
        id: inv.id,
        name: null,
        email: inv.email,
        image: null,
        status: "invited",
        activeProjectsCount: 0,
        totalContractValue: 0,
        currency: targetCurrency,
        joinedDate: inv.createdAt.toISOString(),
        projectId: null,
      })
    }
  })

  const clientsData = Array.from(clientMap.values())

  return (
    <ClientsTableClient
      clients={clientsData}
      initialStatus={status as "all" | "active" | "invited"}
    />
  )
}
