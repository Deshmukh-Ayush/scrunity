/**
 * Platform admins (the founder) are listed in PLATFORM_ADMIN_EMAILS,
 * comma-separated. They are not an organization role: being an org owner
 * grants nothing here. No `server-only` import so src/proxy.ts can use it.
 */
export function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

/** True for a verified session email listed in PLATFORM_ADMIN_EMAILS. */
export function isPlatformAdminUser(user: { email?: string | null; emailVerified?: boolean | null } | null | undefined) {
  if (!user?.email || !user.emailVerified) return false
  return platformAdminEmails().has(user.email.trim().toLowerCase())
}
