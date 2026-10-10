import { Suspense } from "react";
import type { Metadata } from "next";
import { MailboxClient } from "@/components/mailbox/mailbox-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Mailbox | Scrunity",
  description: "Manage connected sending mailboxes and view outbound campaigns and prospect replies.",
};

function MailboxSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background">
      <div className="border-b border-border/70 px-6 py-4 flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-80 md:w-96 border-r border-border/70 p-4 space-y-4">
          <Skeleton className="h-8 w-full" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 border border-border/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden sm:flex flex-1 p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function MailboxPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Suspense fallback={<MailboxSkeleton />}>
        <MailboxClient />
      </Suspense>
    </div>
  );
}
