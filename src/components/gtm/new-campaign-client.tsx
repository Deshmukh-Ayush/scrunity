"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Globe, Building2, UploadCloud, ArrowRight, Loader2 } from "lucide-react";

export function NewCampaignClient() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [companyDescription, setCompanyDescription] = React.useState("");
  const [companySize, setCompanySize] = React.useState<"1-10" | "11-50" | "51-200" | "200+">("11-50");
  const [contextDoc, setContextDoc] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a .md or .txt document");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContextDoc(text || "");
      toast.success(`Loaded context from ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!websiteUrl.trim() || !companyName.trim() || !companyDescription.trim()) {
      toast.error("Please fill in website URL, company name, and description");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/gtm/research-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: websiteUrl.trim(),
          companyName: companyName.trim(),
          companyDescription: companyDescription.trim(),
          companySize,
          contextDoc: contextDoc.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate research run");
      }

      toast.success("Research pipeline started! Inngest is analyzing your company.");
      router.push("/dashboard/campaigns");
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          New GTM Research & Outreach
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about your company. Our autonomous pipeline will scrape your site, explore
          competitors, generate verified ICP segments, find decision-makers, and draft personalized emails.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Company Details
          </CardTitle>
          <CardDescription>
            Basic parameters to anchor the autonomous competitor and ICP discovery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="websiteUrl"
                  placeholder="https://example.com"
                  className="pl-9"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Logo and Open Graph keywords will be automatically fetched from this homepage.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Acme Inc"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companySize">Company Size</Label>
              <select
                id="companySize"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="200+">200+ employees</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyDescription">Short Description / Value Proposition</Label>
              <Textarea
                id="companyDescription"
                placeholder="What does your company do, who does it serve, and what core pain point do you solve?"
                rows={3}
                value={companyDescription}
                onChange={(e) => setCompanyDescription(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="contextDoc">Optional Context Document (.md / .txt)</Label>
              <div className="border-2 border-dashed border-border/80 rounded-lg p-4 text-center hover:bg-muted/30 transition-colors">
                <input
                  type="file"
                  id="contextDoc"
                  accept=".md,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <label
                  htmlFor="contextDoc"
                  className="flex flex-col items-center cursor-pointer gap-1.5"
                >
                  <UploadCloud className="size-6 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {fileName ? fileName : "Upload product documentation or battlecard (.md)"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Plain-text context will be used by the LLM to refine ICPs.
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Launching Pipeline...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Start Autonomous Research
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
