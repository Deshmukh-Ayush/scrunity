# Multi-tenant security audit (read-only)

Date: 2026-10-14, `main` at `f90a258`. The audit itself changed nothing; fixes followed later the same day (see "Fix status").
Method: read every route under `src/app/api` (48 `route.ts`, 0 server actions — `grep -rln '"use server"' src`
returns nothing), the proxy, `src/lib/data/*`, the agent tools and the pipeline; then live probes against a
production build (`npm run start`) with two throwaway organizations created directly in the DB and real Better
Auth session cookies. All test rows were deleted afterwards (counts below). No vendor call was made and no email
was sent.

---

## Summary of findings

| ID | Severity | Finding | Verified |
|---|---|---|---|
| C-1 | **Critical** | Any org owner (every onboarded customer) can set their own plan to `scale` for free | live: `free → scale`, HTTP 200 |
| C-2 | **Critical** (LAN/self-host) | `?test_org=<orgId>` impersonation works from other machines, not just localhost | live from `192.168.1.3`, no session, HTTP 200 with the other org's campaigns |
| H-1 | High | A removed member keeps full API access to the org (stale active organization) | live: 200 after membership deleted |
| H-2 | High | Disqualified, bounced or suppressed drafts can be re-approved and sent | live: `rejected → approved` for a hard-bounced, suppressed address |
| H-3 | High | No do-not-contact: an "unsubscribe / not interested" reply never suppresses the address | code |
| H-4 | High | Unbounded spend: unlimited research runs, Firecrawl via `fetch-logo` with no cap, no LLM rate limits | code |
| M-1 | Medium | Chat conversation can link another org's campaign and read its details | live: returned other org's segment/company/website |
| M-2 | Medium | No role enforcement on `/api/gtm/*`; a `member` acts as `owner` | live: `approve_all` 200 as member |
| M-3 | Medium | Mailbox OAuth `state` not bound to the session and never expires | code |
| M-4 | Medium | Vendor data (provider, platform credits remaining) returned to customers | code + DB (61 rows) |
| M-5 | Medium | Cal.com bookings matched to a contact in any org; one booking link for all orgs | code |
| M-6 | Medium | `/api/inngest` runs in unsigned dev mode on local/LAN deployments | live: `GET /api/inngest` → `"mode":"dev"` |
| L-1…L-6 | Low | See section "Low findings" | code |

Everything else probed was correctly blocked (section 3).

## Fix status (2026-10-14, uncommitted)

All Critical, High and Medium findings are fixed and were re-tested on a production build with throwaway
organizations; every script ended with zero leftover test rows. Scripts: `scripts/test-tenant-security.ts`
(A1-A6 over HTTP, 33 checks), `scripts/test-send-safety.ts` (sender, opt-outs, Firecrawl cap, quotas in-process
with a stubbed sender and classifier, 19 checks), `scripts/test-tenant-security-b.ts` (B1-B6 over HTTP, 36 checks).

