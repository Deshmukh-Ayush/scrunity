import { getTenantContext } from "@/lib/tenant-context"
import { listOrgCampaigns } from "@/lib/data/campaigns"
import { asJson } from "@/lib/data/serialize"
import { CampaignsListClient, type CampaignItem } from "./campaigns-list-client"

/** Server-fetches the organization's campaigns for the dashboard home table. */
export async function CampaignsList() {
  const { organizationId } = await getTenantContext()
  const campaigns = organizationId ? await listOrgCampaigns(organizationId) : []

  return (
    <CampaignsListClient initialCampaigns={asJson<CampaignItem[]>(campaigns)} />
  )
}
