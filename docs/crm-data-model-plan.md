# CRM data-model plan (read-only proposal)

Status: proposal, nothing built. Written 2026-10-14 against `main` at `f90a258`.
Evidence: file:line references into the repo, and read-only queries against the database in `DATABASE_URL`
(run from a scratch script outside the repo; queries quoted inline). "Not verified" marks anything not checked.

---

## Step A: what exists today

### A1. Tables that hold CRM-like data

Row counts are exact `count(*)` on 2026-10-14. "Org scope" is how a row is tied to an organization.

| Table (schema line) | Purpose | Key columns | Rows | Org scope | Written by | Read by (main) |
|---|---|---|---|---|---|---|
| `gtm_research_run` (`schema.ts:295`) | Customer's own company research (stages 1-3) | `organization_id`, `website_url`, `company_name`, `status`, `current_stage`, `firecrawl_*_count` | 24 | **direct** `organization_id` (indexed `gtm_research_run_org_idx`) | `api/gtm/research-runs/*`, `inngest/functions/research-company.ts`, `explore-competitors.ts`, `define-segments.ts`, `lib/chat/agent-tools.ts` | `lib/data/research-runs.ts`, `lib/gtm-auth.ts:92` |
| `gtm_competitor` (`:361`) | Competitors of the customer | `research_run_id`, name, description | 127 | via run | `explore-competitors.ts` | research-run detail |
| `gtm_icp_segment` (`:380`) | ICP segments | `research_run_id`, `name`, `pain_point`, `criteria`, `target_keywords` | 59 | via run | `define-segments.ts` | campaigns, digests |
| `gtm_outreach_campaign` (`:406`) | One outreach run for a segment | `icp_segment_id`, `research_run_id`, `status`, `current_stage`, `target_country_code` | 8 | via run | `api/gtm/campaigns/*`, all campaign stages | `lib/data/campaigns.ts:21` |
| `gtm_prospect_company` (`:454`) | Companies found by Stage 4 | `outreach_campaign_id`, `name`, `domain`, `source`, `provider_id`, `selection_status`, `fit_note` | 36 | via campaign → run | `find-companies.ts`, `find-companies-database.ts`, `find-contacts-database.ts`, `rerun/route.ts` (delete) | `lib/data/campaigns.ts:57`, leads views |
| `gtm_company_metric_snapshot` (`:574`) | LinkedIn size/followers per company | `prospect_company_id` | 1 | via company | Stage 4 | campaign detail |
| `gtm_contact` (`:592`) | People found by Stage 5 | `prospect_company_id`, `name`, `title`, `email`, `email_source`, `verification_status`, `linkedin_url`, `enrich_metadata`, `lookup_status`, `email_status` | 242 | via company → campaign → run | `find-contacts.ts`, `find-contacts-database.ts` | `api/gtm/leads`, `components/leads/leads-section.tsx`, campaign detail |
| `gtm_email_draft` (`:695`) | Draft / sent email per contact; also the **disqualification marker** | `contact_id`, `outreach_campaign_id`, `status` (draft/approved/rejected/sent/failed), `thread_id`, `provider_message_id`, `sent_at`, `error_message` | 238 | via campaign | `write-emails.ts`, `gtm-stage-5-5.ts`, `send-emails.ts`, reply polling, 4 API routes | mailbox, leads, campaign detail |
| `gtm_email_event` (`:789`) | Replies and bounces | `email_draft_id`, `type` (replied/bounced/...), `classified_intent`, `occurred_at` | 1 | via draft | `reply-polling/process-reply.ts`, `record-bounce.ts` | `lib/data/mailbox.ts:160` |
| `gtm_meeting` (`:827`) | Booked meetings (Cal.com webhook) | `contact_id`, `outreach_campaign_id`, `scheduled_at`, `status`, `calcom_booking_uid`, `attendee_email` | 0 | via contact | `api/webhooks/calcom/route.ts:214` | leads status, digests |
| `gtm_suppression_entry` (`:656`) | **Platform-wide** do-not-use cache | `email`, `domain`, `reason`, `source_org_id`, `is_real_send_bounce` | 3 (1 hard_bounce, 2 invalid_contact_name) | none (shared by design) | `lib/gtm-suppression.ts` | Stage 4/5/5.5, admin inspection route |
| `gtm_connected_mailbox` (`:757`) | One sending mailbox per org | `organization_id`, `provider`, `email`, encrypted tokens, `daily_send_count` | 1 | direct | mailbox routes, `send-emails.ts` | mailbox UI |
| `gtm_segment_digest` (`:878`) | Per-segment learning summary | `organization_id`, `icp_segment_id`, `metrics` | 1 | direct | `lib/gtm-digest.ts` | digests route |
| `gtm_conversation` / `gtm_message` (`:1129`, `:1163`) | Agent chat threads | `organization_id`, `outreach_campaign_id`, `research_run_id` | 12 / 18 | direct | chat routes, `gtm-campaign-conversation.ts` | `lib/data/chat.ts` |
| `gtm_ai_credit_period` / `gtm_ai_credit_transaction` (`:908`, `:942`) | Customer credit balance and ledger | `organization_id`, `credits_remaining`; tx `type`, `amount`, `idempotency_key` | 1 / 10 | direct | `lib/gtm-ai-credits.ts` | billing UI, send/restart gates |
| `organization_credit_period`, `usage_event` (`:152`, `:181`) | Internal vendor-spend meter | allotted/used counters; usage events | 2 / 443 | direct | `lib/ai/credits.ts`, `lib/firecrawl-spend.ts` | not customer-facing |
| `gtm_vendor_usage` (`:500`) | Paid data-vendor ledger | `vendor`, `credits_used`, `organization_id` | 4 (vendor=apollo, 4 credits) | direct | `lib/providers/vendor-usage.ts` | credit cap checks |

