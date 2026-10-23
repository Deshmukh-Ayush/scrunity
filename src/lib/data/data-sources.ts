import "server-only"
import { MANAGER_ROLES } from "@/lib/api-role-policy"
import { getConnection } from "@/lib/data-sources/connections"
import { listImports } from "@/lib/contact-import/store"
import { toPublicConnection } from "@/lib/data-sources/public"
import { currentRunEstimate, resolvePeopleProvider } from "@/lib/data-sources/resolve"
import type { DataSourcesStatus } from "@/lib/data-sources/types"

/**
 * The Data sources status for one organization: shared by the API GET route
 * and the server component, so first paint and refetches match. Built from
 * toPublicConnection, so the secret never leaves the server.
 */
export async function getDataSourcesStatus(organizationId: string, role: string): Promise<DataSourcesStatus> {
  const [connection, resolution, imports] = await Promise.all([
    getConnection(organizationId, "apollo"),
    resolvePeopleProvider(organizationId),
    listImports(organizationId),
  ])
  return {
    // Without an import id the resolver never answers csv_import.
    access: resolution.kind === "csv_import" ? "not_connected" : resolution.kind,
    connection: connection ? toPublicConnection(connection) : null,
    imports,
    estimate: currentRunEstimate(),
    canManage: MANAGER_ROLES.has(role),
  }
}
