import * as React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { LeadsSection } from "@/components/leads/leads-section";
import { LeadsSkeleton } from "@/components/leads/leads-skeleton";

export const metadata: Metadata = {
  title: "Leads | Scrunity",
  description: "View and filter all prospect leads and contacts across campaigns.",
};

export default async function LeadsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;

  return (
    <div className="p-6 md:p-8">
      <Suspense fallback={<LeadsSkeleton />}>
        <LeadsSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
