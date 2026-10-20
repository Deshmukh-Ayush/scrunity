import "server-only"
import { MANAGER_ROLES } from "@/lib/api-role-policy"
import { getConnection } from "@/lib/data-sources/connections"
import { toPublicConnection } from "@/lib/data-sources/public"
import { currentRunEstimate, resolvePeopleProvider } from "@/lib/data-sources/resolve"
import type { DataSourcesStatus } from "@/lib/data-sources/types"

/**
 * The Data sources status for one organization: shared by the API GET route
 * and the server component, so first paint and refetches match. Built from
 * toPublicConnection, so the secret never leaves the server.
 */
export async function getDataSourcesStatus(organizationId: string, role: string): Promise<DataSourcesStatus> {
  const [connection, resolution] = await Promise.all([
    getConnection(organizationId, "apollo"),
    resolvePeopleProvider(organizationId),
  ])
  return {
    access: resolution.kind,
    connection: connection ? toPublicConnection(connection) : null,
    estimate: currentRunEstimate(),
    canManage: MANAGER_ROLES.has(role),
  }
}
