import { getTenantContext } from "@/lib/tenant-context"
import { getCompanyProfileView } from "@/lib/data/company-profile"
import { asJson } from "@/lib/data/serialize"
import { loadWithTimeout } from "@/lib/data-sources/load-status"
import { COMPANY_PROFILE_COPY as COPY } from "@/lib/company-profile/copy"
import type { CompanyProfileView } from "@/lib/company-profile/input"
import { CompanySettingsClient } from "./company-settings-client"

/**
 * Server-fetches the company profile for /dashboard/settings/company. A
 * failed or hung load shows a message instead of throwing to the root error page.
 */
export async function CompanySettings() {
  const result = await loadWithTimeout(async () => {
    const { organizationId, memberRole } = await getTenantContext()
    return getCompanyProfileView(organizationId, memberRole ?? "member")
  })
  if (!result.ok) {
    console.error(`[company settings] profile didn't load: ${result.reason}, ${result.detail}`)
    return (
      <p role="alert" className="rounded-xl bg-surface p-4 text-body text-fg-default shadow-surface sm:p-6">
        {COPY.loadFailed}
      </p>
    )
  }
  return <CompanySettingsClient initialView={asJson<CompanyProfileView>(result.value)} />
}
