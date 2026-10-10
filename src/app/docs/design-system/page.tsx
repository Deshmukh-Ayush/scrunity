import type { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Check, Copy } from "lucide-react";

export const metadata: Metadata = {
  title: "Scrunity Design System | Specification",
  description: "Scrunity design system adapted from Firecrawl — primary brand blue, heat orange tertiary, neutral surfaces, and component hierarchy.",
};

export default function DesignSystemPage() {
  const primarySteps = [
    { token: "--color-primary-100", label: "Primary 100", hex: "#00aff9", opacity: "100%", role: "Solid brand fill, active button", bg: "bg-[#00aff9]", text: "text-white" },
    { token: "--color-primary-90", label: "Primary 90", hex: "#00aff9e6", opacity: "90%", role: "Button hover, active press", bg: "bg-[#00aff9]/90", text: "text-white" },
    { token: "--color-primary-40", label: "Primary 40", hex: "#00aff966", opacity: "40%", role: "Border outlines, divider stroke", bg: "bg-[#00aff9]/40", text: "text-white" },
    { token: "--color-primary-20", label: "Primary 20", hex: "#00aff933", opacity: "20%", role: "Focus ring halos, subtle highlight", bg: "bg-[#00aff9]/20", text: "text-foreground" },
    { token: "--color-primary-16", label: "Primary 16", hex: "#00aff929", opacity: "16%", role: "Selected row fill in dark mode", bg: "bg-[#00aff9]/16", text: "text-foreground" },
    { token: "--color-primary-12", label: "Primary 12", hex: "#00aff91f", opacity: "12%", role: "Interactive hover, soft pill", bg: "bg-[#00aff9]/12", text: "text-foreground" },
    { token: "--color-primary-8", label: "Primary 8", hex: "#00aff914", opacity: "8%", role: "Soft container fill, tag background", bg: "bg-[#00aff9]/8", text: "text-foreground" },
    { token: "--color-primary-4", label: "Primary 4", hex: "#00aff90a", opacity: "4%", role: "Table row hovers, surface tint", bg: "bg-[#00aff9]/4", text: "text-foreground" },
  ];

  const tertiarySteps = [
    { token: "--color-tertiary-100", label: "Tertiary 100", hex: "#fa5d19", opacity: "100%", role: "Live agent indicator, execution badge", bg: "bg-[#fa5d19]", text: "text-white" },
    { token: "--color-tertiary-hover", label: "Tertiary Hover", hex: "#e04e10", opacity: "100%", role: "Tertiary button hover", bg: "bg-[#e04e10]", text: "text-white" },
    { token: "--color-tertiary-40", label: "Tertiary 40", hex: "#fa5d1966", opacity: "40%", role: "Tertiary card border, progress ring", bg: "bg-[#fa5d19]/40", text: "text-white" },
    { token: "--color-tertiary-20", label: "Tertiary 20", hex: "#fa5d1933", opacity: "20%", role: "Tool execution pill border, questions", bg: "bg-[#fa5d19]/20", text: "text-foreground" },
    { token: "--color-tertiary-12", label: "Tertiary 12", hex: "#fa5d191f", opacity: "12%", role: "Warning/info card fill", bg: "bg-[#fa5d19]/12", text: "text-foreground" },
    { token: "--color-tertiary-8", label: "Tertiary 8", hex: "#fa5d1914", opacity: "8%", role: "Row highlight for open replies", bg: "bg-[#fa5d19]/8", text: "text-foreground" },
    { token: "--color-tertiary-4", label: "Tertiary 4", hex: "#fa5d190a", opacity: "4%", role: "Pipeline stage background tint", bg: "bg-[#fa5d19]/4", text: "text-foreground" },
  ];

  return (
    <div className="min-h-svh bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Header bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to Dashboard
          </Link>
          <div className="h-4 w-px bg-border/80" />
          <span className="text-sm font-semibold tracking-tight text-foreground">Scrunity Design System</span>
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-[10px] font-mono">
            docs/design-system.md
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground font-mono">Adapted from Firecrawl Spec</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">
        {/* Title hero */}
        <section className="space-y-3 pb-6 border-b border-border/60">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="size-3.5" />
            Official Visual Specification
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Scrunity Design System
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Derived structurally from Firecrawl’s design system architecture. Signature brand blue (<code className="text-primary font-mono font-semibold">#00aff9</code>), heat orange operational tertiary (<code className="text-[#fa5d19] font-mono font-semibold">#fa5d19</code>), near-neutral surfaces, and strict 4px grid spacing.
          </p>
        </section>

        {/* ─── COLOR PALETTE SECTION ─── */}
        <section id="colors" className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <span>Colors & Opacity Tokens</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Primary brand blue carries identity; tertiary heat orange drives live execution and replies; neutral surfaces provide high-contrast density.
            </p>
          </div>

          {/* Primary scale */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Primary Brand Blue (<code className="font-mono text-primary">#00aff9</code>)</h3>
                <p className="text-xs text-muted-foreground">Replaces Firecrawl heat orange in the signature brand role across fixed opacity steps.</p>
              </div>
              <Badge className="bg-primary text-white text-[11px] font-mono">--color-primary</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {primarySteps.map((step) => (
                <div key={step.token} className="rounded-lg border border-border/70 overflow-hidden bg-card flex flex-col">
                  <div className={`h-16 w-full ${step.bg} flex items-end p-2 justify-between`}>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/40 text-white backdrop-blur-xs`}>
                      {step.opacity}
                    </span>
                    <span className="text-[10px] font-mono text-white/90 drop-shadow-xs">{step.hex}</span>
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1">
                    <div className="font-mono text-[11px] font-medium text-foreground">{step.token}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{step.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tertiary scale */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Tertiary Heat Orange (<code className="font-mono text-[#fa5d19]">#fa5d19</code>)</h3>
                <p className="text-xs text-muted-foreground">
                  The Firecrawl orange adopted as Scrunity’s operational tertiary token, replacing legacy blue info accents.
                </p>
              </div>
              <Badge className="bg-[#fa5d19] text-white text-[11px] font-mono">--color-tertiary</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tertiarySteps.map((step) => (
                <div key={step.token} className="rounded-lg border border-border/70 overflow-hidden bg-card flex flex-col">
                  <div className={`h-16 w-full ${step.bg} flex items-end p-2 justify-between`}>
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-black/40 text-white backdrop-blur-xs`}>
                      {step.opacity}
                    </span>
                    <span className="text-[10px] font-mono text-white/90 drop-shadow-xs">{step.hex}</span>
                  </div>
                  <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1">
                    <div className="font-mono text-[11px] font-medium text-foreground">{step.token}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{step.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Neutrals & Semantic */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-semibold text-foreground">Secondary & Semantic Accents</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-lg border border-border/70 overflow-hidden bg-card">
                <div className="h-12 bg-[#262626] flex items-center justify-center text-white font-mono text-xs font-semibold">
                  #262626
                </div>
                <div className="p-2">
                  <div className="font-mono text-[10px] font-medium">Secondary Neutral</div>
                  <div className="text-[10px] text-muted-foreground">Dark surface fill</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 overflow-hidden bg-card">
                <div className="h-12 bg-[#10b981] flex items-center justify-center text-white font-mono text-xs font-semibold">
                  #10b981
                </div>
                <div className="p-2">
                  <div className="font-mono text-[10px] font-medium">Success</div>
                  <div className="text-[10px] text-muted-foreground">Verified, Interested</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 overflow-hidden bg-card">
                <div className="h-12 bg-[#fa5d19] flex items-center justify-center text-white font-mono text-xs font-semibold">
                  #fa5d19
                </div>
                <div className="p-2">
                  <div className="font-mono text-[10px] font-medium">Info / Tertiary</div>
                  <div className="text-[10px] text-muted-foreground">Running, Questions</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 overflow-hidden bg-card">
                <div className="h-12 bg-[#f59e0b] flex items-center justify-center text-white font-mono text-xs font-semibold">
                  #f59e0b
                </div>
                <div className="p-2">
                  <div className="font-mono text-[10px] font-medium">Warning</div>
                  <div className="text-[10px] text-muted-foreground">Rate limit, Review</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 overflow-hidden bg-card">
                <div className="h-12 bg-[#ef4444] flex items-center justify-center text-white font-mono text-xs font-semibold">
                  #ef4444
                </div>
                <div className="p-2">
                  <div className="font-mono text-[10px] font-medium">Destructive</div>
                  <div className="text-[10px] text-muted-foreground">Bounced, Disqualified</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── TYPOGRAPHY SECTION ─── */}
        <section id="typography" className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Typography Scale</h2>
            <p className="text-xs text-muted-foreground">
              Sans: Inter | Mono: Geist Mono | Serif: Instrument Serif.
            </p>
          </div>

          <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 font-semibold text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3">Token</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Sample Preview</th>
                  <th className="py-2.5 px-3">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                <tr>
                  <td className="py-2 px-3 font-semibold">micro</td>
                  <td className="py-2 px-3">10px</td>
                  <td className="py-2 px-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">STAGE 7 • RUNNING GMAIL OUTREACH</td>
                  <td className="py-2 px-3 font-sans text-muted-foreground">Upper-case dot tags, micro status pills</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">badge</td>
                  <td className="py-2 px-3">11px</td>
                  <td className="py-2 px-3 font-sans text-[11px] font-medium text-foreground">Interested • 2h ago • Seed SaaS</td>
                  <td className="py-2 px-3 font-sans text-muted-foreground">Pill badges, relative timestamps</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">compact</td>
                  <td className="py-2 px-3">12px</td>
                  <td className="py-2 px-3 font-sans text-xs text-foreground">VP of Engineering at TechFlow Systems</td>
                  <td className="py-2 px-3 font-sans text-muted-foreground">Table cells, input fields</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">regular</td>
                  <td className="py-2 px-3">13px</td>
                  <td className="py-2 px-3 font-sans text-[13px] text-foreground">Streamlining your cold email pipeline with zero-code discovery</td>
                  <td className="py-2 px-3 font-sans text-muted-foreground">Navigation, thread preview snippets</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">body</td>
                  <td className="py-2 px-3">14px</td>
                  <td className="py-2 px-3 font-sans text-sm text-foreground">Hi Sarah, thanks for connecting. Would you have 15 minutes next week?</td>
                  <td className="py-2 px-3 font-sans text-muted-foreground">Full email thread message body</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-semibold">subhead</td>
                  <td className="py-2 px-3">16px</td>
                  <td className="py-2 px-3 font-sans text-base font-semibold text-foreground">Mailbox Conversation Exchange</td>
                  <td className="py-2 px-3 font-sans text-muted-foreground">Card headers, modal titles</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── SHAPES & RADII ─── */}
        <section id="shapes" className="space-y-4 pt-6 border-t border-border/60">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Shapes & Geometry</h2>
            <p className="text-xs text-muted-foreground">Base radius: 10px (0.625rem). Derived tokens across the hierarchy.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { token: "--radius-sm", px: "6px", label: "Small", cls: "rounded-sm" },
              { token: "--radius-md", px: "8px", label: "Medium", cls: "rounded-md" },
              { token: "--radius-lg", px: "10px", label: "Large (Base)", cls: "rounded-lg" },
              { token: "--radius-xl", px: "14px", label: "Extra Large", cls: "rounded-xl" },
              { token: "--radius-full", px: "9999px", label: "Pill / Full", cls: "rounded-full" },
            ].map((r) => (
              <div key={r.token} className="p-3 border border-border/70 rounded-lg bg-card flex flex-col items-center gap-2 text-center">
                <div className={`size-12 border-2 border-primary bg-primary/10 ${r.cls} flex items-center justify-center font-mono text-[10px] font-bold text-primary`}>
                  {r.px}
                </div>
                <div className="font-mono text-[11px] font-medium text-foreground">{r.token}</div>
                <div className="text-[10px] text-muted-foreground">{r.label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
