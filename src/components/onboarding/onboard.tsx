"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import posthog from "posthog-js";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const Onboard = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedName = name.trim();
    const slug = slugify(trimmedName);

    if (!slug) {
      setError("Please enter a valid organization name.");
      setIsSubmitting(false);
      return;
    }

    const { data, error: createError } = await authClient.organization.create({
      name: trimmedName,
      slug,
    });

    if (createError) {
      setError(createError.message ?? "Failed to create organization.");
      setIsSubmitting(false);
      return;
    }

    if (data?.id) {
      await authClient.organization.setActive({ organizationId: data.id });
    }

    posthog.capture("organization_onboarding_completed");
    router.push("/dashboard/campaigns/new");
    router.refresh();
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-medium">Create your company profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up your company to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">
              Company Name
            </label>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="My Company"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create organization"}
          </Button>
        </form>
      </div>
    </div>
  );
}
