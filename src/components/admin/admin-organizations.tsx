import {
  listOrganizationsForAdmin,
  listRecentManualGrants,
  type AdminManualGrant,
  type AdminOrganization,
} from "@/lib/data/admin"
import { asJson } from "@/lib/data/serialize"
import { AdminOrganizationsClient } from "./admin-organizations-client"

/** Server-fetches every organization's plan and balance plus recent manual grants. */
export async function AdminOrganizations() {
  const [organizations, grants] = await Promise.all([
    listOrganizationsForAdmin(),
    listRecentManualGrants(),
  ])
  return (
    <AdminOrganizationsClient
      organizations={asJson<AdminOrganization[]>(organizations)}
      grants={asJson<AdminManualGrant[]>(grants)}
    />
  )
}
