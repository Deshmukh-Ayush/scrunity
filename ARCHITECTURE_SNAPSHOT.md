# Architecture Snapshot: Scrunity Platform (Pre-GTM Pivot)

> **Snapshot Date:** October 2026  
> **Source Branch:** `archive/full-platform-pre-gtm-pivot`  
> **Repository:** `Deshmukh-Ayush/scrunity` (formerly `aursh`)  
> **Status:** 100% complete snapshot of the full agency revenue protection, client collaboration, and Torch AI platform prior to the lean GTM-agent skeleton refactoring.

---

## 1. Executive Summary & Purpose

Scrunity was designed and built as an all-in-one AI-powered agency revenue protection and client collaboration Operating System. It replaced the fragmented toolchain typical of digital agencies (DocuSign, Trello, WhatsApp, Excel invoices, and manual bank reconciliation) with a single, cryptographically verifiable source of truth.

The platform provides:
1. **Legal & Contract Vault:** Contract upload, automated Groq AI scope term extraction, bi-directional canvas e-signatures with SHA-256 audit trails, and auth-gated private Blob streaming.
2. **Scope Creep Guardian & Change Orders:** Continuous monitoring of deliverable revisions against contractual limits, automated scope creep warnings, and instant SOW addendum generation with itemized pricing.
3. **Professional Invoicing & Payment Reconciliation:** Standalone and milestone-linked invoice builder, Vercel-style monochrome invoice views, downloadable PDFs, client payment proof upload with multimodal AI OCR (Groq Vision + Tesseract.js), and UTR reference recording.
4. **Multi-Currency Engine:** Org-level global reporting currency (USD/INR), project-locked currencies, live 24h-cached FX rates via Frankfurter and open.er-api, and historical FX-rate locking at transaction time.
5. **Torch AI Co-Pilot:** A 9-tool autonomous workspace agent with streaming SSE responses, rich structured cards, and human-in-the-loop draft confirmations.
6. **Enterprise Multi-Tenant Infrastructure:** Next.js 16 network proxy (`src/proxy.ts`) header-injection authentication, sub-200ms TTFB via `React.cache()` deduplication, strict role isolation, and immutable linear Drizzle database migrations.

---

## 2. Major Features Built

### 2.1 Contracts & Legal Vault
- **Supported Formats & Types:** SOW (Statement of Work), NDA (Non-Disclosure Agreement), NOC (No Objection Certificate), MSA (Master Services Agreement), Addendum, and Other.
- **Resilient Private Document Storage:** Contracts are uploaded to Vercel Blob via `src/lib/blob.ts`. Direct public URLs are prohibited; all contract downloads and previews stream through an auth-gated proxy (`/api/contracts/download`) verifying user permissions.
- **Bi-Directional E-Signatures:**
  - In-browser signature capture (smooth canvas drawing or typed signature).
  - Collects signer user ID, full name, email, IP address, user agent, and timestamp.
  - Generates SHA-256 document hash and stores a tamper-evident audit trail JSON.
  - Contract lifecycle states: `draft` -> `sent` -> `partially_signed` -> `fully_signed` (or `signed`).
  - Signed contracts are legally locked: any contract with signature rows cannot be deleted or mutated.
- **AI Scope-Term Extraction (`/api/ai/extract-contract`):**
  - Groq LLM (`openai/gpt-oss-120b` with fallback to `openai/gpt-oss-20b`) extracts clauses into `contract_scope_term`:
    - `scope`: In-scope deliverables and technical boundaries.
    - `exclusion`: Explicitly excluded tasks and out-of-scope requests.
    - `revision_limit`: Allowed revision cycles per deliverable.
    - `payment_term`: Payment milestones, net payment periods, and trigger conditions.

### 2.2 Proposals
- **Lifecycle:** `draft` -> `sent` -> `accepted` -> `declined`.
- **Itemized Line Items:** Stored in `proposal_line_items` with description, quantity, unit price, and line total.
- **Scope Summary:** Rich text overview of proposal terms, validity date, and total contract value.
- **Milestone Generation:** Accepting a proposal can automatically populate linked project payment milestones in the project workspace.

