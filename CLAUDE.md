# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `AGENTS.md` first.** It holds the binding rules: Next.js 16 has breaking changes (check `node_modules/next/dist/docs/` before writing Next code), the database migration protocol, the render/architecture rules (route folders hold only `page.tsx`/`layout.tsx`; `page.tsx` is always a Server Component and never fetches data itself; no `<Suspense>` without flagging first; authorization is done in `src/proxy.ts`), and the workflow rules (never commit unprompted, no "it works" without evidence).

## Commands

```bash
npm run dev            # Next dev server on :3000
npm run inngest:dev    # Local Inngest dev server (:8288), pointed at /api/inngest
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build
npm run format         # prettier (with tailwind plugin) over **/*.{ts,tsx}

npm run db:generate    # schema.ts -> numbered SQL in ./drizzle
npm run db:migrate     # apply migrations (never db:push against prod)
npm run db:studio
```

There is no test runner. Verification lives in `scripts/*.ts`: standalone scripts that load `.env` through `dotenv`, import from `../src/...`, and run against the real database (`DATABASE_URL`). Run one with `npx tsx scripts/<name>.ts`, e.g. `npx tsx scripts/test-multi-provider-mailboxes.ts`. They write real rows, so check what a script inserts or cleans up before you run it.

## Product state

The repo is called `aursh`. The product is Scrunity. `README.md` and `ARCHITECTURE_SNAPSHOT.md` mostly describe the **pre-pivot** agency platform (contracts, invoices, Torch co-pilot), which was archived on branch `archive/full-platform-pre-gtm-pivot`. The current codebase is a lean **GTM outreach agent**. Almost all live domain code uses the `gtm` prefix: `gtm*` tables in `src/db/schema.ts`, `src/lib/gtm-*.ts`, and `src/app/api/gtm/*`. Treat references in those docs to contracts, invoices, projects, and similar as historical.

## Architecture