Key structural fact: **companies, contacts, drafts, events and meetings have no `organization_id`**. Every
tenant check joins 3-4 tables (contact → company → campaign → run), e.g. `lib/gtm-auth.ts:139-166`,
`api/gtm/leads/[id]/send/route.ts:33-58`. There is also **no index on `gtm_contact.email` or
`gtm_prospect_company.domain`** (indexes listed by `pg_indexes`: contact only `(prospect_company_id)`,
company only `(outreach_campaign_id)`).

### A2. Record flow today (discovery → meeting)

1. `gtm_research_run` (+ `gtm_competitor`, `gtm_icp_segment`) — stages 1-3.
2. `gtm_outreach_campaign` created per segment (`api/gtm/campaigns/route.ts`).
3. Stage 4 writes `gtm_prospect_company` (+ snapshots). Database mode parks at `awaiting_company_selection`;
   `selection_status` marks `selected`/`excluded`.
4. Stage 5 writes `gtm_contact` per company (legacy: `find-contacts.ts`; database: `find-contacts-database.ts`).
5. Stage 5.5 (`gtm-stage-5-5.ts:97`) disqualifies by inserting/updating a **`rejected` `gtm_email_draft`**
   with `error_message` — there is no status on the contact itself.
6. Stage 6 writes `draft` drafts; the user approves (`api/gtm/campaigns/[id]/drafts/*`).
7. Stage 7 (`send-emails.ts`) sends `approved` drafts, sets `sent_at`/`thread_id`, debits 1 credit
   (`send-emails.ts:307`).
8. Stage 8 polling writes `gtm_email_event` (replied/bounced), hard bounces into `gtm_suppression_entry`
   (`record-bounce.ts`), negotiation replies as new drafts.
9. A Cal.com booking webhook inserts `gtm_meeting` (`api/webhooks/calcom/route.ts:214`).

### A3. CRM record vs pipeline scratch data

Contact outcome (latest draft per contact, query: `left join lateral (... order by created_at desc limit 1)`):
`rejected` 232, `sent` 5, `failed` (bounced) 1, no draft 4. So **only 10 of 242 contacts are not disqualified**.

| Data | Verdict |
|---|---|
| Contacts with a `sent`/`failed` draft, events, meetings | Real CRM history (activity) |
| Contacts with no draft and valid name + verified email | Promotable person records |
| Contacts with a `rejected` draft (232) | Scratch. Reasons: invalid name 190, aggregator job-board domain 34, retry-storm duplicate 5, low email confidence 3 |
| `lookup_incomplete` contacts | Scratch until a lookup completes (0 today) |
| `excluded` companies (0 today), companies with no selected contacts | Scratch / campaign-only |
| Drafts in `draft`/`approved` | Campaign working data, not a timeline item until sent |

### A4. Data-quality facts (counts)

