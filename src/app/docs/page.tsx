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
  description: "Internal developer documentation for the lean platform skeleton — architecture, Better Auth, Dodo Payments, Proxy auth header injection, and database schema.",
  robots: {
    index: false,
    follow: false,
  },
};

const DEVELOPER_EMAILS = [
  "losted710@gmail.com",
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
          <span className="text-[14px] font-bold tracking-tight text-foreground">Scrunity Skeleton</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand tracking-wider uppercase">
            Platform Developer Docs
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-mono font-medium">v0.1.0-lean</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-32 space-y-8">
        <header className="mb-12">
          <h1 className="text-[36px] font-semibold tracking-tight leading-tight text-foreground mb-3 text-balance">
            Platform Developer Documentation
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground max-w-2xl text-pretty">
            Technical architecture, proxy-based authentication header injection, Dodo Payments billing OS, core database schema, and design engineering primitives.
          </p>
        </header>

        {/* Table of Contents */}
        <Section title="Contents">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              ['Architecture Overview', '#overview'],
              ['Tech Stack & Infrastructure', '#stack'],
              ['Folder Structure', '#folders'],
              ['Proxy-Based Authentication', '#proxy-auth'],
              ['Billing & Subscriptions (Dodo)', '#billing'],
              ['Render Architecture Rules', '#render-rules'],
              ['Database Schema', '#schema'],
              ['API Routes Specification', '#api'],
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
        <Section id="overview" title="Architecture Overview">
          <P>
            This codebase represents the lean platform skeleton prepared for GTM-agent capability integration. All prior PM-specific features (contracts, deliverables, proposals, milestone invoices) have been safely archived to the <Code>archive/full-platform-pre-gtm-pivot</Code> branch, documented comprehensively in <Code>ARCHITECTURE_SNAPSHOT.md</Code>.
          </P>
          <P>
            The active tree retains the core multi-tenant foundation:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><strong className="text-foreground font-medium">Better Auth:</strong> Complete OAuth (Google) and credential authentication, session tracking, and organization multi-tenancy.</li>
            <li><strong className="text-foreground font-medium">Network Proxy (<Code>src/proxy.ts</Code>):</strong> Next.js 16 request boundary intercepting sessions, stripping spoofable headers, and injecting verified identity headers (<Code>x-user-id</Code>, <Code>x-org-id</Code>, <Code>x-org-role</Code>) before RSC render.</li>
            <li><strong className="text-foreground font-medium">Dodo Payments Billing OS:</strong> Self-service checkout sessions, portal redirection, and cryptographic webhook synchronization.</li>
            <li><strong className="text-foreground font-medium">Dashboard Shell &amp; Design Primitives:</strong> Collapsible sidebar, topbar, theme switching, and reusable motion/UI components.</li>
          </ul>
        </Section>

        {/* ─── TECH STACK ─── */}
        <Section id="stack" title="Tech Stack & Infrastructure">
          <Table
            headers={['Layer', 'Technology', 'Notes']}
            rows={[
              ['Framework', 'Next.js 16 (App Router)', 'RSC by default, Turbopack, React 19, async params, React.cache() deduplication'],
              ['Language', 'TypeScript 5', 'Strict type safety (tsc --noEmit)'],
              ['Authentication', 'Better Auth + Drizzle Adapter', 'Google OAuth, session management, organization plugin'],
              ['Proxy Layer', 'src/proxy.ts', 'Next.js 16 network-boundary proxy injecting sanitized auth headers'],
              ['Database', 'Neon (Serverless Postgres)', 'Stateless HTTP driver @neondatabase/serverless'],
              ['ORM', 'Drizzle ORM', 'Schema defined in src/db/schema.ts, versioned migrations in drizzle/'],
              ['Billing', 'Dodo Payments (MoR)', 'Automated checkout sessions, customer portal, webhook handlers'],
              ['UI & Styling', 'Tailwind CSS v4 & Radix UI', 'Brand color #00AAF7 (bg-brand), dark mode, custom neutral tokens'],
              ['Icons', 'Phosphor Icons & Lucide', '@phosphor-icons/react in client components, Lucide in RSC'],
            ]}
          />
        </Section>

        {/* ─── FOLDER STRUCTURE ─── */}
        <Section id="folders" title="Folder Structure">
          <CodeBlock>{`src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (ThemeProvider, Sonner, font loaders)
│   ├── globals.css             # Brand color #00AAF7, Tailwind v4 theme
│   ├── docs/                   # Developer documentation route
│   ├── dashboard/              # Main dashboard
│   │   ├── layout.tsx          # Zero-logic shell (Sidebar + Topbar)
│   │   ├── page.tsx            # Clean structural overview
│   │   ├── billing/            # Subscription plans, invoices, and billing portal
│   │   └── settings/           # Organization settings, team, branding
│   ├── api/
│   │   ├── auth/[...all]/      # Better Auth handler
│   │   ├── billing/            # Checkout, Portal & Webhook handlers
│   │   ├── webhooks/dodo/      # Dodo Payments webhook alias
│   │   └── organizations/      # Organization CRUD & team invitations
│   └── sign-in/                # Authentication page
│
├── components/
│   ├── dashboard/              # Dashboard modules (shell, sidebar, billing, settings)
│   ├── auth/                   # Better Auth sign-in component
│   ├── ui/                     # Product-agnostic UI primitives (Button, Card, Input)
│   ├── motion/                 # Reusable motion components
│   └── providers/              # Theme and analytics providers
│
├── config/
│   └── billing.ts              # Plan tiers, pricing, and feature limits
│
├── db/
│   └── schema.ts               # Core user, session, account, org, member, invite tables
│
├── lib/
│   ├── auth.ts                 # Better Auth server configuration
│   ├── auth-client.ts          # Better Auth client configuration
│   └── tenant-context.ts       # React.cache() deduplicated tenant context & auth resolver
│
└── proxy.ts                    # Next.js 16 auth header injection proxy`}</CodeBlock>
        </Section>

        {/* ─── PROXY AUTH ─── */}
        <Section id="proxy-auth" title="Proxy-Based Authentication & Header Injection">
          <P>
            In Next.js 16, <Code>src/proxy.ts</Code> acts as the network request guard. Before any React Server Component renders, the proxy intercepts the request:
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1.5 list-disc">
            <li><strong className="text-foreground font-medium">Header Sanitization:</strong> Inbound headers are purged of any client-supplied <Code>x-user-*</Code> or <Code>x-org-*</Code> values to completely prevent header spoofing.</li>
            <li><strong className="text-foreground font-medium">Session Resolution:</strong> Validates the session with Better Auth. Unauthenticated requests to protected paths (<Code>/dashboard</Code>, <Code>/onboarding</Code>) are redirected to <Code>/sign-in</Code>.</li>
            <li><strong className="text-foreground font-medium">Header Injection:</strong> Injects verified <Code>x-user-id</Code>, <Code>x-user-name</Code>, <Code>x-user-email</Code>, <Code>x-org-id</Code>, and <Code>x-org-role</Code> into request headers forwarded to downstream RSCs and API routes.</li>
            <li><strong className="text-foreground font-medium">Fast-Path Context (<Code>src/lib/tenant-context.ts</Code>):</strong> Downstream components read identity directly from request headers in &lt;1ms without issuing redundant database queries.</li>
          </ul>
        </Section>

        {/* ─── BILLING ─── */}
        <Section id="billing" title="Billing & Subscription OS">
          <P>
            Billing is powered by Dodo Payments as Merchant of Record (MoR):
          </P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1.5 list-disc">
            <li><strong className="text-foreground font-medium">Checkout Flow (<Code>/api/billing/checkout</Code>):</strong> Creates Dodo checkout sessions bound to the active organization ID and selected plan tier (<Code>free</Code>, <Code>freelancer</Code>, <Code>agency</Code>).</li>
            <li><strong className="text-foreground font-medium">Customer Portal (<Code>/api/billing/portal</Code>):</strong> Generates authenticated redirect sessions to Dodo&apos;s hosted customer management portal for card updates and cancellations.</li>
            <li><strong className="text-foreground font-medium">Webhook Processor (<Code>/api/billing/webhook</Code>):</strong> Cryptographically validates signatures using Standard Webhooks and idempotently syncs subscription status (<Code>active</Code>, <Code>canceled</Code>, <Code>past_due</Code>) and billing periods into the <Code>organization</Code> table.</li>
          </ul>
        </Section>

        {/* ─── RENDER RULES ─── */}
        <Section id="render-rules" title="Render Architecture Rules">
          <P>Strict engineering discipline maintained across all routes (enforced in <Code>AGENTS.md</Code>):</P>
          <ul className="my-2 pl-5 text-sm text-muted-foreground leading-relaxed space-y-1 list-disc">
            <li><strong className="text-foreground font-medium"><Code>layout.tsx</Code> rules:</strong> Layouts must contain zero business logic, zero <Code>await</Code> calls, and zero database queries. Layouts serve purely as structural chrome and provider containers.</li>
            <li><strong className="text-foreground font-medium"><Code>page.tsx</Code> rules:</strong> Page files must contain only structural markup. Any data-dependent section must be encapsulated in its own distinct component wrapped in a React <Code>&lt;Suspense&gt;</Code> boundary with a purpose-built loading skeleton.</li>
            <li><strong className="text-foreground font-medium">No Client Pages:</strong> Page roots are NEVER Client Components; they must remain React Server Components to preserve streaming and caching.</li>
          </ul>
        </Section>

        {/* ─── DATABASE SCHEMA ─── */}
        <Section id="schema" title="Database Schema">
          <P>All active tables are defined in <Code>src/db/schema.ts</Code> using Drizzle ORM:</P>
          <Table
            headers={['Table', 'Key Columns', 'Purpose']}
            rows={[
              ['user', 'id, name, email, emailVerified, image, createdAt, updatedAt', 'Better Auth core user entity'],
              ['session', 'id, expiresAt, token, userId, activeOrganizationId, ipAddress, userAgent', 'Active user sessions with organization binding'],
              ['account', 'id, accountId, providerId, userId, password, accessToken', 'OAuth provider accounts and credentials'],
              ['verification', 'id, identifier, value, expiresAt', 'Email verification tokens'],
              ['organization', 'id, name, slug, plan, globalCurrency, dodoCustomerId, subscriptionStatus', 'Workspace tenant entity and subscription metadata'],
              ['member', 'id, organizationId, userId, role, createdAt', 'Associates users with organizations and assigns org roles'],
              ['invitation', 'id, email, inviterId, organizationId, role, status, expiresAt', 'Pending team email invitations'],
            ]}
          />
        </Section>

        {/* ─── API ─── */}
        <Section id="api" title="API Routes Specification">
          <Table
            headers={['Route', 'Method', 'Purpose']}
            rows={[
              ['/api/auth/[...all]', 'ALL', 'Better Auth handler for Google OAuth, email/password, sessions, and org plugin'],
              ['/api/billing/checkout', 'POST', 'Generate Dodo Payments subscription checkout session'],
              ['/api/billing/portal', 'POST', 'Generate authenticated customer billing portal redirect'],
              ['/api/billing/webhook', 'POST', 'Cryptographic webhook handler syncing subscription lifecycle state to DB'],
              ['/api/webhooks/dodo', 'POST', 'Dodo Payments webhook alias routing to billing webhook processor'],
              ['/api/organizations', 'GET/PATCH', 'Retrieve or update organization profile, settings, and global currency'],
              ['/api/organizations/invites', 'GET/POST/DELETE', 'Create, list, or revoke organization team invitations'],
              ['/api/organizations/invites/accept', 'POST', 'Process and accept organization teammate invitations'],
            ]}
          />
        </Section>

        {/* ─── COMMANDS ─── */}
        <Section id="commands" title="Dev & Verification Commands">
          <Table
            headers={['Command', 'Description']}
            rows={[
              ['npm run dev', 'Start local development server on port 3000'],
              ['npm run build', 'Build production bundle with Next.js Turbopack'],
              ['npm run typecheck', 'Execute tsc --noEmit type verification (0 errors constraint)'],
              ['npm run lint', 'Run ESLint linting check'],
              ['npm run db:generate', 'Generate versioned SQL migration from src/db/schema.ts'],
              ['npm run db:migrate', 'Execute pending migrations against Neon Postgres via __drizzle_migrations'],
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
