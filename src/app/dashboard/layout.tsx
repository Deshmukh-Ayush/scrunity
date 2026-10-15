import { AppShell } from "@/components/shell/app-shell"
import { AppSidebar } from "@/components/shell/app-sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell sidebar={<AppSidebar />}>{children}</AppShell>
}
