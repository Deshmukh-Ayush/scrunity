import { getTenantContext } from "@/lib/tenant-context"
import { getDataSourcesStatus } from "@/lib/data/data-sources"
import { asJson } from "@/lib/data/serialize"
import type { DataSourcesStatus } from "@/lib/data-sources/types"
import { DataSourcesClient } from "./data-sources-client"

/** Server-fetches the organization's data sources for /dashboard/settings/data-sources. */
export async function DataSources() {
  const { organizationId, memberRole } = await getTenantContext()
  const status = await getDataSourcesStatus(organizationId, memberRole ?? "member")
  return <DataSourcesClient initialStatus={asJson<DataSourcesStatus>(status)} />
}
