import "server-only"
import { auth } from "@/lib/auth"
import { isPlatformAdminUser } from "@/lib/platform-admin-emails"

export interface PlatformAdmin {
  userId: string
  email: string
}

/**
 * The signed-in platform admin, or null. Always resolves the Better Auth
 * session itself (never the proxy's x-user-* headers or the localhost
 * `test_org` impersonation) and requires a verified email listed in
 * PLATFORM_ADMIN_EMAILS. Callers answer null with a plain 404 so admin routes
 * are not discoverable.
 */
export async function getPlatformAdmin(reqHeaders: Headers): Promise<PlatformAdmin | null> {
  const session = await auth.api.getSession({ headers: reqHeaders }).catch(() => null)
  const user = session?.user
  if (!user || !isPlatformAdminUser(user)) return null
  return { userId: user.id, email: user.email.toLowerCase() }
}
