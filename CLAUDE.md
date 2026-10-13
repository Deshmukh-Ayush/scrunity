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
- `src/proxy.ts` (Next 16's replacement for middleware) runs on `/sign-in`, `/onboarding`, `/dashboard/*`, `/api/billing/*` and `/api/gtm/*`. It resolves the Better Auth session, strips client-supplied identity headers, then injects `x-user-id`, `x-user-name`, `x-user-email`, `x-user-image`, `x-org-id` and `x-org-role`. Users with no org membership are redirected to `/onboarding`.
- On localhost only, `?test_org=<orgId>` (or a `test_org` cookie) bypasses auth and impersonates a member of that org. Use it for local UI and API testing.
- Server code reads identity through `getTenantContext()` (`src/lib/tenant-context.ts`, wrapped in `React.cache`). Its fast path trusts the proxy headers and falls back to a full session lookup. Other per-request cached helpers live in `src/utils/cached-*.ts`. Every query must be scoped to `organizationId`.
- Auth is Better Auth with the organizations plugin (`src/lib/auth.ts`, `src/lib/auth-client.ts`).

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

`src/inngest/client.ts` auto-detects dev mode (local URL → Inngest dev server at `127.0.0.1:8288`, no keys). Realtime progress channels are `gtm:run:<id>` and `gtm:campaign:<id>`. Publish to them with `safeRealtimePublish` from `functions/shared.ts`.

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
