
import { useSidebarCollapse } from "@/hooks/use-sidebar-collapse"
import { cn } from "@/lib/utils"
import { PanelLeft } from "@/components/ui/icons"

type CollapseToggleProps = React.ComponentPropsWithoutRef<"button">

export function CollapseToggle({ className, ...props }: CollapseToggleProps) {
  const { isCollapsed, toggle } = useSidebarCollapse()

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className
      )}
      {...props}
    >
      <PanelLeft className="size-5" />
    </button>
  )
}
