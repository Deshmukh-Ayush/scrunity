# Vedant's changes: Firecrawl people data (PR #2)

Read-only review, 2026-10-21. Line numbers refer to the PR head `d12494f`. Nothing was merged, checked out or committed.

## 1. Branches and which one is his

- `origin` has no branch from Vedant. Every branch on `origin` is Ayush's, and the only one not merged into `main` is `archive/full-platform-pre-gtm-pivot`.
- His work is **GitHub pull request #2** (`refs/pull/2/head`, probably opened from a fork; the head branch name can't be seen without `gh`). I fetched it read-only as `origin/pr/2`. Author: `vedant ghodki`. 8 commits, all on 2026-10-16 between 21:59 and 22:19:
  - `10ad8c0` refactor(llm): LlmProvider interface with the Groq implementation behind it
  - `aa043b5` feat(vendors): typed Firecrawl data client, people search, work email, credit caps
  - `f364709` feat(pipeline): people search fills Find companies; batched work emails in Stage 5
  - `2354fd4` feat(ui): plain copy and testing-route fixtures for the new search states
  - `86bacaf` chore(env): Firecrawl data vars; Apollo and FullEnrich marked legacy-only; drop unused enrich.so client
  - `a566655` docs(claude): Firecrawl people data, npm test, LLM provider seam
  - `302a30a` fix(firecrawl): time budgets that fit one Inngest step; timeouts count as possibly billed
  - `d12494f` fix(email): create the Resend client per send, not at import
- Base: merge base is `4c47c77` (the current `origin/main`, "Merge redesign"), so the PR is on the latest `main`. Local `redesign` is already contained in `main`, so the commit list is the same against both.
- Conflicts: `git merge-tree` reports a **clean merge** into both `origin/main` and `redesign`.
- PR #1 is the old PostHog branch (Ayush, August), not related.

## 2. What changed (51 files, +3165 / -331)

- **Providers/integrations (most of the PR):** new `src/lib/vendors/firecrawl/` (client, people-search, work-email, discovery, email-batch, credits, errors, runtime, offline fixtures) and thin wrappers `providers/firecrawl-people.ts`, `firecrawl-email.ts`, `stored-people.ts`. `registry.ts` and `config.ts` gain a `PEOPLE_DATA_PROVIDER=firecrawl|legacy` switch, defaulting to **firecrawl**. `src/lib/enrich.ts` (enrich.so) is deleted.
- **Pipeline:** Stage 4 (`find-companies-database.ts`) now runs a *people* search and groups the people by company, storing them on each company. Stage 5 (`verified-lead-search.ts`) reuses those stored people and looks up work emails in batches of up to 10 (`pipeline/email-lookup-batch.ts`). New `pipeline/known-people.ts` (skip people the org already has) and `lead-search-executor.ts` (the in-process loop, moved out unchanged).
- **LLM:** new `lib/llm/provider.ts` (`LlmProvider`) and `lib/llm/groq.ts`. The Groq logic moved out of `gtm-ai.ts` unchanged. New `gtm-people-search.ts` turns a segment into job titles, seniority and industries.
- **DB/schema:** TypeScript types only (`CompanySearchFilters.titles/seniority/locations`, `LeadSearchCompanyState.prefetched`, two `any` changed to `unknown`). **No migration.**
- **Ledger:** `vendor-usage.ts` adds an optional per-campaign cap to the atomic reservation, plus an endpoint filter.
- **UI:** four new failure messages (`campaign-process.ts`) and a playground entry "search stopped". `public-fields.ts` maps the new codes to neutral ones.
- **Tests/tooling:** `npm test` = `tsx --test "src/**/*.test.ts"` (node:test). 7 new offline test files, synthetic fixtures (`.example` domains, invented names).
- **Docs/config:** CLAUDE.md gets a "People data" section. `.env.example` reorganised (see Q8). `lib/email.ts` creates the Resend client per send.

## 3. Answers

**Q1. Providers.** Apollo: kept, but only when `PEOPLE_DATA_PROVIDER=legacy` (`registry.ts:23-28`, `config.ts:29-36`). FullEnrich direct: kept, legacy only. enrich.so: removed. Firecrawl web search/scrape: kept for research and the legacy path. **Firecrawl data API ("Alexandria") is new, and it resells FullEnrich**: every data call is sent with `provider: "fullenrich"` (`vendors/firecrawl/client.ts:40-44`, `people-search.ts:72-74`, `work-email.ts:47-55`). In practice FullEnrich is still the data source, now billed through Firecrawl. Groq: kept, now behind `LlmProvider` (`llm/provider.ts:137`, Groq is the only implementation).