| Fact | Count | Query / evidence |
|---|---|---|
| Orgs with pipeline data | 3 (12, 6, 6 research runs); only 1 org has campaigns (8) | `group by organization_id` on runs |
| Companies | 36, 35 distinct domains; `ziprecruiter.com` twice in campaign `jV9WFjiOMSbXeQ7pw60JI` | `having count(*)>1` |
| Companies by source | 36 `web_search` (legacy); 0 from the company database | `group by source` |
| Contacts without email | 0 of 242 | `email is null or ''` |
| Contacts without LinkedIn | 188 of 242 | `linkedin_url is null` |
| **Contact names that are not people** | **193 of 242** by the app's own `isValidPersonName` (`lib/gtm-contact-matcher.ts`) | tsx script over all rows |
| Same email more than once in an org | **18 addresses cover 220 rows**; top: one `@indeed.com` address 32×, `@revenuebase.ai` 30×, `@growthtalent.org` 29× (all one campaign) | `group by lower(email) having count(*)>1` |
| Generic addresses (`contact@`, `info@` …) | 31 of 242 | regex on local part |
| Plausible real people (valid name, non-generic email) | 49 rows, **19 distinct emails**, all with LinkedIn | tsx script |
| Email source | 149 `pattern_guessed_mx_valid`, 61 `enrich_verified`, 22 `pattern_guessed_unverified`, 10 `company_fallback` | `group by email_source` |
| Contacts carrying vendor metadata (`enrich_metadata`) | 61 (provider + platform `creditsRemaining`) | `enrich_metadata ? 'provider'` |
| Orphans | 2 suppression rows point at deleted contacts; 0 dead conversation links, 0 runs without org, 0 orgs without members | orphan query |
| Events / meetings | 1 event (bounced), 0 meetings, 6 drafts with `sent_at` | counts |

Implication: the existing contact data is mostly junk from one legacy campaign. A migration should
**promote selectively** (≈19 people, ≈35 companies) rather than copy every row.

---

## Step B: the plan

### B1. Target model

All tables carry `organization_id text not null` (FK → organization, cascade) and are indexed on it first.
Primary keys: `text` nanoid, same as today. Soft-delete via `archived_at timestamp null` (archived rows hidden by
default, restorable; hard delete only for GDPR erasure).

| Table | Key columns | Uniqueness |
|---|---|---|
| `crm_company` | `name`, `domain` (normalized, lowercased, no `www.`), `website`, `industry`, `headcount`, `city/state/country`, `linkedin_url`, `description`, `owner_user_id`, `created_by`, `archived_at`, `created_at`, `updated_at` | unique `(organization_id, domain)` where `domain is not null and archived_at is null` (partial index) |
| `crm_person` | `full_name`, `first_name`, `last_name`, `title`, `email` (lowercased), `phone`, `linkedin_url`, `company_id` (FK crm_company, set null), `contact_status` (`active`/`do_not_contact`/`bounced`), `owner_user_id`, `archived_at` | unique `(organization_id, email)` where `email is not null and archived_at is null`; secondary match key `(organization_id, linkedin_url)` |
| `crm_deal` | `name`, `company_id`, `primary_person_id`, `stage_id`, `value_amount numeric(14,2)`, `currency`, `owner_user_id`, `expected_close_date`, `closed_at`, `won bool null`, `source_meeting_id` | unique `(organization_id, source_meeting_id)` (auto-create idempotency) |
| `crm_deal_stage` | `name`, `position`, `kind` (`open`/`won`/`lost`) | unique `(organization_id, position)` |
| `crm_note` | `record_type` (`company`/`person`/`deal`), `record_id`, `body`, `author_user_id` | — |
| `crm_task` | `record_type`, `record_id`, `title`, `due_at`, `assignee_user_id`, `completed_at` | — |
| `crm_activity` | see B4 | unique `(organization_id, source_table, source_id)` |
| `crm_list` / `crm_list_member` | list = campaign or manual list; member `(list_id, record_type, record_id)` | unique `(list_id, record_type, record_id)` |
| `crm_saved_view` | `record_type`, `name`, `filters jsonb`, `sorts jsonb`, `columns jsonb`, `owner_user_id`, `shared bool` | unique `(organization_id, owner_user_id, record_type, name)` |
| `crm_field_provenance` | `record_type`, `record_id`, `field`, `source_kind`, `verified`, `observed_at`, `source_run_id`, `source_campaign_id` | unique `(record_type, record_id, field)` |

Polymorphic `record_type/record_id` keeps notes/tasks/activities to one table each; integrity is enforced in the
data layer (the HTTP driver cannot do cross-table triggers transactionally anyway). Every data function filters
`organization_id` on the polymorphic table itself, so no join is needed for tenant scoping.

### B2. Relationship to the pipeline tables

**Recommended: (a) promote qualified pipeline rows into CRM records; keep pipeline tables as working data**,
with a back-link.

- Add `crm_person_id` to `gtm_contact` and `crm_company_id` to `gtm_prospect_company` (nullable). Promotion =
  upsert into `crm_*` by the uniqueness key, then set the back-link. Promotion points: a contact passes Stage 5.5
  (or is approved/sent), a company is `selected` and has ≥1 promoted person.
