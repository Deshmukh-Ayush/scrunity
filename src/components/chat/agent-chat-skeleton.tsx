import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AgentChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      {/* Sidebar Skeleton */}
      <div className="w-72 sm:w-80 border-r border-border/60 bg-muted/20 flex flex-col h-full shrink-0 p-3 space-y-4 animate-pulse">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
          <Skeleton className="size-7 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>

        <Skeleton className="h-8 w-full rounded-xl" />
        <Skeleton className="h-8 w-full rounded-lg" />

        <div className="space-y-2 flex-1 pt-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-3 w-20 pt-2" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center gap-2">
          <Skeleton className="size-7 rounded-full" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-32" />
          </div>
        </div>
      </div>

      {/* Main Pane Skeleton */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-background animate-pulse">
        <div className="h-12 border-b border-border/60 px-6 flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>

        <div className="flex-1 p-8 space-y-6 max-w-3xl mx-auto w-full">
          <div className="flex justify-end">
            <Skeleton className="h-12 w-64 rounded-2xl" />
          </div>

          <div className="flex items-start gap-3">
            <Skeleton className="size-7 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-10 w-72 rounded-lg" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border/50 max-w-3xl mx-auto w-full">
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
