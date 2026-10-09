import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full flex-col md:flex-row dark:bg-neutral-950 bg-gray-50">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 h-svh overflow-hidden">
        <DashboardTopbar />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
