import { listPilotInvites, type AdminPilotInvite } from "@/lib/data/admin"
import { asJson } from "@/lib/data/serialize"
import { AdminInvitesClient } from "./admin-invites-client"

/** Server-fetches the pilot invite list for the platform admin page. */
export async function AdminInvites() {
  const invites = await listPilotInvites()
  return <AdminInvitesClient invites={asJson<AdminPilotInvite[]>(invites)} />
}