| ID | Status | Fix |
|---|---|---|
| C-1 | **Fixed** | `PATCH /api/organizations` JSON accepts only `{orgId, name}`; any other key (plan, currency, …) is a 400. Logo stays on the multipart branch. No other route writes a request body into an update (all `.set()` calls in `src/app/api` checked). Plan/credits change only via the Dodo webhook, admin grant/plan routes, or a pilot claim. |
| C-2 | **Fixed** | `?test_org=` requires `NODE_ENV !== "production"` **and** `ALLOW_TEST_ORG=true` in the server's own env (off by default). Production build: 401 from localhost, LAN, LAN with `Host: localhost`, cookie, and forged `x-user-id`/`x-org-id` headers. Dev + flag still works for `scripts/test-company-selection.ts`. No other auth bypass found (`ALLOW_MOCK_BILLING` is dev-only; `MAGIC_LINK_MAILER=console` prints links by design). |
| H-1 | **Fixed** | The proxy resolves the org from a membership row on every protected request (one indexed query, ~75 ms median from this machine to Neon); a stale active org is a 403 on `/api/*`. `getTenantContext`'s fallback also requires membership. Better Auth `afterRemoveMember` clears the org from the removed user's sessions. |
| H-2 | **Fixed** | Client approval only from `draft`/`approved` and only if `getSendBlock` passes (`lib/send-eligibility.ts`); lead send never re-approves; restart-send skips bounced/blocked drafts. The sender re-checks every draft right before sending (org opt-out, platform hard bounce/suppression, gates, name, `lookup_incomplete`, mailbox ownership, daily cap) and rejects blocked drafts instead of sending. |
| H-3 | **Fixed** | `gtm_do_not_contact` (migration 0028): a `not_interested` reply writes a per-org opt-out by email (idempotent) and rejects pending drafts to it. Keyed by email, so re-runs and Stage 4 cleanup can't remove it; Stage 5.5, lead drafting, approval and sending all check it. Hard bounces stay platform-wide. |
| H-4 | **Fixed** | Research runs need a plan or credits; per-org DB-backed quotas (`org_usage_counter`, `lib/org-quota.ts`): research runs 10/day, campaigns 20/day, chat 60 messages/hour, lead drafts 200/day, logo lookups 200/day (`GTM_*` env vars). Firecrawl: 400 calls per org per UTC day, reserved in `gtm_vendor_usage` (`FIRECRAWL_ORG_DAILY_CAP`). Chat `maxOutputTokens` 2000 (`GTM_CHAT_MAX_OUTPUT_TOKENS`). `fetch-logo` no longer calls Firecrawl (favicon URL, `Cache-Control: max-age=86400`). |
| M-1 | **Fixed** | Conversation POST verifies campaign/run ownership; `getConversationWithMessages` filters the linked campaign by org. |
| M-2 | **Fixed** | Role policy in `lib/api-role-policy.ts`, enforced in the proxy: owner/admin can launch, send, approve/reject, re-run, restart, delete and manage the mailbox; members read, draft and chat. Missing role now defaults to `member`. |
| M-3 | **Fixed** | `lib/mailbox-oauth-state.ts`: state must be ≤ 10 minutes old and match the signed-in user and org; used by Google and Microsoft callbacks (also manager-only). |
| M-4 | **Fixed** | `lib/data/public-fields.ts`: no `enrichMetadata`, provider ids, `source` or `firecrawl*` counters in responses; `enrich_verified` → `verified`; failure reasons mapped to neutral codes (`web_search_*`, `company_search_*`), vendor-named free text replaced by a generic message. |
| M-5 | **Fixed (scoped)** | `lib/calcom-match.ts`: a booking attaches only to a contact that was actually emailed, and only if exactly one organization emailed that address; otherwise it is left unattached. Email-only cancellation needs a unique booked meeting. Not done: per-organization booking links (one `CALCOM_BOOKING_URL` still serves every org; product decision). |
| M-6 | **Fixed** | In a production build whose Inngest client is in dev mode, `/api/inngest` answers 403 to GET/POST/PUT unless `INNGEST_DEV=true`. Cloud mode (signing key): unsigned GET/POST and a forged signature → 401, no function ran. |
| L-1…L-6 | Open | Not in scope of this round. |

---

## 1. Route inventory

Legend — Session: P = proxy requires a session (`src/proxy.ts` matcher), H = handler checks it itself, — = none.
Org source: `rAO` = `resolveAuthAndOrg` (`lib/gtm-auth.ts:22`), `gTC` = `getTenantContext` (`lib/tenant-context.ts`);
both trust the proxy's `x-org-id`, which is the session's `activeOrganizationId` **without a membership check on
`/api/*`** (`proxy.ts:124-128`; membership is only checked for `/dashboard` at `proxy.ts:132-160`).
Role: no `/api/gtm` route checks role; `rAO` defaults it to `"owner"` (`gtm-auth.ts:35`).