### 2.3 Deliverables & Scope Reconciliation
- **Lifecycle:** `pending` -> `in_review` -> `approved` | `revision_requested`.
- **Submission Tracking:** Agency members submit title, URL (Figma, GitHub, Loom, Drive), and submission notes.
- **Contract-Driven Reconciliation:**
  - The **Scope Guardian** (`src/lib/ai/scope-guardian.ts`) compares cumulative revision requests against the contract's `revision_limit`.
  - UI surfaces status badges: `within_scope`, `limit_reached`, or `scope_creep_alert`.
  - When revisions exceed limits, the system triggers the **Change Order Addendum Generator** (`/api/ai/generate-addendum`), drafting a formal SOW amendment with itemized billable pricing for client approval.

### 2.4 Invoicing OS & Payment Proof Verification
- **Full Invoice Builder (`/projects/[projectId]/payments/invoices/new`):**
  - Prefix and auto-incrementing serials (`INV-001`, `INV-002`) managed per organization via `invoice_defaults`.
  - Company snapshot and client snapshot frozen at creation time.
  - Itemized line items with quantities, unit prices, and row totals.
  - Dynamic billing modifiers (fixed or percentage discounts, taxes, and handling fees).
  - Customizable theme colors, payment details (UPI ID, bank accounts, wire transfer notes), and payment terms.
- **Status Lifecycle:** `draft` -> `sent` -> `viewed` -> `payment_submitted` -> `paid` (with dynamic `overdue` and `void` states).
- **Vercel-Inspired Invoice Document View:** Clean, monochrome document layout rendering live or historical snapshots.
- **PDF Generation:** Downloadable, auth-gated invoice PDF generation via `/api/invoices/download`.
- **Payment Proof Upload & Multimodal OCR:**
  - Clients can upload bank transfer screenshots or receipts (`/api/payments/proof/upload`).
  - Multimodal Groq Vision extracts transaction ID / UTR, amount, currency, and payment date, with a Tesseract.js local fallback.
  - Agency owners review proofs in `PaymentProofReviewModal` (`/api/payments/proof/review`). Approval marks the invoice and milestone as `paid` and creates an official `payment` record.
- **Standalone & Milestone Linking:** Invoices can be directly attached to a contract milestone or issued as standalone billable invoices.

### 2.5 Multi-Currency Engine
- **Org Global Currency:** Configurable reporting currency (`organization.globalCurrency`: `USD` or `INR`).
- **Project-Level Currency:** Project currency is chosen at creation and locked (`project.currency`: `USD` or `INR`).
- **Live FX Rate Integration:** Rates fetched from `api.frankfurter.dev` with fallback to `open.er-api.com` and 24-hour in-memory/Redis caching in `src/lib/currency.ts`.
- **Historical FX Rate Locking:** When a payment is recorded, the live conversion rate is frozen in `payment.fxRateAtPayment` (`numeric(10, 4)`), ensuring financial reports remain accurate regardless of subsequent FX fluctuations.
- **Subunit Currency Storage:** All monetary values in `invoice`, `invoice_line_item`, `payment_milestone`, and `payment` are stored as integers in smallest currency subunits (cents for USD, paise for INR) to prevent IEEE 754 floating-point errors.
- **Conversion Helpers:** `convertAmount` and `convertAndAggregate` seamlessly sum mixed-currency portfolios into the organization's global reporting currency.

### 2.6 Credit Tracking System & Rate Limiting
- **Pooled Organization Credits:** AI tool calls and web search credits are pooled at the organization level (`organization_credit_period`), synchronized with Dodo Payments subscription billing cycles.
  - *Free Tier:* 50 AI credits, 10 Search credits.
  - *Freelancer Tier:* 300 AI credits, 50 Search credits.
  - *Agency Tier:* 1,500 AI credits, 250 Search credits per paid seat.