**Q2. Calls and keys.** All data calls are `POST https://api.firecrawl.dev/v2/scrape` with an `alexandria` body, 1-10 calls per request, through the shared limiter (`client.ts:163-212`). The key is the **global env var `FIRECRAWL_API_KEY`**, read only in `getFirecrawlApiKey()` (`client.ts:32-38`). `firecrawl.ts` now uses that function too. Apollo and FullEnrich keys are global env vars as well. **There is no per-org or per-user provider key storage.** The only encrypted per-org credentials are mailbox tokens and passwords (`gtm_connected_mailbox`, `schema.ts:939-967`, AES-256-GCM in `lib/encryption.ts`). That key falls back to `BETTER_AUTH_SECRET` when `ENCRYPTION_KEY` is unset (`encryption.ts:8-10`).

**Q3. What is stored.** For each company (`gtm_prospect_company`): name, domain, LinkedIn, industry, headcount and location, plus `source = "firecrawl"` and `providerId` (`find-companies-database.ts:240-250`). The people found are stored as JSON in `lead_search_state.prefetched` (normalized: provider person id, name, title, LinkedIn, location, source). For each contact (`gtm_contact`): name, title, LinkedIn, `source`, `providerPersonId` (`verified-lead-search.ts:230-234`). The email is saved only if it is verified, along with `enrichMetadata` (vendorStatus, credits, note) (`email-lookup.ts:94-116`). No raw response JSON is stored. The source is recorded per company and per lead, but as `"firecrawl"`, not the upstream FullEnrich. **Deleting one provider's data for one customer** is possible by joining contact → company → campaign → research run → `organizationId` where `source='firecrawl'`. Copies also live in drafts (they cascade from contact), `lead_search_state` JSON, `gtm_do_not_contact` (org-scoped email) and the platform-wide suppression list. There is no helper for this today.

**Q4. Credits and caps.** New ledger vendor `firecrawl_data`. Credits are reserved at the worst-case cost before each request and settled with the returned `creditsCost` (`credits.ts:46-62`, `runtime.ts:39-47`). Caps:
- `FIRECRAWL_MONTHLY_CREDIT_CAP` (3000) is **platform-wide, not per org**. The SQL filters on vendor and month only (`vendor-usage.ts:69-100`).
- `FIRECRAWL_RUN_CREDIT_CAP` (1200 per campaign) is shared by the people search and the emails.
- `GTM_PEOPLE_SEARCH_CANDIDATE_CAP` (150 people, 5 credits each).
- Prices are hard-coded: 5 credits per person record, 20 credits per email found (`people-search.ts:27`, `work-email.ts:28`).
- Existing per-org limits (`org-quota.ts`, the Firecrawl org-daily call cap) are unchanged.
- **The whole design assumes Scrunity pays.** It uses one company key and one shared monthly pool. The customer-facing copy says "Contact support to add credits" (`campaign-process.ts`, `data_credits_used_up`).

