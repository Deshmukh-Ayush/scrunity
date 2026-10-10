import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export function BillingHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

export function PlanCardSkeleton() {
  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

export function CreditBalanceSkeleton() {
  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-4 w-52" />
      </CardContent>
    </Card>
  );
}

export function PlanLimitsSkeleton() {
  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <Skeleton className="h-6 w-44" />
      </CardHeader>
      <CardContent className="p-0 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function UsageChartSkeleton() {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-44 rounded-md" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </Card>
  );
}

export function InvoicesSkeleton() {
  return (
    <Card className="p-6 space-y-3">
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </Card>
  );
}
