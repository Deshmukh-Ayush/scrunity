"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

/**
 * Collects the organization name and creates the organization on the server
 * (POST /api/onboarding). The endpoint is idempotent, so a double click or a
 * retry after a refresh lands on the same organization.
 */
export const Onboard = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) {
      setError("Please enter your organization's name.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "We couldn't create your organization. Please try again.");
        setIsSubmitting(false);
        return;
      }
      if (data.status === "created") posthog.capture("organization_onboarding_completed");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-medium">Create your organization</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Name your workspace to get started. You can invite teammates later.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
              autoComplete="organization"
              placeholder="Acme Inc."
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "org-name-error" : undefined}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p id="org-name-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button variant="brand" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </div>
    </div>
  );
}
