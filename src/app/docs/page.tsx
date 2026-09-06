import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Section,
  H3,
  P,
  Code,
  CodeBlock,
  Table,
} from "./doc-components";

export const metadata: Metadata = {
  title: "Developer Docs",
  description: "Internal developer documentation for Scrunity — architecture, Torch AI agent engine, Billing OS, Team workflows, Client access safeguards, speed optimization, DB schema, API routes, and multi-currency engine.",
  robots: {
    index: false,
    follow: false,
  },
};

// Gate: only allow specific developer emails
const DEVELOPER_EMAILS = [
  "losted710@gmail.com",
  // Add more developer emails here
];

export default async function DocsPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session || !DEVELOPER_EMAILS.includes(session.user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-svh bg-background text-foreground antialiased font-sans selection:bg-brand/20">
      <style dangerouslySetInnerHTML={{__html: `
        html {
          scroll-behavior: smooth;
        }
      `}} />
      
      {/* Floating nav */}
      <nav className="sticky top-0 z-50 h-13 px-6 border-b border-border/40 bg-background/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-[14px] font-bold tracking-tight text-foreground">Scrunity</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand tracking-wider uppercase">
            Internal Developer Docs
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono font-medium">v0.0.1</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-32 space-y-8">
        {/* Hero Header */}
        <header className="mb-12">
          <h1 className="text-[36px] font-semibold tracking-tight leading-tight text-foreground mb-3 text-balance">
            Developer Documentation
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground max-w-2xl text-pretty">
            Technical architecture, Torch AI agent co-pilot, Billing &amp; subscription OS, Team management workflows, Client access safeguards, speed optimization suite, EvilCharts data visualization, DB schemas, and multi-currency handling.
          </p>
        </header>

        {/* Table of Contents */}
        <Section title="Contents">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              ['What is Scrunity?', '#overview'],
              ['Tech Stack & Architecture', '#stack'],
              ['Folder Structure', '#folders'],
              ['Torch AI Co-Pilot & Agent Engine', '#torch-ai'],
              ['Billing & Subscription OS', '#billing'],
              ['Team Management & Workflows', '#team'],
              ['Client Access Safeguards & Redirection', '#client-safeguards'],
              ['Vercel & Linear Speed Architecture', '#speed'],
              ['Design System & Component Rules', '#design-system'],
              ['EvilCharts Analytics Architecture', '#evilcharts'],
              ['AI Scope Guardian & Clause Engine', '#ai-engine'],
              ['Multi-Currency Engine (INR / USD)', '#currency'],
              ['Database Schema', '#schema'],
              ['Contract & E-Signature Vault', '#contracts'],
              ['API Routes Specification', '#api'],
              ['Environment Variables', '#env'],
              ['Dev & Verification Commands', '#commands'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/50 px-2.5 py-1.5 rounded-md transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </Section>

        {/* ─── OVERVIEW ─── */}
        <Section id="overview" title="What is Scrunity?">
          <P>
            Scrunity is an AI-powered agency revenue protection and client collaboration OS. It replaces fragmented tools (DocuSign, Trello, WhatsApp, Excel invoices) with a single source of truth for payment tracking, contract execution, deliverable reviews, AI scope creep guardian, team management, and audit logs.
          </P>
          <P>User roles and permissions:</P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><Code>owner</Code> — Agency owner. Full control over project creation, billing, contract vault, proposal generation, team management, and organization settings.</li>
            <li><Code>agency</Code> / <Code>member</Code> — Agency team member. Can create deliverables, upload agreements, send proposals, handle team workflows, and verify payment milestones.</li>
            <li><Code>client</Code> — Invited client stakeholder. Can upload agreements (NDA, NOC), e-sign contracts, review deliverables, request revisions, and view payment status. Clients are strictly isolated from <Code>/dashboard</Code> routes.</li>
          </ul>
        </Section>

        {/* ─── TECH STACK ─── */}
        <Section id="stack" title="Tech Stack & Architecture">
          <Table
            headers={['Layer', 'Technology', 'Notes']}
            rows={[
              ['Framework', 'Next.js 16 (App Router)', 'RSC by default, Turbopack, async params, React.cache() deduplication'],
              ['Language', 'TypeScript 5', 'Strict type safety (tsc --noEmit)'],
              ['AI Co-Pilot Engine', 'Vercel AI SDK v7 + Groq', 'Streaming SSE tool calling, multi-step loops (openai/gpt-oss-120b & gpt-oss-20b)'],
              ['Rich AI Input', 'Meta Lexical (@lexical/react)', 'Slash commands / and mention @ popover triggers in LexicalAIInput'],
              ['Agent & Motion UI', 'beUI Primitives + Motion React', 'ApprovalCard, ThinkingShimmer, ActionSwap, AnimatedButton, Dashed Timeline'],
              ['Billing & Subscriptions', 'Billing Portal & Webhooks', 'Automated checkout sessions, idempotent webhook processor, subscription lifecycle sync'],
              ['Charts & Analytics', 'EvilCharts Component Suite', 'EChartsRadialChart, EChartsAreaChart, EChartsBarChart with next/dynamic lazy loading'],
              ['Database', 'Neon (Serverless Postgres)', 'Stateless HTTP driver @neondatabase/serverless'],
              ['ORM', 'Drizzle ORM', 'Schema defined in src/db/schema.ts'],
              ['Auth & Proxy Layer', 'Better Auth + src/proxy.ts', 'Google OAuth + organization plugin. Route protection and role headers resolved in proxy.ts before RSC render'],
              ['State Management', 'Zustand & Torch Context', 'Context provider with JSON Event Stream parser + Zustand stores'],
              ['Icons', 'Phosphor Icons & Lucide', '@phosphor-icons/react in client components, Lucide in RSC'],
              ['Styling', 'Tailwind CSS v4 & CSS Variables', 'Brand color #00AAF7 (bg-brand), dark mode, custom neutral tokens'],
              ['Storage', 'Vercel Blob (Private)', 'Private PDF contract uploads, attachments, and auth-gated download streams'],
              ['Email', 'Resend', 'Transactional emails for invites, signatures, and notifications'],
            ]}
          />
        </Section>

        {/* ─── FOLDER STRUCTURE ─── */}
        <Section id="folders" title="Folder Structure">
          <CodeBlock>{`src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (ThemeProvider, Sonner, SpeedInsights, display: 'swap')
│   ├── globals.css             # Brand color #00AAF7, Tailwind v4 theme
│   ├── docs/                   # Developer documentation route
│   ├── dashboard/              # Main organization dashboard
│   │   ├── page.tsx            # Overview dashboard (2 Hero KPI Cards, EvilCharts)
│   │   ├── ai/                 # Torch AI Agent Co-Pilot (Compound Torch architecture)
│   │   ├── billing/            # Subscription plans, invoices, and billing portal
│   │   ├── team/               # Team management section (Seat capacity, contributors, activity stream)
│   │   ├── projects/           # Projects overview table & multi-currency contract values
│   │   ├── analytics/          # Sales velocity & pipeline analytics
│   │   ├── clients/            # Client conversion rates & relationship tracking
│   │   └── settings/           # Agency settings & global currency preferences
│   ├── api/
│   │   ├── ai/torch/           # Streaming SSE agent endpoint & confirmation handler
│   │   ├── billing/            # Checkout, Customer Portal & Webhook handlers
│   │   ├── webhooks/dodo/      # Dodo Payments webhook alias
│   │   ├── contracts/          # Contract uploads, e-signatures & private download streams
│   │   └── files/              # Private project attachments & download proxies
│   └── projects/[projectId]/   # Project workspace routes
│
├── components/
│   ├── dashboard/              # Dashboard Domain Modules
│   │   ├── ai/torch/           # Torch compound system (Root, Messages, Input, Reasoning, Artifact, Results)
│   │   ├── team/               # TeamKpiRow, TeamAnalyticsBreakdown, TeamWorkflowsTable
│   │   └── overview/           # DashboardKpiRow, DashboardHeroChart
│   ├── agents/                 # beUI Agent Primitives (ApprovalCard, MessageBubble, Disclosure, ActivityRow)
│   ├── motion/                 # beUI Motion Suite (Button, Input, Checkbox, PopoverMorph, TextShimmer)
│   └── evilcharts/             # EvilCharts Visualization Library
│
├── lib/
│   ├── ai/torch-tools.ts       # Centralized 9-tool Torch agent registry
│   ├── tenant-context.ts       # React.cache() deduplicated tenant context & auth resolver
│   ├── project-auth.ts         # Centralized project authorization policy
│   ├── currency.ts             # Multi-currency engine (Live 24h-cached FX rates via open.er-api & Frankfurter)
│   └── activity.ts             # Next.js 16 after() background notification logger`}</CodeBlock>
        </Section>

        {/* ─── TORCH AI CO-PILOT & AGENT ENGINE ─── */}
        <Section id="torch-ai" title="Torch AI Co-Pilot & Agent Engine">
          <P>
            The **Torch AI Co-Pilot** (<Code>/dashboard/ai</Code>) is a workspace-aware autonomous agent built on a compound component architecture following Vercel React best practices and AI SDK v7 streaming standards:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1.5 list-disc">
            <li><strong className="text-foreground font-medium">Compound Architecture (<Code>&lt;Torch.Root&gt;</Code>):</strong> Coordinates <Code>&lt;Torch.Messages&gt;</Code>, <Code>&lt;Torch.Input&gt;</Code>, and <Code>&lt;Torch.Artifact&gt;</Code> through a unified <Code>TorchProvider</Code> context parsing JSON event streams.</li>
            <li><strong className="text-foreground font-medium">Streaming Agent Route (<Code>/api/ai/torch</Code>):</strong> Executes multi-step tool calling loops using Groq (<Code>openai/gpt-oss-120b</Code>) with live SSE streaming, tool execution status badges, and date-sanitized ISO payloads. Structured model fallback (<Code>openai/gpt-oss-20b</Code>) is leveraged in contract parsing and classifier tasks via <Code>generateStructuredWithFallback</Code>.</li>
            <li><strong className="text-foreground font-medium">Centralized 9-Tool Registry (<Code>src/lib/ai/torch-tools.ts</Code>):</strong>
              <ul className="pl-5 pt-1 space-y-1 list-circle text-xs">
                <li><Code>queryWorkspaceOverview</Code> — Fetches high-level summary of active projects, deliverables in review, proposals, and workspace financial totals.</li>
                <li><Code>auditProjectScope</Code> — Audits project revision history against signed contract scope terms, checking for scope creep, revision limits, and exclusions.</li>
                <li><Code>generateAddendumDraft</Code> — Generates formal Change Order SOW addendum with itemized pricing when scope creep is detected.</li>
                <li><Code>analyzeFinancials</Code> — Aggregates collected revenue, due amounts, outstanding cashflow, and payment milestones across projects or for a specific project.</li>
                <li><Code>generateClientDigest</Code> — Compiles weekly progress digest per project with deliverable status breakdown.</li>
                <li><Code>createDeliverableDraft</Code> — Prepares actionable deliverable submission drafts with title, description, and due date.</li>
                <li><Code>queryInvoiceStatus</Code> — Queries invoice counts by status (draft, sent, viewed, paid, overdue, void), outstanding balances, and overdue days.</li>
                <li><Code>draftInvoiceForMilestone</Code> — Drafts compliant invoices for verified milestones requiring human confirmation.</li>
                <li><Code>webSearch</Code> — External web search (Firecrawl /v2/search with fallback chain) for market rates and benchmarks; strictly barred from querying internal workspace projects.</li>
              </ul>
            </li>
            <li><strong className="text-foreground font-medium">Structured Result Cards:</strong> Dedicated visual components for informational tools (<Code>ScopeAuditResult</Code>, <Code>ClientDigestResult</Code>, <Code>InvoiceStatusResult</Code>, <Code>FinancialsResult</Code>, <Code>WorkspaceOverviewResult</Code>) rendered before synthesized text summaries.</li>
            <li><strong className="text-foreground font-medium">Human-in-the-Loop Actions (<Code>ApprovalCard</Code>):</strong> Draft-creating tools return interactive proposal, invoice, and deliverable cards. Agency owners can approve or reject with one click, dispatching to <Code>/api/ai/torch/confirm</Code> to execute DB mutations safely.</li>
            <li><strong className="text-foreground font-medium">Lexical Rich Input (<Code>LexicalAIInput</Code>):</strong> Centered <Code>max-w-3xl</Code> input container with floating <Code>/</Code> slash command menu and <Code>@</Code> project mention context injection.</li>
          </ul>
        </Section>

        {/* ─── BILLING & SUBSCRIPTION OS ─── */}
        <Section id="billing" title="Billing, Invoicing & Pooled Credit Engine">
          <P>
            Scrunity provides automated subscription billing, organization-level pooled credit tracking, and invoice management:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1.5 list-disc">
            <li><strong className="text-foreground font-medium">Organization Pooled Credits:</strong> AI tool executions and web search credits are pooled at the organization level, sized by plan tier (Free: 50 AI / 10 Search; Freelancer: 300 AI / 50 Search; Agency: 1,500 AI / 250 Search per paid seat capacity).</li>
            <li><strong className="text-foreground font-medium">Billing Cycle Synchronization:</strong> Credit periods (<Code>organizationCreditPeriod</Code>) synchronize with <Code>organization.currentPeriodEnd</Code> with clock-skew tolerance and instant mid-cycle pool expansion on upgrades.</li>
            <li><strong className="text-foreground font-medium">Soft-Cap &amp; Circuit Breaker:</strong> Soft-cap enforcement (<Code>ENFORCE_CREDIT_LIMITS = false</Code>) logs all usage to <Code>usageEvent</Code> without blocking client work. A 60 request/hour sliding-window circuit breaker protects external search APIs.</li>
            <li><strong className="text-foreground font-medium">Professional Invoicing OS:</strong> Vercel-inspired monochrome invoice document view (<Code>InvoiceDocumentView</Code>) with automated tax/discount calculations, PDF generation, and UTR payment verification.</li>
            <li><strong className="text-foreground font-medium">Checkout Flow &amp; Webhooks:</strong> Dodo Payments Merchant of Record integration with cryptographic webhook validation and self-service Customer Portal.</li>
          </ul>
        </Section>

        {/* ─── TEAM MANAGEMENT & WORKFLOWS ─── */}
        <Section id="team" title="Team Management & Workflows">
          <P>
            The **Team Management** route (<Code>/dashboard/team</Code>) enables agency owners to monitor team seats, member status, active contributors, and workflow distribution:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><strong className="text-foreground font-medium">Team KPI Row (<Code>TeamKpiRow</Code>):</strong> Seat Capacity (e.g. 4/10 seats filled), Active Contributors (7-day window), Role Distribution, and Team Execution Pace.</li>
            <li><strong className="text-foreground font-medium">Team Analytics Breakdown (<Code>TeamAnalyticsBreakdown</Code>):</strong> Top Contributors Leaderboard and Live Team Activity Stream mapping database audit logs.</li>
            <li><strong className="text-foreground font-medium">Team Workflows Table (<Code>TeamWorkflowsTable</Code>):</strong> Table of top workflows built with <Code>DataTableShell</Code> and <Code>SlidingPillTabs</Code>.</li>
          </ul>
        </Section>

        {/* ─── CLIENT ACCESS SAFEGUARDS ─── */}
        <Section id="client-safeguards" title="Client Access Safeguards & Proxy-Based Auth">
          <P>
            Scrunity enforces 100% strict isolation between agency operations and client stakeholders:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><strong className="text-foreground font-medium">Proxy-Level Client Redirection (<Code>src/proxy.ts</Code>):</strong> User authentication and role isolation are resolved at the proxy layer before React layouts render. Non-agency clients accessing <Code>/dashboard</Code> routes are intercepted and redirected to <Code>/projects/[firstProjectId]</Code>, eliminating data waterfalls and layout-level DB queries.</li>
            <li><strong className="text-foreground font-medium">Dual-Role Persona Switcher (<Code>DashboardTopbar</Code>):</strong> Agency owners who are also clients on another agency&apos;s project receive a topbar link (<Code>Switch to Client View →</Code>) to toggle context seamlessly.</li>
            <li><strong className="text-foreground font-medium">White-Labeled Project Onboarding (<Code>/invite/project/[inviteId]</Code>):</strong> White-labeled onboarding flow where clients sign up with Google and stay inside their assigned project view.</li>
          </ul>
        </Section>

        {/* ─── SPEED ARCHITECTURE ─── */}
        <Section id="speed" title="Vercel & Linear Speed Architecture">
          <P>
            Optimized using Vercel Engineering performance guidelines (<Code>vercel-react-best-practices</Code>) to achieve sub-1s FCP and sub-200ms TTFB:
          </P>
          <Table
            headers={['Optimization Rule', 'Implementation File', 'Performance Impact']}
            rows={[
              ['server-cache-react', 'src/lib/tenant-context.ts', 'Wrapped getTenantContext in React.cache() to deduplicate DB & session queries per HTTP request. Drops TTFB from 870ms to <200ms.'],
              ['cached-org-queries', 'src/utils/cached-org-queries.ts', 'Cached organization and project metadata lookups across dashboard routes.'],
              ['bundle-barrel-imports', 'next.config.ts', 'Added experimental.optimizePackageImports for Phosphor, Lucide, Lexical, Date-fns, Drizzle, and Recharts. Tree-shakes client JS by ~45%.'],
              ['bundle-dynamic-imports', 'src/components/dashboard/*/', 'Dynamically imported heavy ECharts hero visualization components across Overview, Analytics, and Clients sections. Drops initial JS payload by ~1.2MB.'],
              ['rendering-resource-hints', 'src/app/layout.tsx', 'Added display: "swap" to Inter, Geist Mono, and Instrument Serif font loaders to unblock FCP render.'],
            ]}
          />
        </Section>

        {/* ─── DESIGN SYSTEM ─── */}
        <Section id="design-system" title="Design System & Component Rules">
          <P>
            Scrunity enforces strict design rules across every tab in the application to maintain 100% visual consistency:
          </P>
          <Table
            headers={['Pattern', 'CSS & HTML Specification', 'Usage']}
            rows={[
              ['Brand Primary Button', 'active:scale-[0.96] transition-transform h-9 px-4 rounded-full bg-[#00AAF7] text-white font-semibold text-sm flex items-center gap-1.5', 'Main page CTA buttons across all sections'],
              ['Container Outer Frame', 'rounded-md border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900', 'Outer container frame for all charts & hero cards'],
              ['Container Inner Card', 'rounded-md bg-white p-4 dark:bg-neutral-950', 'Inner white/dark card wrapping chart content'],
              ['Row Item List Standard', 'group flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 py-2.5 px-3 hover:bg-muted/40 border-b border-border/40 last:border-0 transition-colors rounded-md', '100% pixel-identical row list layout across all tabs'],
              ['Page Title Header', 'text-[36px] font-semibold tracking-tight text-foreground text-balance leading-tight', 'Main section heading on every project tab'],
              ['Section Title Header', 'text-[16px] font-semibold tracking-tight text-foreground text-balance', 'Sub-section header above list rows'],
            ]}
          />
        </Section>

        {/* ─── EVILCHARTS ANALYTICS ─── */}
        <Section id="evilcharts" title="EvilCharts Analytics Architecture">
          <P>
            Scrunity integrates the **EvilCharts** visualization engine across all core project tabs:
          </P>
          <Table
            headers={['Tab Module', 'Chart Component', 'Location', 'Visualization Metric']}
            rows={[
              ['Payments', 'EChartsRadialChart', 'src/components/projects/payments/payments-radial-chart.tsx', '4 Radial Gauges: Collected, Due, Overdue, Upcoming'],
              ['Proposals', 'ProposalDonutChart', 'src/components/projects/proposal/proposal-donut-chart.tsx', 'Sales Pipeline Donut: Accepted, Sent, Draft, Declined'],
              ['Deliverables', 'EChartsAreaChart', 'src/components/projects/deliverables/deliverables-velocity-chart.tsx', 'Static Area Velocity Trend: Approved vs Total Tasks'],
              ['Contracts', 'ContractStatusChart', 'src/components/projects/contracts/contract-status-chart.tsx', '3 Radial Gauges: Fully Signed, Pending, Draft Agreements'],
              ['Activity Log', 'EChartsBarChart', 'src/components/projects/activity/activity-bar-chart.tsx', 'Monospace 14-Day Audit Bar Chart with Peak Day indicator'],
              ['Project Files', 'FilesStorageChart', 'src/components/projects/files/files-storage-chart.tsx', 'Storage Vault Breakdown: PDFs, Images, Code Archives'],
              ['Project Overview', 'ProjectOverviewMomentumChart', 'src/components/projects/overview/project-overview-momentum-chart.tsx', '14-Day Activity Velocity Trend Area Chart'],
            ]}
          />
        </Section>

        {/* ─── AI SCOPE GUARDIAN ENGINE ─── */}
        <Section id="ai-engine" title="AI Scope Guardian & Clause Engine">
          <P>
            Scrunity protects agency profit margins by automatically analyzing uploaded PDF contracts, extracting scope boundaries, evaluating revision counts, and generating Change Order SOW addendums:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><strong className="text-foreground font-medium">Model Fallback Architecture:</strong> Uses <Code>openai/gpt-oss-120b</Code> as the primary LLM engine on Groq with automated fallback to <Code>openai/gpt-oss-20b</Code> if rate limits occur.</li>
            <li><strong className="text-foreground font-medium">Universal Preprocessors &amp; Type Safety:</strong> Zero <Code>any</Code> types. Uses Zod v4 preprocessors to coerce LLM JSON variations cleanly into typed objects.</li>
            <li><strong className="text-foreground font-medium">AI Clause Inspector Drawer:</strong> Slide-over panel (<Code>ContractAIDrawer</Code>) displaying extracted scope items, exclusions, revision limits, and payment terms.</li>
            <li><strong className="text-foreground font-medium">Scope Creep Alert &amp; Addendum Generator:</strong> <Code>ScopeGuardianPill</Code> evaluates deliverable revision counts against contract terms (<Code>within_scope</Code> | <Code>limit_reached</Code> | <Code>scope_creep_alert</Code>) and launches the AI Addendum Drafter (<Code>AddendumModal</Code>).</li>
          </ul>
        </Section>

        {/* ─── MULTI-CURRENCY ENGINE ─── */}
        <Section id="currency" title="Multi-Currency Engine (INR / USD / EUR / GBP)">
          <P>
            Scrunity supports global multi-currency operations across milestones and invoices:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><strong className="text-foreground font-medium">Exchange Rate Conversion:</strong> Real-time FX rates fetched dynamically from live providers (<Code>api.frankfurter.dev</Code> with caching and fallback chains) in <Code>src/lib/currency.ts</Code>. Converted values display across Overview KPI cards, Analytics pipeline metrics, and Projects table rows.</li>
            <li><strong className="text-foreground font-medium">Single Currency Formatting:</strong> Formats INR as <Code>₹1,00,000</Code>, USD as <Code>$2,500</Code>, EUR as <Code>€2,500</Code>, and GBP as <Code>£2,000</Code>.</li>
            <li><strong className="text-foreground font-medium">Mixed-Currency Portfolio Totals:</strong> When a project contains milestones in multiple currencies, totals format cleanly or convert via global currency preferences.</li>
          </ul>
        </Section>

        {/* ─── DATABASE SCHEMA ─── */}
        <Section id="schema" title="Database Schema">
          <P>All tables are defined in <Code>src/db/schema.ts</Code> using Drizzle&apos;s <Code>pgTable</Code>.</P>

          <H3>Organization, Billing &amp; Credit Tables</H3>
          <Table
            headers={['Table', 'Key Columns', 'Purpose']}
            rows={[
              ['organization', 'id, name, slug, plan, logoUrl, subscriptionId, billingEmail, currentPeriodEnd', 'Manages organization tenant, subscription tier, and billing cycle dates'],
              ['organization_credit_period', 'organizationId, aiCreditsAllotted, aiCreditsUsed, searchCreditsAllotted, searchCreditsUsed, periodStart, periodEnd', 'Tracks pooled AI actions and web search usage per billing cycle'],
              ['usage_event', 'organizationId, userId, type, toolName, metadata, createdAt', 'Granular audit log recording every AI and search execution'],
              ['member', 'organizationId, userId, role', 'Organization membership (owner, agency, member, client)'],
            ]}
          />

          <H3>Invoicing &amp; Payment Tables</H3>
          <Table
            headers={['Table', 'Key Columns', 'Purpose']}
            rows={[
              ['invoice', 'organizationId, projectId, invoiceNumber, status, issueDate, dueDate, total, currency, clientSnapshot', 'Full invoice lifecycle: draft | sent | viewed | paid | overdue | void'],
              ['invoice_item', 'invoiceId, title, description, quantity, unitPrice, amount', 'Itemized billable line items'],
              ['invoice_defaults', 'organizationId, currency, paymentTermsDays, companySnapshot', 'Organization default invoice templates & terms'],
              ['payment_milestone', 'projectId, title, amount, currency, triggerType, status, deliverableId', 'Milestone statuses: upcoming | due | overdue | paid | waived'],
              ['payment', 'milestoneId, projectId, amount, currency, paymentMethod, referenceNote, status, paidAt', 'Stores payment verification & UTR reference notes'],
            ]}
          />

          <H3>Contract, AI Scope, Proposal &amp; Activity Tables</H3>
          <Table
            headers={['Table', 'Key Columns', 'Purpose']}
            rows={[
              ['contract', 'projectId, fileUrl, fileName, documentType, uploadedByRole, status, signedDocumentUrl, documentHash', 'Supports sow | nda | noc | msa | addendum | other'],
              ['contract_scope_term', 'contractId, projectId, termType, title, description, maxRevisions', 'Enum: scope | exclusion | revision_limit | payment_term'],
              ['signature', 'contractId, userId, signatureData, signatureMethod, ipAddress, userAgent, documentHash', 'Bi-directional e-signature execution & cryptographic audit logs'],
              ['proposal', 'projectId, title, price, currency, status', 'Status: draft | sent | accepted | declined'],
              ['deliverable', 'projectId, title, status, dueDate, submissionTitle, submissionUrl', 'Status: pending | in_review | approved | revision_requested'],
              ['activity_log', 'projectId, userId, type, metadata', 'Audit log for contract, payment, deliverable, and member actions'],
              ['files', 'projectId, name, size, url, uploadedBy', 'Project attachments and document storage'],
            ]}
          />
        </Section>

        {/* ─── CONTRACT & SECURITY ARCHITECTURE ─── */}
        <Section id="contracts" title="Contract Vault & Security Architecture">
          <P>
            Scrunity implements defense-in-depth authorization, private document storage, and cryptographic lifecycle verification:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><strong className="text-foreground font-medium">Resilient Document Vault:</strong> PDF contracts and project files are managed via a unified Blob proxy layer (<Code>src/lib/blob.ts</Code>) that automatically adapts across both public and private Vercel Blob stores with graceful fallback. Public direct URLs are prohibited in user flows; downloads and viewings pass through auth-gated proxies (<Code>/api/contracts/download</Code> &amp; <Code>/api/files/download</Code>).</li>
            <li><strong className="text-foreground font-medium">Immutable Signed Contracts:</strong> Contracts with any signature state (<Code>signed</Code>, <Code>partially_signed</Code>, <Code>fully_signed</Code>) are immutable and cannot be deleted.</li>
            <li><strong className="text-foreground font-medium">Durable Serverless Notifications:</strong> Activity logging and transactional email dispatches use Next.js 16&apos;s <Code>after()</Code> API in <Code>src/lib/activity.ts</Code> to guarantee background delivery without timing out in serverless runtimes.</li>
          </ul>
        </Section>

        {/* ─── API ─── */}
        <Section id="api" title="API Routes Specification">
          <Table
            headers={['Route', 'Method', 'Purpose']}
            rows={[
              ['/api/ai/torch', 'POST', 'Streaming SSE agent endpoint with multi-step tool loops & live reasoning'],
              ['/api/ai/torch/confirm', 'POST', 'Human-in-the-loop confirmation handler executing approved drafts'],
              ['/api/organizations/credits', 'GET', 'Fetch organization pooled AI and search credit usage summary'],
              ['/api/invoices', 'GET/POST', 'Fetch workspace invoices or create new invoice draft'],
              ['/api/invoices/[id]', 'GET/PATCH/DELETE', 'Fetch invoice document view, update status, or record payment'],
              ['/api/ai/extract-contract', 'GET/POST', 'Extract scope clauses from contract PDF via Groq AI & persist in DB'],
              ['/api/ai/check-scope', 'POST', 'Evaluate deliverable revision count against AI scope terms'],
              ['/api/ai/generate-addendum', 'POST', 'Draft itemized SOW Change Order addendum with pricing'],
              ['/api/billing/checkout', 'POST', 'Generate subscription checkout session with organization binding'],
              ['/api/billing/portal', 'POST', 'Generate auth-gated customer billing portal redirect'],
              ['/api/billing/webhook', 'POST', 'Idempotent webhook handler syncing subscription lifecycle state to DB'],
              ['/api/webhooks/dodo', 'POST', 'Dodo Payments webhook alias routing to billing webhook processor'],
              ['/api/milestones', 'POST/PATCH/DELETE', 'Create, update, or delete payment milestones (queries use direct Server Component DB access)'],
              ['/api/milestones/mark-paid', 'POST', 'Record manual payment verification & UTR reference note'],
              ['/api/contracts', 'GET/POST/PATCH/DELETE', 'Upload agreements, fetch contracts, update status'],
              ['/api/contracts/download', 'GET', 'Auth-gated private stream proxy for downloading contract PDFs'],
              ['/api/contracts/sign', 'POST', 'Execute e-signature and generate cryptographic SHA-256 seal'],
              ['/api/deliverables', 'POST/PATCH', 'Create deliverable, update status & trigger linked milestones'],
              ['/api/deliverables/bulk', 'PATCH', 'Bulk update deliverables within a single project atomically'],
              ['/api/proposals', 'POST/PATCH/DELETE', 'Create, update, send, or delete proposals (queries use direct Server Component DB access)'],
              ['/api/payments/proof/upload', 'POST', 'Upload payment receipt / screenshot proof for verification'],
              ['/api/payments/proof/review', 'POST', 'Review and approve/reject submitted payment proof with AI OCR extraction'],
              ['/api/files', 'POST/DELETE', 'Upload and manage project files'],
              ['/api/files/download', 'GET', 'Auth-gated private stream proxy for downloading project files'],
              ['/api/organizations/invites/accept', 'POST', 'Process and accept organization teammate invitations'],
              ['/api/projects/invites/accept', 'POST', 'Accept project invitation and sync contract signature rows'],
              ['/api/notifications', 'GET/POST', 'Fetch unread notifications & mark read'],
            ]}
          />
        </Section>

        {/* ─── ENV ─── */}
        <Section id="env" title="Environment Variables">
          <Table
            headers={['Variable', 'Required', 'Description']}
            rows={[
              ['DATABASE_URL', 'Yes', 'Neon Serverless Postgres connection string'],
              ['GROQ_API_KEY', 'Yes', 'Groq API Key for LLM model processing (gpt-oss-120b & gpt-oss-20b)'],
              ['FIRECRAWL_API_KEY', 'Yes', 'Firecrawl API Key for Torch live web search (/v2/search)'],
              ['UPSTASH_REDIS_REST_URL', 'Yes', 'Upstash Redis REST URL for caching and rate limits'],
              ['GOOGLE_CLIENT_ID', 'Yes', 'Google OAuth client ID'],
              ['GOOGLE_CLIENT_SECRET', 'Yes', 'Google OAuth client secret'],
              ['BETTER_AUTH_SECRET', 'Yes', 'Session encryption secret'],
              ['BLOB_READ_WRITE_TOKEN', 'Yes', 'Vercel Blob private storage token'],
              ['RESEND_API_KEY', 'Yes', 'Resend transactional email API key'],
              ['DODO_PAYMENTS_API_KEY', 'Yes', 'Dodo Payments Merchant of Record API key'],
            ]}
          />
        </Section>

        {/* ─── COMMANDS ─── */}
        <Section id="commands" title="Dev & Verification Commands">
          <Table
            headers={['Command', 'Description']}
            rows={[
              ['npm run dev', 'Start local development server (port 3000)'],
              ['npm run build', 'Build production bundle'],
              ['npm run typecheck', 'Execute tsc --noEmit type verification (0 errors constraint)'],
              ['npm run lint', 'Run ESLint linting check'],
              ['npm run db:generate', 'Generate versioned SQL migration from src/db/schema.ts'],
              ['npm run db:migrate', 'Execute pending migrations against Neon Postgres via __drizzle_migrations'],
              ['npm run db:studio', 'Open Drizzle Studio local database viewer'],
            ]}
          />
          <div className="mt-3 p-3 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            <strong className="text-foreground">Schema Change Protocol:</strong> Never use <code className="text-xs bg-muted px-1 py-0.5 rounded">db:push</code> in production. All database modifications must be generated via <code className="text-xs bg-muted px-1 py-0.5 rounded">npm run db:generate</code> and applied via <code className="text-xs bg-muted px-1 py-0.5 rounded">npm run db:migrate</code>.
          </div>
        </Section>

        {/* Footer */}
        <footer className="mt-20 pt-6 border-t border-border/40 flex justify-between items-center text-[11px] text-muted-foreground">
          <span>Scrunity Internal Developer Documentation</span>
          <span className="tabular-nums">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        </footer>
      </div>
    </div>
  );
}