- **Campaign as a list:** each campaign gets a `crm_list` (`kind='campaign'`, `outreach_campaign_id`); promoted
  people/companies become members. The list survives a campaign re-run (members are CRM ids, not pipeline ids).
- **Provenance back to the run:** `crm_field_provenance.source_run_id/source_campaign_id`, plus the list membership.

Rejected alternatives:
- **(b) CRM tables as the single source of truth, pipeline writes directly.** Today 232 of 242 contacts are
  disqualified junk (A3); writing them into the CRM would flood customers' records, and Stage 4/5 retries,
  re-runs (`rerun/route.ts:68-75` deletes companies/drafts) and the retry storm (18 emails → 220 rows) would
  hit CRM uniqueness constraints mid-stage. It also couples every pipeline change to CRM migrations.
- **(c) A view-only CRM over pipeline tables (no new tables).** Cheapest, but there is no org column to index,
  no place for user-created records, notes, owners or merges, and re-runs delete the underlying rows.

### B3. Provenance and trust

`crm_field_provenance.source_kind` ∈ `discovered` (company database / web), `user_entered`, `ai_inferred`,
`imported`; `verified bool`. Mapping from today's data:
`email_source = enrich_verified | pattern_guessed_mx_valid` → `discovered`, verified true / false (MX-valid is
still a guess, show "unverified"); `company_fallback`, `pattern_guessed_unverified` → never promoted as a person
email; `fit_note` and AI drafts → `ai_inferred` ("AI estimate (unverified)"). Vendor identity stays server-side:
keep `source`/`providerId`/`enrich_metadata` only on pipeline tables; never copy them into `crm_*` or any API
response (note: today `enrich_metadata` *is* returned to the browser — see the security audit, finding M-4).

### B4. Activity timeline

Options:
1. **Read model (UNION view/query) over `gtm_email_draft` (sent), `gtm_email_event`, `gtm_meeting`, stage
   changes.** No backfill, always consistent, but every timeline read joins 4-5 tables through the
   contact→company→campaign→run chain with no org column; sorting a feed across 10k+ records means sorting a
   union with no single index. Not verified at scale; current tables are tiny (238 drafts, 1 event).
2. **`crm_activity` table written as things happen** (`organization_id`, `record_type`, `record_id`, `kind`,
   `occurred_at`, `summary`, `source_table`, `source_id`, `actor_user_id`). One index
   `(organization_id, record_type, record_id, occurred_at desc)` serves the per-record timeline;
   `(organization_id, occurred_at desc)` serves a global feed. Cost: write in more places, backfill once.

**Recommend 2**, made idempotent with unique `(organization_id, source_table, source_id)` so writers can upsert
(`on conflict do nothing`) and a nightly reconciler can re-derive missing rows from the pipeline tables.
Writers: send (`send-emails.ts` after `sent_at`), reply/bounce (`process-reply.ts`, `record-bounce.ts`),
meeting (`calcom` webhook), stage changes (`advanceCampaign`), notes/tasks.

### B5. Deals

`crm_deal_stage` per organization, seeded on org creation with: Meeting booked, Qualified, Proposal, Won, Lost
(founder decision: names). Auto-create a deal when a `gtm_meeting` is inserted (calcom webhook) for a promoted
person, keyed by `source_meeting_id` (idempotent); manual creation from any company/person. Auto deals land in
stage 1 with no value; owner = campaign creator (founder decision).

### B6. Dedupe and merge

- Keys: person by lowercased email, then LinkedIn URL; company by normalized domain. Generic mailboxes
  (`contact@`, `info@`, … — 31 rows today) never create a person; they attach to the company.
- Pipeline promotion: upsert; never overwrite a `user_entered` field; fill empty fields only.
- CSV import: preview with "new / will update / duplicate in file / conflicts"; default "skip existing".
- Merge: keep the older id, move notes/tasks/activities/list memberships, record a `merged_into_id` on the loser
  (archived).
- **Do-not-contact follows the person:** `crm_person.contact_status` is set by an unsubscribe/decline reply
  (`process-reply.ts:262`), a hard bounce, or a user action, and is checked by drafting and sending. The
  platform-wide `gtm_suppression_entry` stays for hard bounces/aggregator domains; a per-org do-not-contact must
  not leak across tenants. Merges keep the most restrictive status.

### B7. Migration order (additive, each step reversible)

Protocol per step: edit `schema.ts` → `npm run db:generate` → review SQL → `npm run db:migrate`. Neon HTTP has no
interactive transactions, so backfills are idempotent scripts (`insert ... on conflict do nothing`, batched by id,
re-runnable), never one big transaction. Reversal = drop the new tables/columns (no existing column is altered).

