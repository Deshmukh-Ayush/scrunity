import { getTenantContext } from "@/lib/tenant-context"
import { getDataSourcesStatus } from "@/lib/data/data-sources"
import { asJson } from "@/lib/data/serialize"
import { loadWithTimeout } from "@/lib/data-sources/load-status"
import type { DataSourcesStatus } from "@/lib/data-sources/types"
import { DataSourcesClient } from "./data-sources-client"
import { KeyDisclosure } from "./key-disclosure"
import { DataSourcesLoadError } from "./load-error-card"

/**
 * Server-fetches the organization's data sources for /dashboard/settings/data-sources.
 * A failed or hung load renders the error card instead of throwing to the root error page.
 */
export async function DataSources() {
  const result = await loadWithTimeout(async () => {
    const { organizationId, memberRole } = await getTenantContext()
    return getDataSourcesStatus(organizationId, memberRole ?? "member")
  })
  if (!result.ok) {
    console.error(`[data-sources page] status didn't load: ${result.reason}, ${result.detail}`)
    return (
      <div className="flex flex-col gap-6">
        <DataSourcesLoadError reason={result.reason} />
        <KeyDisclosure />
      </div>
    )
  }
  return <DataSourcesClient initialStatus={asJson<DataSourcesStatus>(result.value)} />
}
