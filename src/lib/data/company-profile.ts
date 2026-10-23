import "server-only"
import { MANAGER_ROLES } from "@/lib/api-role-policy"
import { getCompanyProfile } from "@/lib/company-profile/store"
import type { CompanyProfileView } from "@/lib/company-profile/input"

/**
 * The company profile for one organization, shared by the API GET route and
 * the server components (Settings, New research run), so first paint and
 * refetches match. Owners and admins can edit; members read.
 */
export async function getCompanyProfileView(organizationId: string, role: string): Promise<CompanyProfileView> {
  return { profile: await getCompanyProfile(organizationId), canEdit: MANAGER_ROLES.has(role) }
}