1. `crm_company`, `crm_person` + partial unique indexes (empty). Revert: drop tables.
2. Nullable back-links `gtm_prospect_company.crm_company_id`, `gtm_contact.crm_person_id`. Revert: drop columns.
3. Backfill script (dry-run mode first, prints counts): promote companies with ≥1 non-rejected contact and
   contacts that pass `isValidPersonName` + non-generic email + not rejected (expected ≈19 people, ≤35
   companies from A4). Re-runnable.
4. `crm_list`/`crm_list_member`; backfill one list per campaign.
5. `crm_activity`; backfill from sent drafts (6), events (1), meetings (0). Then add live writers.
6. `crm_note`, `crm_task`, `crm_saved_view`, `crm_field_provenance`.
7. `crm_deal_stage` (seed per org), `crm_deal` + meeting auto-create.
8. Turn on promotion in the pipeline (behind an env flag, like `GTM_DISCOVERY_MODE`).

### B8. Indexes and query patterns

- Table views: `(organization_id, archived_at, <sort col>, id)` for the 2-3 default sorts (updated_at, name,
  created_at); keyset pagination on `(sort_value, id)` rather than OFFSET (the leads route uses OFFSET today,
  `api/gtm/leads/route.ts`).
- Search: `pg_trgm` GIN on `lower(name)`, `domain`, `email` (requires `create extension pg_trgm` — check Neon
  plan support, not verified). Prefix search can use btree `text_pattern_ops` instead.
- Measure before choosing: `EXPLAIN (ANALYZE, BUFFERS)` of the 5 main view queries on a seeded org with 10k
  people/5k companies/50k activities; p95 of the route via `scripts/time-*.ts` (pattern from
  `scripts/time-leads-route.ts`).

### B9. Data-layer boundaries

New `src/lib/data/crm-companies.ts`, `crm-people.ts`, `crm-deals.ts`, `crm-activity.ts`, `crm-views.ts`
(`server-only`), each function taking `organizationId` as the first argument and filtering on it in the same
query. Pages stay structural (`AGENTS.md` rules 2-3); async server components call these functions and pass
`asJson` data to `*-client.tsx` (CLAUDE.md "Server data → client components"); API GET routes reuse the same
functions. First 10 functions:

1. `listCompanies(orgId, {filters, sort, cursor, limit})`
2. `listPeople(orgId, {filters, sort, cursor, limit})`
3. `getCompany(orgId, companyId)` (with people count, open deals)
4. `getPerson(orgId, personId)`
5. `getRecordTimeline(orgId, recordType, recordId, cursor)`
6. `listDeals(orgId, {stageId?, ownerId?})` / `getDealPipeline(orgId)`
7. `searchRecords(orgId, query, limit)`
8. `listNotesAndTasks(orgId, recordType, recordId)`
9. `listSavedViews(orgId, userId, recordType)`
10. `listCampaignList(orgId, campaignId, cursor)`

### B10. Risks, open questions, build sequence

Risks: (1) junk data promoted into customer CRMs — mitigated by the strict promotion gate; (2) two sources of
truth drifting — mitigated by back-links + reconciler; (3) polymorphic tables without FKs — enforce in the data
layer, add a periodic orphan check; (4) every new query must filter `organization_id` — add a review checklist
and a cross-tenant test script per route (see the audit).

Founder decisions: deal stage names and auto-deal owner; whether do-not-contact is per org only or also
platform-wide for explicit unsubscribes; whether promoted records count against credits; CSV import limits.

Build sequence (each independently shippable, with its proof):

| # | Step | Evidence it works |
|---|---|---|
| 1 | Tables 1-2 + backfill (dry-run, then real) | counts match the dry-run; re-run inserts 0 |
| 2 | People & Companies table views (read-only) | route timing script; cross-tenant test returns 403/empty |
| 3 | Record page + timeline backfill | timeline shows the 6 sends/1 bounce for the right people |
| 4 | Notes & tasks | create/edit/delete as owner; other org gets 404 |
| 5 | Pipeline promotion (flagged) | a fixture-mode campaign creates exactly N people, re-run creates 0 duplicates |
| 6 | Do-not-contact on person + send/draft checks | decline reply → status set → draft/send refused (script) |
| 7 | Deals + auto-create from meeting | signed calcom fixture creates one deal; replay creates none |
| 8 | Saved views, search | EXPLAIN on 10k seeded rows; search p95 |
| 9 | CSV import/export with dedupe | import fixture with duplicates → expected new/updated/skipped counts |
