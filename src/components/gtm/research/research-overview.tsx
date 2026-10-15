import { getTenantContext } from "@/lib/tenant-context"
import { listOrgResearchRuns } from "@/lib/data/research-runs"
import { asJson } from "@/lib/data/serialize"
import type { ResearchRunItem } from "../campaigns-overview/types"
import { ResearchOverviewClient } from "./research-overview-client"

/** Server-fetches the organization's research runs for /dashboard/research. */
export async function ResearchOverview() {
  const { organizationId } = await getTenantContext()
  const runs = organizationId ? await listOrgResearchRuns(organizationId) : []

  return (
    <ResearchOverviewClient initialRuns={asJson<ResearchRunItem[]>(runs)} />
  )
}
