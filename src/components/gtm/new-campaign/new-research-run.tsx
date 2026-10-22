import { getTenantContext } from "@/lib/tenant-context"
import { getCompanyProfileView } from "@/lib/data/company-profile"
import { asJson } from "@/lib/data/serialize"
import { loadWithTimeout } from "@/lib/data-sources/load-status"
import type { PublicCompanyProfile } from "@/lib/company-profile/input"
import { NewCampaignFlow } from "./new-campaign-flow"

/**
 * Server-loads the saved company profile for /dashboard/campaigns/new. A
 * failed or hung load still renders the full form (nothing is saved then),
 * so starting research never depends on the profile.
 */
export async function NewResearchRun() {
  const result = await loadWithTimeout(async () => {
    const { organizationId, memberRole } = await getTenantContext()
    return getCompanyProfileView(organizationId, memberRole ?? "member")
  })
  if (!result.ok) {
    console.error(`[new research run] company profile didn't load: ${result.reason}, ${result.detail}`)
    return <NewCampaignFlow initialProfile={null} profileLoaded={false} />
  }
  const profile = result.value.profile ? asJson<PublicCompanyProfile>(result.value.profile) : null
  return <NewCampaignFlow initialProfile={profile} />
}
