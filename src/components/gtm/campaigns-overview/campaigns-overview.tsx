import { getTenantContext } from "@/lib/tenant-context"
import { listOrgCampaigns } from "@/lib/data/campaigns"
import { asJson } from "@/lib/data/serialize"
import { CampaignsOverviewClient } from "./campaigns-overview-client"
import type { CampaignRow } from "./types"

/** Server-fetches the organization's campaigns for /dashboard/campaigns. */
export async function CampaignsOverview() {
  const { organizationId } = await getTenantContext()
  const campaigns = organizationId ? await listOrgCampaigns(organizationId) : []

  return (
    <CampaignsOverviewClient
      initialCampaigns={asJson<CampaignRow[]>(campaigns)}
    />
  )
}
