import { getTenantContext } from "@/lib/tenant-context"
import { getShellData } from "@/lib/data/shell"
import { SidebarContent } from "./sidebar-content"

/**
 * Server half of the sidebar: who is signed in, the workspace name and the
 * credit balance. The layout renders it as a slot, so the layout itself stays
 * free of awaits and queries.
 */
export async function AppSidebar() {
  const { user, organizationId } = await getTenantContext()
  const shell = organizationId
    ? await getShellData(organizationId)
    : { workspaceName: null, creditsRemaining: null }

  return (
    <SidebarContent
      userId={user?.id ?? "anonymous"}
      userEmail={user?.email ?? ""}
      workspaceName={shell.workspaceName ?? "Workspace"}
      creditsRemaining={shell.creditsRemaining}
    />
  )
}