- **Sliding-Window Circuit Breaker:** 60 external web search requests per hour maximum window to protect third-party API quotas.
- **Soft-Cap Policy:** `ENFORCE_CREDIT_LIMITS = false` ensures active client engagements are never interrupted mid-flight; usage is recorded in `usage_event` for auditing.

### 2.7 Torch AI Co-Pilot (The 9 Tools)
Torch is an autonomous workspace co-pilot operating on Groq's `openai/gpt-oss-120b` (with `20b` fallback) using AI SDK v7 streaming SSE:
1. `queryWorkspaceOverview`: High-level portfolio summary of active projects, pending deliverables, proposals, and cashflow.
2. `auditProjectScope`: Audits revision count and tasks against extracted contract scope terms, detecting scope creep.
3. `generateAddendumDraft`: Produces formal Change Order SOW addendum text with pricing.
4. `analyzeFinancials`: Org-wide or per-project revenue breakdown (collected, due, overdue, upcoming) converted to global currency.
5. `generateClientDigest`: Generates a professional weekly progress update ready to share with clients.
6. `createDeliverableDraft`: Generates structured deliverable items with due dates and requirements.
7. `queryInvoiceStatus`: Returns breakdown of invoices by status, overdue balances, and days outstanding.
8. `draftInvoiceForMilestone`: Pre-fills an invoice draft directly from a completed payment milestone.
9. `webSearch`: External web search via Firecrawl `/v2/search` for market pricing and benchmark research.

**UI Architecture:** Built as a compound component suite (`<Torch.Root>`, `<Torch.Messages>`, `<Torch.Input>`, `<Torch.Reasoning>`, `<Torch.Artifact>`), structured visual cards (`ScopeAuditResult`, `FinancialsResult`, `InvoiceStatusResult`), and human-in-the-loop `ApprovalCard` components dispatching to `/api/ai/torch/confirm`.

### 2.8 Dashboard Redesign (Phases 1-2a)
- **Executive Overview:** 2 Hero KPI cards, live EvilCharts visualization, Attention Items table with staggered animations, and sliding pill filter toolbars.
- **Projects Directory:** Full portfolio health metrics, multi-currency contract values, and Phosphor-icon badges.
- **Analytics:** Revenue velocity charts, conversion donuts, and project performance tables.
- **Clients:** Client acquisition velocity, conversion rates, and relationship status tables.
- **Team Management:** Seat capacity monitoring, contributor leaderboard, and audit log activity streams.

---

## 3. Full Database Schema Table List

All tables defined in `src/db/schema.ts` with Drizzle ORM:

