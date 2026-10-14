import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getPlatformAdmin } from "@/lib/platform-admin"
import { AdminInvites } from "@/components/admin/admin-invites"
import { AdminOrganizations } from "@/components/admin/admin-organizations"

export const metadata: Metadata = {
  title: "Platform admin | Scrunity",
  robots: { index: false, follow: false },
}

/**
 * Platform admin (PLATFORM_ADMIN_EMAILS only). src/proxy.ts already answers
 * everyone else with a 404; the check is repeated here against the session.
 */
export default async function PlatformAdminPage() {
  if (!(await getPlatformAdmin(await headers()))) notFound()

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8 p-4 md:p-6 lg:p-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Platform admin</h1>
        <p className="text-sm text-muted-foreground">
          Pilot invites and manual credit grants. Only the emails in PLATFORM_ADMIN_EMAILS can see this page.
        </p>
      </div>
      <AdminInvites />
      <AdminOrganizations />
    </div>
  )
}