**Q5. Flow end to end.**
1. Research run (Groq) produces segments.
2. Stage 4: one Groq call turns the segment into titles, seniority and industries, validated with zod and retried once, else `search_filters_invalid` (`gtm-people-search.ts:965-1001` in the diff; `find-companies-database.ts:158`). Location and size come from the campaign and segment.
3. Firecrawl people search, 5 pages of 6 per request, until 150 people, 15 companies or 90 s. Results are deduped (within the run and against the org's existing contacts), people with no readable company domain are dropped, and the rest are grouped by company (`discovery.ts:118-156`).
4. Groq fit scoring and the selection gate (unchanged).
5. Stage 5: the stored people are queued, and one batch of up to 10 work-email lookups is sent per step, best fit first. An email counts as verified **only** with an explicit `DELIVERABLE` status at the company's own domain (`work-email.ts:97-122`).
6. Stage 5.5 gates and Groq drafts (unchanged). Stage 5 still makes a `deriveTargetJobFunction` Groq call (`verified-lead-search.ts:124`) that may be redundant here (not verified).

Gaps he documented himself:
- Firecrawl does not document the fields inside `employment`, `social_profiles`, `location` and `contact_info`, so they are parsed by guessing several key names (`people-search.ts:19-23`, `work-email.ts:18-23`).
- If there is no status field, *every* email stays unverified, so **yield could be zero in production**. Nothing here was run against a live response.
- `storedPeopleProvider` returns nobody for any company without stored people.
- The legacy path (`people-web.ts`, Apollo, FullEnrich, `fixture-people.ts`) is dead code by default, "kept for one release".

**Q6. Schema/migrations.** No new migration. `drizzle/` stops at `0030_large_prima.sql`, and the PR touches nothing there. The schema changes are TypeScript types on existing `jsonb` columns, so there is **no conflict with `0030`**.

**Q7. Auth, admin, billing, sending.** Not touched: proxy, `PLATFORM_ADMIN_EMAILS`, billing, `send-eligibility`, mailboxes. Only `lib/email.ts` changed (team invitation email via Resend), where the client is now created per send.

**Q8. Dependencies, env, scripts, docs.** No new dependencies; `package-lock.json` is unchanged. One new script: `"test"`.
- New env vars: `PEOPLE_DATA_PROVIDER`, `FIRECRAWL_MONTHLY_CREDIT_CAP`, `FIRECRAWL_RUN_CREDIT_CAP`, `GTM_PEOPLE_SEARCH_CANDIDATE_CAP`.
- Removed from `.env.example`: `ENRICH_API_KEY`.
- Moved to "legacy only": `APOLLO_API_KEY`, `APOLLO_MONTHLY_CREDIT_CAP`, `GTM_DISCOVERY_MODE`, `GTM_COMPANY_PROVIDER`, `GTM_PEOPLE_PROVIDER`, `GTM_DECISION_MAKERS_PER_COMPANY`, `FULLENRICH_API_KEY`, `FULLENRICH_MONTHLY_CREDIT_CAP`, `GTM_EMAIL_LOOKUP_MAX_WAIT_SECONDS`.
- Docs: CLAUDE.md "People data" section plus the `npm test` rule. The older "Verified-lead search (Stage 5)" paragraph still describes FullEnrich-only behaviour, so it is now stale.

**Q9. Risks.**
- **Secrets:** a scan of the added lines found no keys, tokens or database URLs. The key is never logged, and `requiresActionUrl` stays server-side.
- **Vendor calls on page load:** none; the only UI changes are copy and playground entries.
- **Step duration:** a single data request can take up to 120 s, or 180 s with retries (`client.ts:26-27`). Stage 4 checks its 90 s budget only *between* requests (`discovery.ts:36,140-141`), and the Groq fit scoring runs after that. In the worst case, Stage 4 can therefore approach the 300 s `maxDuration`. A Stage 5 batch step can take up to 180 s, against the CLAUDE.md rule of "aim under 60 s" for steps.
- **Concurrency:** the batch size raises it to `max(GTM_LEAD_SEARCH_CONCURRENCY, 10)`, past the documented maximum of 5 (`lead-search-budget.ts`).
- **Unbounded query:** `loadKnownPersonKeys` loads every contact the org has ever had on each Stage 4 run (`known-people.ts`).
- **Legal/terms:** Firecrawl returns `THIRD_PARTY_DATA_TERMS_REQUIRED` until an admin accepts the data provider's terms. CLAUDE.md already notes that FullEnrich's standard terms forbid passing enriched data to third parties without a separate agreement, and reselling through Firecrawl may not change that. Not verified.
- **PII in logs:** email batch log lines print each person's name, domain and status (`email-lookup-batch.ts`).

## 4. What BYOK (per-customer Apollo) would need: findings, not a plan

- **Credential storage:** nothing exists. It needs a per-org table like `gtm_connected_mailbox` (provider, encrypted key or OAuth tokens, status, connectedBy) and probably a dedicated `ENCRYPTION_KEY` instead of the `BETTER_AUTH_SECRET` fallback. Affected: `db/schema.ts`, a new migration, `lib/encryption.ts`, a new settings UI and API under `/api/gtm/*` (owner/admin in `lib/api-role-policy.ts`).
- **Key resolution:** keys are read from env at module level (`registry.ts` `keyEnv`, `provider-check.ts`, `vendors/firecrawl/client.ts:32`, `providers/apollo.ts`). Providers must instead receive the key from `VendorSpendContext`/org (the `FirecrawlClientDeps.apiKey` seam already exists for Firecrawl). `checkCampaignProviders()` must check the org's connection, not `process.env`.
- **Which path:** the PR makes Firecrawl/FullEnrich the default and Apollo legacy-only, which is the opposite of an Apollo-first BYOK model. Apollo people search is also blocked on the Free plan (403), so customer plan tiers matter.
- **Caps and credits:** the monthly cap is platform-wide (`vendor-usage.ts:69-100`). With BYOK it must be per org (or removed, with the vendor's own 402/429 handled instead). "Contact support to add credits" copy must change to "check your connected account". The `public-fields.ts` and `campaign-process.ts` codes need a "reconnect / key invalid" case (401/403 is currently `provider_access_denied` → `email_provider_unavailable`).
- **Source tag:** a `source` column exists on companies and contacts, but it is the gateway name (`firecrawl`), not the data owner. BYOK needs an exact per-lead origin (provider plus connection id) so data can be removed on disconnect.
- **Deletion on disconnect:** there is no code for it. It must cover contacts, drafts (cascade), `lead_search_state.prefetched` JSON, `searchFilters`, and decide what happens to `gtm_do_not_contact` and suppression rows.
- **Rate limits:** the Firecrawl limiter is process-wide (`firecrawl-limiter.ts`) and assumes one account. Per-customer keys need per-key limiters.

## 5. Unknowns and what was not verified

- **Verified:** `npm run typecheck` **passes** on the PR head (run in a temporary worktree outside the repo, since removed; the working tree was untouched).
- **Not verified:** `npm test`, the scripts, `npm run build`, any live Firecrawl/FullEnrich response, Inngest step durations, real verified-email yield, Firecrawl/FullEnrich terms for resale.
- **Not verified:** whether Vedant has more unpushed work on his laptop. Only PR #2 is visible on GitHub.
- The PR's head branch name and description are unknown (no `gh` CLI here).