| # | Table Name | Purpose |
|---|---|---|
| 1 | `user` | Better Auth core user table storing account ID, name, email, avatar, and verification status. |
| 2 | `session` | Better Auth session store tracking active sessions, IP, user-agent, and `activeOrganizationId`. |
| 3 | `account` | OAuth provider credentials and account linkages (Google OAuth, password hashes). |
| 4 | `verification` | Email verification and authentication tokens with expiration timestamps. |
| 5 | `organization` | Agency tenant entity storing name, slug, plan tier, global currency, and Dodo subscription metadata. |
| 6 | `member` | Associates users with organizations, defining org-level roles (`owner`, `admin`, `member`, `agency`). |
| 7 | `invitation` | Pending and accepted team email invitations with role assignments and expiry. |
| 8 | `team` | Internal sub-teams or functional departments within an agency organization. |
| 9 | `team_member` | Junction table associating organization members with specific internal teams. |
| 10 | `project` | Client project container scoped to an organization with locked currency and project status. |
| 11 | `project_member` | Project-level membership defining access roles (`owner`, `agency`, `client`) per project. |
| 12 | `project_invitation` | White-labeled client and contractor email invites to projects with unique access tokens. |
| 13 | `contract` | Legal agreements (SOW, NDA, NOC, MSA, Addendum) with file URLs, status, and document hashes. |
| 14 | `signature` | Bi-directional e-signatures with canvas data, IP, user-agent, SHA-256 seal, and audit trail JSON. |
| 15 | `files` | Project-scoped file vault attachments with size, MIME type, and private Blob URLs. |
| 16 | `deliverable` | Trackable deliverables with status, submission URLs, due dates, and revision tracking. |
| 17 | `activity_log` | Comprehensive audit trail of all project events (contracts, deliverables, payments, proposals). |
| 18 | `notification` | In-app user notifications linked to project activity events with read/unread tracking. |
| 19 | `comment` | Threaded discussions and client feedback on specific deliverables. |
| 20 | `contract_scope_term` | AI-extracted scope clauses, exclusions, revision limits, and payment terms from contract PDFs. |
| 21 | `payment_milestone` | Financial milestones tied to deliverables or proposals with trigger types and status. |
| 22 | `payment` | Confirmed payment transaction records with currency, method, UTR note, and locked historical FX. |
| 23 | `proposal` | Client project proposals with pricing, scope summary, validity period, and approval status. |
| 24 | `proposal_line_items` | Itemized billable line items with quantities and unit prices within a proposal. |
| 25 | `invoice` | Invoices with serials, frozen company/client snapshots, billing details, and status lifecycle. |
| 26 | `invoice_line_item` | Itemized billable goods or services attached to an invoice. |
| 27 | `invoice_defaults` | Organization-level default invoice settings, company details, payment info, prefix, and serials. |
| 28 | `organization_credit_period` | Pooled AI and search credit allowances and usage counters per billing cycle. |
| 29 | `usage_event` | Granular audit log of every AI tool call and web search event for billing and credit deduction. |
| 30 | `torch_conversation` | Persistent chat conversation threads for the Torch AI workspace co-pilot. |
| 31 | `torch_message` | Chat messages within a Torch conversation with reasoning steps and artifact payloads. |
| 32 | `payment_proof` | Client payment receipts and screenshots with AI OCR extraction results and review workflow. |

---

## 4. Full API Route List