| Route | Methods | Session | Org source | ID ownership check | Role |
|---|---|---|---|---|---|
| `admin/invites` | POST | P + platform admin (`proxy.ts:54`, `pilot/admin-route.ts`) | n/a (platform) | n/a | platform admin |
| `admin/invites/[id]` | DELETE | same | n/a | platform scope | platform admin |
| `admin/organizations/[id]/credits` | POST | same | n/a | any org by design | platform admin |
| `admin/organizations/[id]/plan` | POST | same | n/a | any org by design | platform admin |
| `auth/[...all]` | GET, POST | Better Auth | — | Better Auth | — |
| `billing/checkout` | POST | P | gTC | n/a | none |
| `billing/invoices`, `billing/usage` | GET | P | gTC | n/a | none |
| `billing/portal` | POST | P | gTC | n/a | none |
| `billing/webhook` (+ alias `webhooks/dodo`) | POST | — (signature) | payload metadata / customer id | n/a | — |
| `gtm/admin/suppression` | GET | P + platform admin in handler | platform-wide | n/a | platform admin |
| `gtm/campaigns` | GET, POST | P | rAO | POST: `verifyIcpSegmentAccess` | none |
| `gtm/campaigns/[id]` | GET | P | rAO | `getCampaignDetail` → `verifyCampaignAccess` | none |
| `gtm/campaigns/[id]/confirm-selection` | POST | P | rAO | campaign + every company id checked (`:53-68`) | none |
| `gtm/campaigns/[id]/drafts` | GET, POST | P | rAO | `verifyCampaignAccess` | none |
| `gtm/campaigns/[id]/drafts/[draftId]` | POST | P | rAO | `verifyDraftAccess` | none; **no status guard** (H-2) |
| `gtm/campaigns/[id]/realtime-token` | GET | P | rAO | `verifyCampaignAccess` | none |
| `gtm/campaigns/[id]/rerun` | POST | P | rAO | `verifyCampaignAccess` | none |
| `gtm/campaigns/[id]/restart-stage` | POST | P | rAO | `verifyCampaignAccess` (`:147`) | none |
| `gtm/campaigns/[id]/send` | POST | P | rAO | `verifyCampaignAccess` | none |
| `gtm/chat` | POST | P | rAO | tools scoped by org (one exception, L-2) | none |
| `gtm/chat/conversations` | GET, POST | P | rAO | **POST: campaign/run ids not checked** (M-1) | none |
| `gtm/chat/conversations/[id]` | GET, DELETE | P | rAO | org filter in query | none |
| `gtm/chat/messages` | POST | P | rAO | conversation org checked (`:37-40`) | none |
| `gtm/digests` | GET | P | rAO | org filter | none |
| `gtm/fetch-logo` | GET | P (no org needed) | — | n/a; **calls Firecrawl uncapped** (H-4) | none |
| `gtm/leads` | GET | P | rAO | org filter on every condition | none |
| `gtm/leads/[id]/draft` | POST | P | rAO | contact joined to run org (`:56-61`) | none |
| `gtm/leads/[id]/send` | POST | P | rAO | contact joined to run org (`:53-58`) | none; re-approves any draft (H-2) |
| `gtm/mailbox` | GET, DELETE | P | rAO | org filter | none (M-2) |
| `gtm/mailbox/threads` | GET | P | rAO | org filter | none |
| `gtm/mailbox/connect`, `microsoft/connect` | GET | P | rAO | n/a | none |
| `gtm/mailbox/imap-smtp/connect` | POST | P | rAO | n/a | none |
| `gtm/mailbox/callback`, `microsoft/callback` | GET | P | **org from decrypted `state`** | state not bound to session (M-3) | none |
| `gtm/research-runs` | GET, POST | P | rAO | org filter; **no limits on POST** (H-4) | none |
| `gtm/research-runs/[id]` | GET, PATCH | P | rAO | `verifyResearchRunAccess` | none |
| `gtm/research-runs/[id]/realtime-token`, `restart-stage` | GET / POST | P | rAO | `verifyResearchRunAccess` | none |
| `gtm/segments/[id]/digest` | GET, POST | P | rAO | `verifyIcpSegmentAccess` | none |
| `inngest` | GET, POST, PUT | — (not in matcher) | event data | Inngest signing key in cloud mode only (M-6) | — |
| `onboarding` | POST | P + H | session user | org id derived from user id | n/a |
| `organizations` | PATCH | H (not in matcher) | **`orgId` from body**, owner check (`:100-107`) | owner of that org | owner; **plan settable** (C-1) |
| `organizations/invites` | POST, DELETE | H | session active org | DELETE scoped by org | owner (`:48`, `:132`) |
| `organizations/invites/accept` | POST | H | invite's org | invite email must equal session email (`:42-44`) | n/a |
| `webhooks/calcom` | POST | — (HMAC, timing-safe `:37-40`) | **none** | contact matched across orgs (M-5) | — |

