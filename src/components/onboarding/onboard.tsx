"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import posthog from "posthog-js";
import { focusFirstInvalid } from "@/components/company-profile/company-profile-fields";
import { useLogoPreview } from "@/hooks/use-logo-preview";
import { COMPANY_PROFILE_COPY } from "@/lib/company-profile/copy";
import {
  EMPTY_COMPANY_FORM,
  companyFormToInput,
  validateCompanyForm,
  type CompanyFormErrors,
} from "@/lib/company-profile/form";
import { OnboardingCompanyStep } from "./company-step";

/**
 * Step 1 collects the organization name and creates the organization on the
 * server (POST /api/onboarding). The endpoint is idempotent, so a double
 * click or a retry after a refresh lands on the same organization. Step 2
 * saves the company profile (or is skipped). It stays on this page: once the
 * organization exists the proxy sends /onboarding to the dashboard, so a
 * refresh on step 2 counts as skipping it.
 */
export const Onboard = () => {
  const router = useRouter();
  const [step, setStep] = useState<"organization" | "company">("organization");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [company, setCompany] = useState(EMPTY_COMPANY_FORM);
  const [companyErrors, setCompanyErrors] = useState<CompanyFormErrors>({});
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const { logoPreview, clearLogo } = useLogoPreview(company.websiteUrl);

  const goToDashboard = () => {
    router.replace("/dashboard");
    router.refresh();
  };

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
      // An organization that already existed was set up before: skip the company step.
      if (data.status === "existing") return goToDashboard();
      setIsSubmitting(false);
      setStep("company");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const errors = validateCompanyForm(company);
    setCompanyErrors(errors);
    const input = companyFormToInput(company);
    if (!focusFirstInvalid(errors) || !input) return;

    setCompanyError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/gtm/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, researchFormMode: "use_saved" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? COMPANY_PROFILE_COPY.saveFailed);
      posthog.capture("onboarding_company_profile_saved");
      goToDashboard();
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : COMPANY_PROFILE_COPY.saveFailed);
      setIsSaving(false);
    }
  };

  if (step === "company") {
    return (
      <OnboardingCompanyStep
        values={company}
        errors={companyErrors}
        logoPreview={logoPreview}
        onLogoError={clearLogo}
        isSubmitting={isSaving}
        isSkipping={isSkipping}
        errorMessage={companyError}
        onChange={(patch) => setCompany((prev) => ({ ...prev, ...patch }))}
        onSubmit={handleSaveCompany}
        onSkip={() => {
          setIsSkipping(true);
          posthog.capture("onboarding_company_profile_skipped");
          goToDashboard();
        }}
      />
    );
  }

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