All routes located in `src/app/api`:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/ai/check-scope` | Evaluates deliverable revision counts against contract terms to detect scope creep. |
| `GET`/`POST` | `/api/ai/extract-contract` | Parses uploaded contract PDF via Groq LLM, extracting scope, exclusions, and revision limits. |
| `POST` | `/api/ai/generate-addendum` | Drafts a formal Change Order SOW addendum with itemized pricing when scope creep occurs. |
| `POST` | `/api/ai/torch/confirm` | Human-in-the-loop action endpoint executing approved draft actions (proposals, invoices, deliverables). |
| `GET`/`POST` | `/api/ai/torch/conversations` | Lists or creates persistent Torch AI conversation threads for the active organization. |
| `GET`/`POST` | `/api/ai/torch/messages` | Fetches conversation history or appends new messages to a Torch conversation. |
| `POST` | `/api/ai/torch` | Streaming SSE endpoint running Torch multi-step tool execution loops with Groq LLM. |
| `ALL` | `/api/auth/[...all]` | Better Auth endpoint handling Google OAuth, session validation, and organization switching. |
| `POST` | `/api/billing/checkout` | Creates a Dodo Payments checkout session bound to the authenticated organization. |
| `POST` | `/api/billing/portal` | Generates an authenticated Dodo Payments customer billing portal redirect URL. |
| `POST` | `/api/billing/webhook` | Idempotent webhook receiver syncing Dodo subscription status, payments, and credit cycles. |
| `GET`/`POST` | `/api/comments` | Fetches or creates comments on deliverables within an authorized project. |
| `GET` | `/api/contracts/download` | Auth-gated private stream proxy for downloading contract PDFs from Vercel Blob. |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/contracts` | Uploads agreements, lists contracts, updates status, or removes unsigned drafts. |
| `POST` | `/api/contracts/sign` | Executes e-signature and generates cryptographic SHA-256 seal and audit trail. |
| `PATCH` | `/api/deliverables/bulk` | Atomically updates status or sort order for multiple deliverables in a project. |
| `POST`/`PATCH`/`DELETE` | `/api/deliverables` | Creates, updates, or deletes deliverables and triggers linked payment milestones. |
| `GET` | `/api/files/download` | Auth-gated private stream proxy for downloading project vault attachments. |
| `POST`/`DELETE` | `/api/files` | Uploads project file attachments and manages file records. |
| `GET` | `/api/invoices/download` | Generates and streams downloadable PDF invoices. |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/invoices` | Creates invoice drafts, lists workspace invoices, or updates invoice lifecycle status. |
| `POST` | `/api/invoices/upload` | Uploads invoice-specific assets or attachments to private Blob storage. |
| `POST` | `/api/milestones/mark-paid` | Records manual payment verification with payment method and UTR reference note. |
| `POST`/`PATCH`/`DELETE` | `/api/milestones` | Creates, updates, reorders, or deletes project payment milestones. |
| `POST` | `/api/notifications/read` | Marks user notifications as read. |
| `GET` | `/api/notifications` | Fetches unread and historical notifications for the active user. |
| `GET` | `/api/organizations/credits` | Fetches organization pooled AI and search credit allocation and consumption. |
| `POST` | `/api/organizations/invites/accept` | Processes and accepts organization teammate invitations. |
| `GET`/`POST`/`DELETE` | `/api/organizations/invites` | Creates, lists, or revokes team invitations for an organization. |
| `GET`/`PATCH` | `/api/organizations` | Retrieves or updates organization profile, settings, and global reporting currency. |
| `POST` | `/api/payments/proof/review` | Agency review endpoint to confirm or reject submitted payment proofs. |
| `POST` | `/api/payments/proof/upload` | Uploads payment screenshot/receipt and triggers multimodal AI OCR extraction. |
| `POST` | `/api/projects/invites/accept` | Accepts project invitations for clients/contractors and synchronizes signature slots. |
| `POST` | `/api/projects/invites/resend` | Resends pending project invitations via Resend email. |
| `GET`/`POST`/`DELETE` | `/api/projects/invites` | Creates, lists, or cancels project stakeholder invitations. |
| `GET`/`POST`/`DELETE` | `/api/projects/members` | Manages project member assignments, roles, and removals. |
| `GET`/`POST` | `/api/projects` | Creates and lists projects scoped to the active organization. |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/proposals` | Creates, updates, sends, accepts, declines, or deletes client proposals. |
| `POST` | `/api/webhooks/dodo` | Secondary alias endpoint routing incoming Dodo Payments webhooks. |

---

## 5. Key Architectural Decisions Worth Preserving as Lessons

1. **Proxy-Based Header-Injection Auth (`src/proxy.ts`):**
   - *Pattern:* In Next.js 16, `proxy.ts` intercepts incoming requests at the network boundary. It validates the session, looks up user and active org roles, sanitizes any inbound `x-user-*` or `x-org-*` headers to prevent header-spoofing attacks, and injects verified `x-user-id`, `x-org-id`, `x-org-role`, `x-project-role` into request headers.
   - *Benefit:* Server Components and API routes read verified identity directly from request headers via `headers()` without making redundant database queries or waterfalls.
2. **Render-Architecture Rules (`AGENTS.md`):**
   - `layout.tsx` files contain zero business logic, zero `await` calls, and zero database queries. Layouts serve purely as structural chrome, shell UI, and provider containers.
   - `page.tsx` files contain only structural markup; any data-dependent section is encapsulated in its own distinct component wrapped in a React `<Suspense>` boundary with a purpose-built loading skeleton.
   - `page.tsx` is NEVER a Client Component. Page roots remain React Server Components (RSC) to preserve streaming, metadata, and server-side cache boundaries.
   - Authorization is resolved in `src/proxy.ts`, NOT in React layouts, eliminating layout-level DB waterfalls and client-side flash.