## 2. Data functions and background jobs

- `src/lib/data/campaigns.ts`: `listOrgCampaigns` (`:32`) and `getCampaignDetail` (`:54`) are org-scoped;
  `listCampaignDrafts(campaignId)` (`:106`) takes no org but both callers verify first
  (`api/gtm/campaigns/[id]/drafts/route.ts:23`, `components/gtm/campaign-detail/campaign-detail.tsx:28-34`
  discards drafts unless `getCampaignDetail` succeeds).
- `research-runs.ts` (`:18`, `:32`), `mailbox.ts`, `admin.ts` (platform admin only): scoped.
- `chat.ts:46-66`: the linked campaign is loaded **without an org filter** (M-1).
- `components/leads/leads-section.tsx:46,92` and `components/billing/*`: scoped by `getTenantContext`.
- `lib/chat/agent-tools.ts`: all tools filter `organizationId` except the segment-name lookup at `:333` (L-2).
- Background: reply polling picks drafts per mailbox org (`reply-polling/eligible-drafts.ts:72`); digests take the
  org from the research run (`gtm-digest.ts:120,259`); pipeline stages act on ids from server-side dispatch only.
- Shared internal tables (`organization_credit_period`, `usage_event`, `gtm_vendor_usage`,
  `billing_webhook_event`) are read only by `lib/ai/credits.ts`, `lib/firecrawl-spend.ts`,
  `lib/providers/*`, `lib/dodo-webhook.ts` — no route returns them (`grep -rln` for each).

## 3. IDOR checks (live)

Setup: orgs A and B (owner sessions), org A data (run, segment, campaign, company, contact, draft, invitation).
Each request was sent with **B's session and A's id** to the production build on `:3000`.

