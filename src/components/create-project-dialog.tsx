"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import axios from "axios";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";

import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface CreateProjectDialogProps {
  defaultCurrency?: "USD" | "INR";
}

export function CreateProjectDialog({ defaultCurrency = "USD" }: CreateProjectDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "INR">(defaultCurrency);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      const res = await axios.post('/api/projects', formData);
      
      if (res.data.success) {
        posthog.capture("project_created");
        setOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-9 px-4 rounded-full bg-brand text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-xs hover:bg-brand-hover border-none active:scale-[0.96] transition-transform select-none"
        >
          <Plus className="size-4 shrink-0" />
          <span>Create project</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Start a new project and invite your client to collaborate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 pt-1">
            {error && (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name" className="text-xs font-medium text-foreground">
                Project name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Acme Redesign"
                className="h-9"
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientEmail" className="text-xs font-medium text-foreground">
                Client email
              </Label>
              <Input
                id="clientEmail"
                name="clientEmail"
                type="email"
                placeholder="client@example.com"
                className="h-9"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-foreground">
                Project currency
              </Label>
              <input type="hidden" name="currency" value={currency} />
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/40">
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={cn(
                    "flex items-center justify-center py-1.5 px-3 text-xs font-medium rounded-md transition-[background-color,color,box-shadow] select-none active:scale-[0.96]",
                    currency === "USD"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  )}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("INR")}
                  className={cn(
                    "flex items-center justify-center py-1.5 px-3 text-xs font-medium rounded-md transition-[background-color,color,box-shadow] select-none active:scale-[0.96]",
                    currency === "INR"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  )}
                >
                  INR (₹)
                </button>
              </div>
              <p className="text-[11px] leading-normal text-muted-foreground">
                All proposals, milestones, and invoices in this project will use this currency.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="active:scale-[0.96] transition-transform"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="bg-brand hover:bg-brand-hover text-white border-none shadow-xs active:scale-[0.96] transition-transform"
            >
              {isLoading ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