3. **Subunit-Currency Storage Convention:**
   - All financial amounts in the database are stored as integers in smallest subunits (e.g., USD cents, INR paise). Floating-point arithmetic is never stored in financial columns.
   - Formatting and scaling (`/ 100`) occurs strictly at the presentation and input layers.
4. **Migration-via-Generate-Not-Push Discipline:**
   - `drizzle-kit push` (`npm run db:push`) is strictly prohibited against live production databases to prevent schema drift.
   - All migrations follow: (1) edit `src/db/schema.ts` -> (2) `npm run db:generate` (generates numbered SQL migration in `./drizzle` and updates snapshot in `./drizzle/meta`) -> (3) `npm run db:migrate` (executes migration safely through `__drizzle_migrations`).
   - Historical migrations (`0000`, `0001`, `0002`, etc.) are immutable records in linear version control.
5. **Durable Background Processing via `after()`:**
   - Audit logging (`activity_log`) and transactional emails (`Resend`) use Next.js 16's `after()` API (`src/lib/activity.ts`), executing asynchronously after the HTTP response has closed without blocking serverless runtimes.

---

## 6. Known Deferred / Open Items

1. **Payment-Gating Mechanic:**
   - *Intended Behavior:* Prevent clients from downloading approved deliverables or final source files until linked invoices/milestones were marked as `paid`.
   - *Status:* Deferred/never built; deliverables remained accessible and downloadable once approved, relying on mutual trust.
2. **Automated Invoice Reminders:**
   - *Intended Behavior:* Scheduled background cron/job to automatically send email notifications for invoices nearing due date or marked overdue.
   - *Status:* Deferred; invoice notices were manually dispatched by agency owners.
3. **Multi-Milestone Bundling:**
   - *Intended Behavior:* Ability to combine multiple payment milestones into a single consolidated invoice.
   - *Status:* Deferred; invoices mapped 1:1 with single milestones or were created as standalone invoices.
4. **`proposal.price` Subunit Inconsistency:**
   - *Issue:* Proposals originally saved `proposal.price` in major currency units (e.g., `5000` for $5,000) whereas `payment_milestone.amount` and `invoice.total` stored subunit cents (`500000`).
   - *Status:* Patched at the conversion layer (`fix(proposals): scale proposal item total to subunit cents when generating milestones`), but legacy schema column retained integer in major units.
5. **Sentry Setup Status:**
   - *Status:* Deferred; production error logging relied on PostHog client analytics and Vercel runtime logs.

---

## 7. Sibling-Agent Prototypes (Shelved)

During the development of the AI co-pilot, two specialized sibling-agent prototypes were explored alongside Torch:
1. **Onboarding Automation Agent:**
   - *Concept:* An autonomous agent designed to conduct interactive client intake interviews, collect branding assets, ingest questionnaires, and automatically scaffold the project workspace and milestones.
2. **Deliverable-Tracking Agent:**
   - *Concept:* An autonomous background agent designed to poll deliverables, monitor deadlines, and proactively ping contractors and clients for review feedback.
3. **Why They Were Shelved:**
   - *User Feedback & Trust:* Agency owners expressed strong apprehension about multiple autonomous agents communicating directly with clients or operating in fragmented silos outside of human supervision. Unintended external client communications represented a critical risk to client relationships.
   - *Unified Co-Pilot Preference:* Users overwhelmingly preferred a single, unified, high-context co-pilot (Torch) situated centrally within the main dashboard, where all agent actions produce human-in-the-loop draft artifacts (`ApprovalCard`) that require explicit agency approval before mutating state or notifying clients.

---

## 8. Preserved Assets on Archive Branch

The full source code, UI components, database migrations, and historical commits of this entire platform are preserved on GitHub:
- **Branch:** `archive/full-platform-pre-gtm-pivot`
- **Commit:** `2173539ddb5d6e7e637de42e6e6f625f7ce3246c` (and subsequent documentation commit)
- **Remote:** `https://github.com/Deshmukh-Ayush/scrunity.git`
