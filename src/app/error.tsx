"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "@/components/ui/icons";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-6">
        <AlertCircle className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Something went wrong</h1>
      <p className="text-muted-foreground max-w-125 mb-8">
        We apologize for the inconvenience. An unexpected error occurred.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>
          Try again
        </Button>
        <Link href="/dashboard">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