| Probe (B → A's id) | Status | Body |
|---|---|---|
| GET `/api/gtm/campaigns/<A>` | 403 | `Forbidden: Campaign not found or unauthorized` |
| GET `…/<A>/drafts`, `…/<A>/realtime-token` | 403, 403 | same |
| GET `/api/gtm/research-runs/<A run>`, `…/realtime-token` | 403, 403 | `Research run not found or unauthorized` |
| GET `/api/gtm/segments/<A seg>/digest` | 403 | `Segment not found or unauthorized` |
| POST `…/drafts` `approve_all`; POST `…/drafts/<A draft>` approve | 403, 403 | — |
| POST `…/<A>/confirm-selection` | 403 | — |
| POST `/api/gtm/leads/<A contact>/draft`, `/send` | 404, 404 | `Contact not found or access denied` |
| A's draft status after all B writes | unchanged (`draft`) | — |
| GET `/api/gtm/leads?pageSize=100` as B | 200 | `total: 0` (A's contact absent) |
| PATCH `/api/organizations` `{orgId: A, plan}` as B | 403 | `Only organization owners can change settings.` |
| POST `/api/organizations/invites/accept` with A's invite for another email | 403 | `Email mismatch…` |
| POST `/api/gtm/chat/conversations` `{outreachCampaignId: A}` then GET it | 201, 200 | **leak** (M-1) |

Not probed live (would dispatch pipeline work or vendor calls if the check were wrong; covered by code reading):
`rerun`, `send`, `restart-stage`, research-run `PATCH`/`restart-stage`, mailbox connect/callback.

Cleanup: after both scripts, remaining rows with the test prefix —
`users 0, orgs 0, sessions 0, members 0, runs 0, contacts 0, drafts 0, conversations 0, invitations 0, suppression 0`.

## 4. Platform-wide tables

- `gtm_suppression_entry`: written only by `lib/gtm-suppression.ts`; read by pipeline stages and
  `api/gtm/admin/suppression`, which is platform-admin only (`route.ts` → `getPlatformAdmin`). No customer route
  returns rows, but disqualification messages derived from another org's entry reach customers (L-1).
- `gtm_vendor_usage`, `billing_webhook_event`, `organization_credit_period`, `usage_event`: no route (section 2).
- `pilot_invite`: platform-admin routes only.

## 5. Admin, invites, magic link

- Admin page and APIs: 404 for non-admins, signed-out users and `test_org` impersonation; checked in the proxy
  (`proxy.ts:54`) and again in each handler/page. Verified earlier today by `scripts/test-pilot-access.ts`
  (15/15 gate checks passed against a production build).
- Magic link: identical `200 {"status":true}` for invited and uninvited emails, single-use, 5-minute expiry, per
  email/IP limits (same script, section 8 of its output). Pilot invites are only visible to platform admins.
- Team invite accept: requires a pending, unexpired invite whose email equals the signed-in email
  (`invites/accept/route.ts:38-49`); verified live (403 for a mismatched email). Invite ids are random UUIDs.

## 6. Secrets and exposure

- `.env*` is ignored (`.gitignore:32`; `git check-ignore -v .env`); no `.env` file is tracked (`git ls-files`).
- Git history (`git log --all -E -G <pattern>`, values never printed): no Google OAuth secrets, Groq, Resend,
  Dodo, Firecrawl, Stripe-style, AWS or private-key strings. Only hits: Postgres URLs in `README.md`
  (commits `9566f30`, `b49c0c5`) — placeholders (`postgresql://user:***@ep-xyz…`).
- Client bundles: 388 files in `.next/static` searched for the actual values of 22 non-public env vars — 0 matches.
  Client code reads only `NEXT_PUBLIC_*` (Dodo price ids, PostHog, app/site URL).
- Logging: no log line prints tokens, passwords or keys (grep of `console.*` with secret-like names); see L-4 for
  the dev magic-link mailer.
- Vendor names/credits in responses: M-4.

## 7. Routes that skip session auth

| Route | Protection |
|---|---|
| `/api/billing/webhook`, `/api/webhooks/dodo` | Standard Webhooks signature, webhook-id dedupe (`lib/dodo-webhook.ts`) |
| `/api/webhooks/calcom` | HMAC-SHA256 with `CALCOM_WEBHOOK_SECRET`, timing-safe; no replay window (L-5) |
| `/api/inngest` | Inngest signing key in cloud mode; **none in dev mode** (M-6) |
| `/api/auth/*` | Better Auth (CSRF/origin checks, rate limit in production) |
| `/api/organizations*` | not in the proxy matcher; each handler checks the session itself |
| `/invite/org/[id]`, `/sign-in` pages | public by design; accept requires a session |

## 8. Sending safety

| Path | Name check | Gates (email confidence, LinkedIn) | Suppression | `lookup_incomplete` | Prior status |
|---|---|---|---|---|---|
| Stage 6 `write_emails` | via 5.5 | via 5.5 | via 5.5 (`gtm-stage-5-5.ts:137`) | skipped (`write-emails.ts`) | n/a |
| `leads/[id]/draft` | yes (`:73`) | yes (`:84`) | **no** | **no** | returns existing draft |
| `drafts/[draftId]` approve | no | no | **no** | **no** | **any → approved** |
| `leads/[id]/send` | yes | yes | **no** | **no** | **any → approved** (`:105-125`) |
| `restart-stage` (send) | — | — | — | — | **failed (incl. bounced) → approved** (`:102-107`) |
| Stage 7 sender `executeSendEmails` | yes (`:249`) | yes (`:256`) | **no** (`checkSuppression` not imported) | **no** | requires `approved` (`:235-241`) |

So a contact disqualified by suppression, an aggregator domain or a hard bounce (all pass the name/gate checks)
can be sent to: re-approve the draft (verified live, finding H-2), then send.

## 9. Rate limiting and spend

- Only `organizations/*` and `magic-link.ts` use `rateLimit` (`grep -rln rateLimit src`), in memory per instance.
- Research runs: `POST /api/gtm/research-runs` has no plan, credit or count limit; each run may use 25 Firecrawl
  calls per stage attempt and 75 lifetime (`firecrawl-spend.ts:82`), plus Groq calls in stages 1-3.
- `GET /api/gtm/fetch-logo?url=`: `scrapeUrl` without `runContext`, so no cap is checked (`firecrawl.ts:471`).
- Chat: `streamText` up to 5 steps per request (`gtm/chat/route.ts:65`), no rate limit; `leads/[id]/draft` calls
  the LLM per request.
- The Firecrawl limiter is process-wide (8/min default), so one org can starve every other org's pipeline.

---

## Findings in detail

**C-1 Free plan self-upgrade** — `src/app/api/organizations/route.ts:87-117`. The settings schema accepts
`plan: z.enum([... "scale" ...])` and writes it after an owner check. Every customer owns their onboarding org.
Exploit: `PATCH /api/organizations {"orgId":"<own org>","plan":"scale"}` → unlimited campaigns immediately (plan
limits read `organization.plan`), seat limit raised, and the next credit period is created with 5000 credits.
Evidence: live, plan `free → scale`, `{"success":true}`. Fix: remove `plan` from this endpoint (plans change only
via the Dodo webhook / admin). Under 1 hour.

**C-2 `test_org` impersonation over the network** — `src/proxy.ts:46-58`. `isLocalhost` uses
`request.nextUrl.hostname`, which reported `localhost` for a request sent to the LAN address. Exploit: anyone on
the same network as a demo machine (the pilot plan) who knows or sees an org id calls any `/api/gtm/*` or
`/dashboard/*` URL with `?test_org=<orgId>` and acts as that org's member, reads and writes. Evidence: request to
`http://192.168.1.3:3000/api/gtm/campaigns?test_org=<A>` without any cookie → 200 with A's campaign. Behaviour on
Vercel: not verified. Fix: allow the bypass only when `NODE_ENV === "development"` and an explicit
`ALLOW_TEST_ORG=true`. Under 1 hour.

**H-1 Stale membership** — `proxy.ts:124-128`, `gtm-auth.ts:30-38`, `tenant-context.ts` fast path. Exploit: an
owner removes a teammate; the teammate's existing session still has the org active and keeps calling every
`/api/gtm/*` and `/api/billing/*` route. Evidence: GET `/api/gtm/campaigns/<A>` 200 before and **200 after** the
member row was deleted (the dashboard page redirects to `/onboarding`, so only the API leaks). Fix: in the proxy,
look up the membership for the active org on `/api/*` too (one indexed query) and set `x-org-role`; 401/403 when
absent. Under 1 hour.

**H-2 Re-approving disqualified drafts** — `drafts/[draftId]/route.ts:51-71`, `leads/[id]/send/route.ts:105-125`,
`restart-stage/route.ts:102-107`, `send-emails.ts:233-263`. Exploit (by a customer, deliberately or by clicking
approve on a disqualified row): a draft rejected for a hard bounce, aggregator domain or suppression becomes
`approved` and is sent. Evidence: live, `rejected → approved` (HTTP 200) for a contact whose address has a
`hard_bounce` suppression row. Fix: allow `approve` only from `draft`; in `executeSendEmails`, call
`checkSuppression` and skip `lookup_incomplete` before each send. Under 1 hour.

**H-3 No do-not-contact** — `reply-polling/process-reply.ts:98-106,262-272` only stops that thread's reply loop;
no suppression or contact status is written. `rerun/route.ts:68-75` deletes the campaign's drafts (and their
events), so the decline record disappears and the person is rediscovered and emailed again. Exploit: none needed —
a prospect who replied "unsubscribe" can be emailed again by the next run (CAN-SPAM/GDPR exposure). Fix: on
`not_interested`, write a per-org do-not-contact record and check it in drafting and sending. About 1-2 hours.

**H-4 Unbounded spend** — section 9. Exploit: a free account scripts `POST /api/gtm/research-runs` (or
`GET /api/gtm/fetch-logo?url=` in a loop) to burn the shared Firecrawl/Groq budget and saturate the shared
limiter. Fix: per-org daily caps on research runs and chat; drop the Firecrawl scrape from `fetch-logo` (it already
falls back to a favicon URL). Caps under 1 hour each.

**M-1 Cross-org campaign data through chat** — `chat/conversations/route.ts:103-113` stores ids unchecked;
`data/chat.ts:65` loads the campaign without an org filter. Evidence: live, B read A's status, stage, segment
name, company name and website. Needs A's campaign id (21-char nanoid). Fix: verify both ids in POST and add
the org join in `getConversationWithMessages`. Under 1 hour.

**M-2 No roles on `/api/gtm`** — any member can send, rerun, connect/disconnect the mailbox and approve drafts.
Evidence: live, `approve_all` 200 and `DELETE /api/gtm/mailbox` reached the handler as `role=member`.
Founder decision on what members may do; then a `requireRole` helper (after H-1 supplies the real role).

**M-3 OAuth state** — `mailbox/connect/route.ts:22-27` puts `ts` in the state; `callback/route.ts:36-48`
never checks it or compares `userId` with the session. Exploit: an attacker sends a victim their own consent link;
the victim's mailbox is connected to the attacker's org. Fix: reject states older than 10 minutes and require
`stateData.userId === session.user.id`. Under 1 hour.

**M-4 Vendor data to customers** — `data/campaigns.ts:37,88-92` strips only `source/providerId/providerPersonId`;
contact rows still carry `enrichMetadata` (61 rows with `provider` and the platform account's `creditsRemaining`,
min 40) and `emailSource: "enrich_verified"`; campaign rows include `firecrawlCallCount` (seen in a live response).
Fix: strip `enrichMetadata` and map internal field names before responding. Under 1 hour.

**M-5 Cal.com** — `webhooks/calcom/route.ts:174-187` matches `lower(email)` across all orgs; booking link is one
platform env (`process-reply.ts:119`). A booking can attach to another customer's contact; all customers'
prospects book one calendar. Fix: per-org booking link carrying org/contact ids; match within that org.

**M-6 Inngest dev mode** — `inngest/client.ts:57-79`: `isDev` unless a cloud env var is present; then no signing
key is used. Evidence: unauthenticated `GET /api/inngest` → `mode: dev`. Whether unsigned POSTs execute functions
was not tested (would run pipeline stages). Fix: during demos set `INNGEST_DEV` only on localhost, or block
`/api/inngest` from non-loopback addresses in the proxy.

### Low findings
- **L-1** Disqualification text from another org's suppression entry reveals that someone bounced on that address.
- **L-2** `agent-tools.ts:333` returns a segment name by id without org filter.
- **L-3** Many 500 responses include `err.message` (e.g. `campaigns/[id]/route.ts:37`).
- **L-4** `MAGIC_LINK_MAILER=console` (or no `RESEND_API_KEY`) prints live sign-in links to server logs.
- **L-5** Cal.com webhook has no timestamp/replay window.
- **L-6** In-memory rate limits are per instance (`lib/rate-limit.ts` header comment).

---

## Prioritized fix list

| # | Fix | Effort | < 1 h |
|---|---|---|---|
| 1 | C-1: remove `plan` from `PATCH /api/organizations` | 10 min | yes |
| 2 | C-2: gate `test_org` behind `NODE_ENV=development` + `ALLOW_TEST_ORG=true` | 15 min | yes |
| 3 | H-1: membership + role lookup for `/api/*` in the proxy | 45 min | yes |
| 4 | H-2: approve only from `draft`; suppression + `lookup_incomplete` checks in the sender | 45 min | yes |
| 5 | H-4: drop Firecrawl from `fetch-logo`; per-org daily cap on research runs; chat rate limit | 1-2 h | partly |
| 6 | H-3: per-org do-not-contact on decline, checked in draft/send | 1-2 h | no |
| 7 | M-1: verify ids in conversation POST + org filter in `getConversationWithMessages` | 20 min | yes |
| 8 | M-4: strip `enrichMetadata` / vendor-named fields from responses | 20 min | yes |
| 9 | M-3: OAuth state expiry + session binding | 20 min | yes |
| 10 | M-6: protect `/api/inngest` outside cloud mode | 20 min | yes |
| 11 | M-2: role policy (founder decision) + `requireRole` | 1-2 h | no |
| 12 | M-5: per-org booking links, org-scoped matching | half day | no |
| 13 | L-1…L-6 | small each | yes |