### Request and tenant flow
- `src/proxy.ts` (Next 16's replacement for middleware) runs on `/sign-in`, `/onboarding`, `/dashboard/*`, `/api/billing/*`, `/api/gtm/*` and `/api/onboarding`. It resolves the Better Auth session, strips client-supplied identity headers, then injects `x-user-id`, `x-user-name`, `x-user-email`, `x-user-image`, `x-org-id` and `x-org-role`. Users with no org membership are redirected to `/onboarding`.
- `?test_org=<orgId>` (or a `test_org` cookie) impersonates a member of that org for local UI and API testing, but only when the server runs with `NODE_ENV !== "production"` **and** `ALLOW_TEST_ORG=true` (off by default; e.g. `ALLOW_TEST_ORG=true npm run dev` for `scripts/test-company-selection.ts`). It never works in a production build.
- The proxy resolves the org from a `member` row on every protected request and sets `x-org-id`/`x-org-role` from it (a removed member's stale active org is a 403 on `/api/*`). Role policy for `/api/gtm/*` lives in `lib/api-role-policy.ts`: owner/admin can launch, send, approve/reject, re-run, restart, delete and manage the mailbox; members read, draft and chat.
- Sending safety: `lib/send-eligibility.ts` (`getSendBlock`) is checked when a client approves a draft and again by the sender before every email: per-org opt-outs (`gtm_do_not_contact`, written when a reply is `not_interested`), platform hard bounces/suppression, qualification gates, name, `lookup_incomplete`. Clients can only approve `draft`/`approved` drafts.
- Spend limits are per organization and database-backed (`lib/org-quota.ts`, `org_usage_counter`): research runs need a plan or credits; defaults `GTM_RESEARCH_RUNS_PER_DAY=10`, `GTM_CAMPAIGNS_PER_DAY=20`, `GTM_CHAT_MESSAGES_PER_HOUR=60`, `GTM_LEAD_DRAFTS_PER_DAY=200`, `GTM_LOGO_FETCHES_PER_DAY=200`, `FIRECRAWL_ORG_DAILY_CAP=400` (reserved in `gtm_vendor_usage`), `GTM_CHAT_MAX_OUTPUT_TOKENS=2000`. Customer responses go through `lib/data/public-fields.ts` (no vendor names, ids, credits or payloads). Verify with `scripts/test-tenant-security.ts`, `scripts/test-tenant-security-b.ts` (production build) and `scripts/test-send-safety.ts` (in-process).
- Server code reads identity through `getTenantContext()` (`src/lib/tenant-context.ts`, wrapped in `React.cache`). Its fast path trusts the proxy headers and falls back to a full session lookup. Other per-request cached helpers live in `src/utils/cached-*.ts`. Every query must be scoped to `organizationId`.
- Auth is Better Auth with the organizations plugin (`src/lib/auth.ts`, `src/lib/auth-client.ts`).
- Onboarding (`/onboarding` → `POST /api/onboarding`, `lib/onboarding.ts`) creates the user's first org through the Better Auth plugin with a deterministic id (`org_<userId>`, set by the `beforeCreateOrganization` hook), so repeats are idempotent; the proxy sends users without a membership to `/onboarding` and users with one away from it. Verify with `scripts/test-onboarding.ts` against `npm run dev`.
- `/api/billing/webhook` (Dodo) is the one session-less path in the proxy matcher; it is authenticated by the Standard Webhooks signature (`DODO_PAYMENTS_WEBHOOK_KEY`, falls back to `DODO_PAYMENTS_WEBHOOK_SECRET`) and deduplicated on `webhook-id` in `billing_webhook_event` (`lib/dodo-webhook.ts`). Unauthenticated `/api/*` requests get 401 JSON from the proxy. Verify with `scripts/test-dodo-webhook.ts`.
- The proxy fails closed: if resolving the session throws, protected APIs get 503 JSON and protected pages redirect to `/sign-in?error=session_unavailable`; public paths stay public (`scripts/test-proxy-fail-closed.ts`, in-process).

### Pilot access (platform admin, invites, manual grants, magic link)
- **Platform admin** = verified session email in `PLATFORM_ADMIN_EMAILS` (comma-separated); not an org role. `/dashboard/admin` and `/api/admin/*` (plus `/api/gtm/admin/suppression`) answer everyone else with a plain 404, checked in the proxy and again in each handler/page (`lib/platform-admin.ts`; `lib/platform-admin-emails.ts` is the proxy-safe part). The `test_org` bypass never reaches admin.
- **Credits** have one customer-facing system: `gtm_ai_credit_period` + the `gtm_ai_credit_transaction` ledger (`lib/gtm-ai-credits.ts`). `organization_credit_period` is an internal vendor-spend meter, not a balance. All grants go through `addTopupCredits` (one SQL statement: ledger row + balance; optional `idempotencyKey` makes a repeat a no-op; `type: "manual_grant"` + `createdByUserId` for admin/pilot grants). Plan changes go through `activateOrganizationPlan` (`lib/billing-plan.ts`, shared with the Dodo webhook): sets plan/active/period end and resets credits to the plan allotment (no rollover, earlier grants are not carried over).
- **Pilot invites** (`pilot_invite`, `lib/pilot/`): one row per lowercased email. When an invited, verified email finishes onboarding (its `org_<userId>` org) `claimPilotInvite` applies the plan, then the extra credits (key `pilot_invite:<id>`), exactly once: a 2-minute lease row-lock for concurrent submits plus `planAppliedAt`/`creditsGrantedAt` so a retry (onboarding resubmit, or `resolveCampaignAccess` when launching a campaign) finishes a half-applied claim. Orgs without a plan get "Your account doesn't have access yet. Contact `SUPPORT_EMAIL`" from `POST /api/gtm/campaigns`.
- **Magic link** (Better Auth `magicLink` plugin, `lib/magic-link.ts`): 5-minute, single-use, hashed tokens. The response is always `{status:true}`; a link is delivered (after the response) only to an existing user, an open pilot invite or a pending team invitation, at most 3 per email per 15 min (hashed marker rows in `verification`, `magic_link_rate:<sha256>`) and 10 per IP (in-memory; Better Auth adds 5/min per IP in production). Mailer: `MAGIC_LINK_MAILER=console|resend`, default Resend when `RESEND_API_KEY` is set, else console (the link is printed to the server log).
- **Link base URL** = `NEXT_PUBLIC_APP_URL` (fallback `BETTER_AUTH_URL`); callbacks are made absolute on it. If it is `localhost`, the link only opens on the machine running the server (a customer's phone gets "connection refused"); for in-person demos set it to the LAN address (e.g. `http://192.168.1.3:3000`) or a tunnel URL and restart. Google sign-in still uses `BETTER_AUTH_URL` and its registered redirect URI.
- **Simulated checkout** (`api/billing/checkout` with no Dodo key or no price ID applies the plan/credits/seats for free) works only with `NODE_ENV=development` **and** `ALLOW_MOCK_BILLING=true`; otherwise it answers 503 "Online payments aren't enabled yet" and grants nothing (`scripts/test-mock-billing.ts`).
- **Suppression** (`gtm_suppression_entry`) is platform-wide, so only real do-not-contact facts are written: hard bounces and aggregator domains. Quality failures (bad name, low email confidence, no LinkedIn, failed MX) only disqualify the contact (`scripts/test-suppression-quality.ts`).
- Team invitation emails link to `/invite/org/<id>` (`components/invite/accept-invitation.tsx`); sign-in accepts `?next=/invite/org/<id>` only.
- Verify with `scripts/test-pilot-access.ts` (see its header: server started with `PLATFORM_ADMIN_EMAILS=pilot-admin@scrunity-test.invalid MAGIC_LINK_MAILER=console`, output logged to a file). Scripts that import `server-only` modules run with `npx tsx --tsconfig scripts/support/tsconfig.json`.

### Database
- Drizzle runs on `drizzle-orm/neon-http` (`src/utils/db.ts`). The HTTP driver does **not** support interactive `db.transaction()`, so write multi-step mutations as sequential statements (or `db.batch`).
- The whole schema is in `src/db/schema.ts`. Migrations in `./drizzle` are immutable history.

### GTM pipeline
The core of the app is a staged pipeline. Each stage's logic lives in `src/inngest/functions/<stage>.ts` as `executeX(id)`, which reads and writes the DB and advances `currentStage` through the forward-only `advanceResearchRun` / `advanceCampaign` helpers in `src/lib/pipeline/stage-state.ts`.

Stages, with event names in `src/inngest/client.ts` (`GtmEvents`):
- **Research run** (`gtmResearchRun`): `research_company` → `research_competitors` → `define_segments` → `done`.
- **Outreach campaign** (`gtmOutreachCampaign`): `find_companies` → `find_contacts` → `write_emails` (which first runs the Stage 5.5 qualification gates, `src/lib/gtm-stage-5-5.ts` and `gtm-qualification-gates.ts`) → `awaiting_approval` → `send_emails` (Stage 7, triggered by user approval via `api/gtm/campaigns/[id]/send`) → `done`.
- **Cron jobs**: `poll-replies` (Stage 8, every 10 minutes: reply/bounce detection, suppression, multi-turn threads) and `generate-digest`.

**Exactly one executor runs a given trigger** (`src/lib/pipeline/`):
- `dispatch.ts` is the only way to start or resume work (`dispatchResearchRun`, `dispatchCampaign`, `dispatchCampaignSend`). It uses either Inngest or the in-process runner, never both. Default: in-process locally (`isDev`), Inngest when deployed; override with `PIPELINE_EXECUTOR=inngest|direct`. If `inngest.send` fails, it falls back to in-process.
- `runner.ts` holds the stage tables. `runResearchStage` / `runCampaignStage` first **claim** the stage with an atomic conditional UPDATE (row at that stage, `in_progress`, no heartbeat within `STAGE_LEASE_MS` = 3 min). A second executor gets `skipped`. A thrown stage, or one that ends without advancing, marks the row `failed`.
- `inngest/functions/pipeline-stages.ts` runs each stage in a single `step.run` with `retries: 0`. Never pass the Inngest `step` into stage internals: nested steps make Inngest replay the whole stage.
- Heartbeats (`lastProgressAt`) come from every Firecrawl call (`firecrawl-spend.ts`) and from `touchCampaignProgress` in the long LLM/enrichment loops. Staleness detection (`gtm-staleness.ts`, 3–5 min) and the claim lease both depend on them.
- Restart Stage, campaign re-run and the research-run edit all require `researchRunIsIdle()` / `campaignIsIdle()`, so they're refused (409) while a stage is live or was just started.
- Firecrawl caps (`firecrawl-spend.ts`): every call is reserved up front against a **per-stage-attempt** budget (`firecrawlAttemptCallCount`, reset when a stage is claimed; defaults 25 research / 35 campaign) and a **lifetime** backstop (`firecrawlCallCount`; defaults 75 / 120). Failure reasons: `firecrawl_call_cap_exceeded` (retry gets a fresh budget) and `firecrawl_lifetime_cap_exceeded` (start a new campaign/run). Verify with `scripts/test-firecrawl-attempt-cap.ts` (stubbed network).
- Every Firecrawl HTTP request goes through one process-wide limiter (`firecrawl-limiter.ts`, on `globalThis`): `FIRECRAWL_REQUESTS_PER_MINUTE` (default 8) and `FIRECRAWL_MAX_CONCURRENCY` (default 2), sized for the Free plan (10 req/min, 2 browsers); a 429 pauses it for all callers. Legacy Stage 5 (`find-contacts.ts` → `find-contacts-lookup.ts` / `find-contacts-email.ts`) marks a contact `lookupStatus = "lookup_incomplete"` when a lookup is still rate-limited after retries, then re-runs only those lookups in a slower end-of-stage retry pass (60s cooldown, 3 retries). Stage 5.5 and `write_emails` skip incomplete contacts: never disqualified, suppressed or drafted. Verify with `scripts/test-firecrawl-rate-limit.ts`.

`src/inngest/client.ts` auto-detects dev mode (local URL → Inngest dev server at `127.0.0.1:8288`, no keys). Realtime progress channels are `gtm:run:<id>` and `gtm:campaign:<id>`. Publish to them with `safeRealtimePublish` from `functions/shared.ts`; it skips quietly (one log line) when no realtime endpoint is configured, i.e. locally unless `PIPELINE_EXECUTOR=inngest`, `INNGEST_DEV=true` or `INNGEST_BASE_URL` is set. Nothing in the UI subscribes yet; it polls.

#### Inngest deploy checklist
Function IDs changed in `4b666bc` (old `gtm-stage-1-research-company` … `gtm-stage-6-write-emails` and `gtm-stage-5-5`). The 9 current IDs, all served by `src/app/api/inngest/route.ts`:
`gtm-research-stage-{research-company,research-competitors,define-segments}`, `gtm-campaign-stage-{find-companies,find-contacts,write-emails}`, `gtm-stage-7-send-emails`, `gtm-poll-email-replies` (cron `*/10 * * * *`), `gtm-generate-segment-digest` (cron `0 6 * * *`). Event names did not change.
1. Deploy, then **re-sync the app** (`gtm-agent`) in the Inngest Cloud dashboard (Apps → Resync with the production `/api/inngest` URL), unless the Vercel integration is confirmed to sync on every deploy. Any change to a function ID, trigger or cron needs a sync.
2. Confirm: `GET https://<prod-domain>/api/inngest` returns `"function_count": 9` and `"mode": "cloud"`, and the dashboard lists exactly the 9 IDs above. The old IDs should show as removed/archived, not active.
3. In-flight work under old IDs: once the sync removes them, runs that were queued or mid-stage under an old ID cannot execute against the new code and will fail or be cancelled (stage functions are one `step.run`, so no partial stage is replayed). The DB row is left `in_progress` with an aging heartbeat, so it shows as Stalled after 3–5 min and is recovered with Restart Stage / Retry Campaign. Events sent after the sync route to the new IDs. `gtm/campaign.qualify_contacts` has no consumer anymore (Stage 5.5 runs inside `write_emails`); events with that name are accepted and dropped. Do the sync when no pipeline is running if possible.

### Company-database providers (Stage 4)
`GTM_DISCOVERY_MODE=database|legacy` (default `legacy`) picks Stage 4. `database` runs `inngest/functions/find-companies-database.ts`: one provider search built from the segment's `targetKeywords`/headcount band plus the campaign's `targetCountryCode`/`targetRegion`, with no Firecrawl and no LLM fallback. Short results are stored as-is and explained in `gtmOutreachCampaign.discoveryNote`. Vendors sit behind `src/lib/providers/` (normalized types, `registry.ts` chosen by `GTM_COMPANY_PROVIDER`, Apollo adapter). Every credit-consuming call is checked against the `gtm_vendor_usage` ledger first (`APOLLO_MONTHLY_CREDIT_CAP`, default 60) and throws `VendorCreditCapError` without a network call when over. `GTM_PROVIDER_MODE=fixture` serves the sanitized recordings in `src/lib/providers/fixtures/` and makes zero network calls, so use it for development. `GTM_MAX_COMPANIES_PER_RUN` defaults to 15 and is capped at 25. On the Apollo Free plan only `organizations/search` works; `mixed_companies/search` returns 403.

In database mode Stage 4 also writes a one-call LLM Fit line per company (`gtm-company-fit.ts`), then parks the campaign at `currentStage = status = "awaiting_company_selection"`. Because the status is not `in_progress`, the runner stops, nothing can claim it, and staleness never flags it; Restart Stage answers with a message instead of resetting. `POST /api/gtm/campaigns/[id]/confirm-selection` passes the gate with one SQL statement (`lib/pipeline/company-selection.ts`) that advances the campaign and writes every company's `selectionStatus` only if it is still at the gate, so repeats are 200 no-ops; then it calls `dispatchCampaign`. Database-mode Stage 5 (`find-contacts-database.ts`) searches only `selected` companies through `PeopleDiscoveryProvider` (`GTM_PEOPLE_PROVIDER`), stores people with `emailStatus = "not_looked_up"`, marks companies `found` / `no_decision_maker_found`, and stops at `done_for_now` because email lookup does not exist yet. The only people provider is the synthetic `fixture` one, refused outside fixture mode (`people_provider_unavailable`): the Apollo Free plan returns 403 for people search. `getCampaignDetail` strips vendor identifiers (`source`, `providerId`, `providerPersonId`) before data reaches the browser. Verify with `scripts/test-company-selection.ts`; the legacy baseline is `scripts/report-legacy-baseline.ts` (read-only).

### Mailboxes (multi-provider)
`gtmConnectedMailbox.provider` is one of `gmail`, `microsoft` or `imap_smtp`. Outbound mail goes through `sendEmailThroughMailbox` in `src/lib/mailbox-dispatcher.ts`, which dispatches to `gmail.ts`, `microsoft.ts` (Graph) or `imap-smtp.ts` (nodemailer/imapflow). Shared types are in `mailbox-types.ts`. Microsoft is gated behind `MICROSOFT_MAILBOX_ENABLED`. Credentials are encrypted with `src/lib/encryption.ts`. Bounce and suppression logic is in `gtm-bounce.ts` and `gtm-suppression.ts`.

### AI
LLM calls use the Vercel AI SDK with Groq (`@ai-sdk/groq`). GTM prompts and helpers are in `src/lib/gtm-ai.ts`. Usage is metered per org through `gtm-ai-credits.ts` (`gtmAiCreditPeriod` / `gtmAiCreditTransaction`). Web research uses Firecrawl (`firecrawl.ts`, spend tracking in `firecrawl-spend.ts`). The dashboard chat agent's tools are in `src/lib/chat/agent-tools.ts`.

### Server data → client components
- Read queries live in `src/lib/data/*.ts` (`server-only`). The API GET route and the async server component that renders a page section both call the same function, so the first paint and later client polling share one query.
- An async server component (e.g. `components/gtm/campaigns-list.tsx`, `components/mailbox/mailbox.tsx`) fetches and passes `asJson<T>(data)` (`lib/data/serialize.ts`) as `initial*` props to a `*-client.tsx` component, which only polls/refetches for live updates.
- Server-rendered client components must render identically on server and during hydration: anything using the clock, locale or timezone (`checkStageStaleness`, `toLocaleDateString`, relative times) goes through `useHydrated()` (`src/hooks/use-hydrated.ts`) or `<LocalDate>` (`components/ui/local-date.tsx`).
- Larger client views follow the components.build compound pattern: a `*Root` context provider owns state/actions and small parts read it via a hook (see `components/gtm/campaign-detail/`). Server components compose those parts by named import — they cannot dot into a client module (`X.Root`).

### UI
Next.js App Router with Tailwind 4 and shadcn-style primitives in `src/components/ui` (config in `components.json`); `cn` is imported from `@/lib/utils`. Design conventions are documented in `docs/design-system.md`.
