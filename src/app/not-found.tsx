import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function GlobalNotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-6">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Page Not Found</h1>
      <p className="text-muted-foreground max-w-[500px] mb-8">
        We couldn't find the page you were looking for. It might have been moved or deleted.
      </p>
      <Link href="/dashboard">
        <Button>Return to Dashboard</Button>
      </Link>
    </div>
  );
}
