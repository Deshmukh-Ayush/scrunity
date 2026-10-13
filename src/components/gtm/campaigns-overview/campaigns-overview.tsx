import { getTenantContext } from "@/lib/tenant-context"
import { listOrgCampaigns } from "@/lib/data/campaigns"
import { listOrgResearchRuns } from "@/lib/data/research-runs"
import { asJson } from "@/lib/data/serialize"
import { CampaignsOverviewClient } from "./campaigns-overview-client"
import type { CampaignItem, ResearchRunItem } from "./types"

/** Server-fetches research runs and campaigns for /dashboard/campaigns. */
export async function CampaignsOverview() {
  const { organizationId } = await getTenantContext()

  const [runs, campaigns] = organizationId
    ? await Promise.all([
        listOrgResearchRuns(organizationId),
        listOrgCampaigns(organizationId),
      ])
    : [[], []]

  return (
    <CampaignsOverviewClient
      initialRuns={asJson<ResearchRunItem[]>(runs)}
      initialCampaigns={asJson<CampaignItem[]>(campaigns)}
    />
  )
}
