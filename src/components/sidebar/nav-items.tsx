"use client";

import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Sidebar Context so children automatically know collapse state
export const SidebarContext = React.createContext<{ isCollapsed: boolean }>({
  isCollapsed: false,
});

export const useSidebarContext = () => React.useContext(SidebarContext);

type NavItemProps = React.ComponentPropsWithoutRef<"div"> & {
  asChild?: boolean;
  isActive?: boolean;
  title?: string;
};

export const NavItem = forwardRef<HTMLDivElement, NavItemProps>(
  ({ asChild, isActive, title, className, children, ...props }, ref) => {
    const { isCollapsed } = useSidebarContext();
    const content = asChild && React.isValidElement(children) ? (
      <Slot
        ref={ref}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group relative flex h-10 items-center gap-2.5 rounded-md text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none",
          isCollapsed ? "mx-auto w-8 justify-center px-0" : "w-full px-2.5",
          isActive
            ? "text-primary font-semibold"
            : "text-neutral-700 dark:text-neutral-300 hover:bg-foreground/4 hover:text-foreground",
          className
        )}
        {...props}
      >
        {React.cloneElement(children as React.ReactElement<any>, {
          children: (
            <>
              {isActive && (
                <motion.div
                  layoutId="activeSidebarItem"
                  className="absolute inset-0 rounded-md bg-primary/10 border border-primary/20 pointer-events-none"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2.5 w-full">
                {(children.props as any).children}
              </span>
            </>
          ),
        })}
      </Slot>
    ) : (
      <div
        ref={ref}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group relative flex h-10 items-center gap-2.5 rounded-md text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none",
          isCollapsed ? "mx-auto w-8 justify-center px-0" : "w-full px-2.5",
          isActive
            ? "text-primary font-semibold"
            : "text-neutral-700 dark:text-neutral-300 hover:bg-foreground/4 hover:text-foreground",
          className
        )}
        {...props}
      >
        {isActive && (
          <motion.div
            layoutId="activeSidebarItem"
            className="absolute inset-0 rounded-md bg-primary/10 border border-primary/20 pointer-events-none"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2.5 w-full">{children}</span>
      </div>
    );

    // Show tooltip automatically when collapsed
    if (isCollapsed && title) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="bg-foreground text-xs font-medium text-background">
            {title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  }
);
NavItem.displayName = "NavItem";

export function NavItemLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  const { isCollapsed } = useSidebarContext();

  return (
    <span
      aria-hidden={isCollapsed}
      className={cn(
        "truncate transition-opacity duration-200",
        isCollapsed ? "sr-only" : "opacity-100",
        className
      )}
    >
      {children}
    </span>
  );
}

export function NavItemBadge({ count }: { count: number }) {
  const { isCollapsed } = useSidebarContext();
  
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : count;

  return (
    <>
      <span className="sr-only">, {count} unread notifications</span>
      {isCollapsed ? (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary/80 ring-2 ring-background animate-in fade-in zoom-in duration-300"
        />
      ) : (
        <span
          aria-hidden="true"
          className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1.5 text-[10px] font-medium text-secondary-foreground tabular-nums animate-in fade-in zoom-in duration-300"
        >
          {displayCount}
        </span>
      )}
    </>
  );
}