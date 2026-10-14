/**
 * Verifies the Part B fixes of docs/tenant-security-audit.md over HTTP against
 * a production build (start it as for scripts/test-tenant-security.ts):
 *   B1 chat links to other orgs' campaigns, B2 roles on /api/gtm,
 *   B3 mailbox OAuth state binding, B4 vendor data in responses,
 *   B5 Cal.com matching scoped to one organization, B6 unsigned Inngest calls.
 * No vendor call: refusals happen before any OAuth exchange or model call, and
 * the Cal.com webhook is signed locally with the configured secret.
 *
 *   npx tsx scripts/test-tenant-security-b.ts
 */
import "dotenv/config"
import crypto from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "../src/utils/db"
import { encryptToken } from "../src/lib/encryption"
import { verifyMailboxOAuthState } from "../src/lib/mailbox-oauth-state"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const tag = crypto.randomBytes(3).toString("hex")
const id = (k: string) => `secb-${tag}-${k}`
const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || ""
let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures++
}
const q = (s: TemplateStringsArray, ...v: unknown[]) => db.execute(sql(s, ...v))
const rows = async (s: TemplateStringsArray, ...v: unknown[]) => (await q(s, ...v)).rows as any[]

async function cookieFor(userId: string, org: string) {
  const token = crypto.randomBytes(24).toString("hex")
  await q`insert into session (id, expires_at, token, created_at, updated_at, user_id, active_organization_id)
          values (${id("s-" + token.slice(0, 8))}, now() + interval '1 hour', ${token}, now(), now(), ${userId}, ${org})`
  return `better-auth.session_token=${encodeURIComponent(`${token}.${crypto.createHmac("sha256", secret).update(token).digest("base64")}`)}`
}

async function call(path: string, o: { method?: string; cookie?: string; body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { origin: BASE, ...(o.headers ?? {}) }
  if (o.cookie) headers.cookie = o.cookie
  if (o.body !== undefined || o.raw !== undefined) headers["content-type"] = "application/json"
  const res = await fetch(`${BASE}${path}`, { method: o.method ?? "GET", headers, redirect: "manual", body: o.raw ?? (o.body === undefined ? undefined : JSON.stringify(o.body)) })
  const text = await res.text()
  let body: any = text
  try { body = JSON.parse(text) } catch {}
  return { status: res.status, body, text, location: res.headers.get("location") ?? "" }
}

async function orgWithCampaign(o: string, owner: string, sentEmails: string[], unsentEmails: string[] = []) {
  await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org" + o)}, ${"SecB " + o}, ${id("slug" + o)}, 'pilot', now(), now())`
  await q`insert into member (id, organization_id, user_id, role, created_at) values (${id("mem-" + owner)}, ${id("org" + o)}, ${id(owner)}, 'owner', now())`
  await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage, failure_reason)
          values (${id("run" + o)}, ${id("org" + o)}, ${id(owner)}, 'https://secb.example', ${"SecB " + o + " Co"}, 'x', '11-50', 'failed', 'research_company', 'firecrawl_call_cap_exceeded')`
  await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords) values (${id("seg" + o)}, ${id("run" + o)}, ${"secret segment " + o}, 'x', '["x"]', '[]', '["x"]')`
  await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage, failure_reason, firecrawl_call_count)
          values (${id("camp" + o)}, ${id("seg" + o)}, ${id("run" + o)}, 'failed', 'find_contacts', 'Firecrawl rate limit (429) exceeded for /v1/search after 2 retries.', 7)`
  await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location, source, provider_id)
          values (${id("co" + o)}, ${id("camp" + o)}, 'Prospect', ${`secb-${o.toLowerCase()}-${tag}.example`}, 'x', 'IN', 'apollo', 'apollo-org-123')`
  let n = 0
  for (const [email, sent] of [...sentEmails.map((e) => [e, true] as const), ...unsentEmails.map((e) => [e, false] as const)]) {
    n++
    const ct = id(`ct${o}${n}`)
    await q`insert into gtm_contact (id, prospect_company_id, name, title, email, email_source, verification_status, linkedin_url, enrich_metadata)
            values (${ct}, ${id("co" + o)}, 'Priya Sharma', 'CEO', ${email}, 'enrich_verified', 'enrich_verified', 'https://www.linkedin.com/in/secb',
                    ${JSON.stringify({ provider: "GOOGLE", creditsRemaining: 40, requestId: "req-123" })}::jsonb)`
    await q`insert into gtm_email_draft (id, contact_id, outreach_campaign_id, subject, body, status, sent_at)
            values (${id(`d${o}${n}`)}, ${ct}, ${id("camp" + o)}, 's', 'b', ${sent ? "sent" : "draft"}, ${sent ? new Date().toISOString() : null})`
  }
}

async function setup() {
  for (const u of ["a", "b", "mem", "adm"]) {
    await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id(u)}, ${"SecB " + u}, ${`secb-${u}-${tag}@scrunity-test.invalid`}, true, now(), now())`
  }
  const both = `both-${tag}@secb.example`, onlyA = `onlya-${tag}@secb.example`, bUnsent = `bunsent-${tag}@secb.example`
  await orgWithCampaign("A", "a", [both, onlyA, bUnsent], [`pending-${tag}@secb.example`])
  await orgWithCampaign("B", "b", [both], [bUnsent])
  await q`insert into member (id, organization_id, user_id, role, created_at) values (${id("mem-mem")}, ${id("orgA")}, ${id("mem")}, 'member', now())`
  await q`insert into member (id, organization_id, user_id, role, created_at) values (${id("mem-adm")}, ${id("orgA")}, ${id("adm")}, 'admin', now())`
  return { both, onlyA, bUnsent }
}

async function calcom(event: unknown) {
  const raw = JSON.stringify(event)
  const sig = crypto.createHmac("sha256", process.env.CALCOM_WEBHOOK_SECRET ?? "").update(raw).digest("hex")
  return call("/api/webhooks/calcom", { method: "POST", raw, headers: { "x-cal-signature-256": sig } })
}

async function run(emails: { both: string; onlyA: string; bUnsent: string }) {
  const A = await cookieFor(id("a"), id("orgA"))
  const B = await cookieFor(id("b"), id("orgB"))
  const MEM = await cookieFor(id("mem"), id("orgA"))
  const ADM = await cookieFor(id("adm"), id("orgA"))

  console.log("\nB1 chat cannot link or read another organization's campaign")
  const foreign = await call("/api/gtm/chat/conversations", { method: "POST", cookie: B, body: { title: "x", outreachCampaignId: id("campA") } })
  check("B creating a conversation linked to A's campaign -> 404", foreign.status === 404, `${foreign.status}`)
  const foreignRun = await call("/api/gtm/chat/conversations", { method: "POST", cookie: B, body: { title: "x", researchRunId: id("runA") } })
  check("B linking A's research run -> 404", foreignRun.status === 404, `${foreignRun.status}`)
  await q`insert into gtm_conversation (id, organization_id, user_id, title, outreach_campaign_id, created_at, updated_at) values (${id("conv-old")}, ${id("orgB")}, ${id("b")}, 'old link', ${id("campA")}, now(), now())`
  const old = await call(`/api/gtm/chat/conversations/${id("conv-old")}`, { cookie: B })
  check("a stored link to A's campaign returns no campaign data", old.status === 200 && old.body.linkedCampaign === null, JSON.stringify(old.body.linkedCampaign))
  const own = await call("/api/gtm/chat/conversations", { method: "POST", cookie: A, body: { title: "x", outreachCampaignId: id("campA") } })
  const ownRead = own.body?.conversation ? await call(`/api/gtm/chat/conversations/${own.body.conversation.id}`, { cookie: A }) : null
  check("control: A links and reads its own campaign", own.status === 201 && ownRead?.body?.linkedCampaign?.id === id("campA"), `${own.status}`)

  console.log("\nB2 roles: members read and draft, owners/admins act")
  const memRead = await call(`/api/gtm/campaigns/${id("campA")}`, { cookie: MEM })
  check("member can read campaigns", memRead.status === 200, `${memRead.status}`)
  for (const [label, path, method, body] of [
    ["approve all drafts", `/api/gtm/campaigns/${id("campA")}/drafts`, "POST", { action: "approve_all" }],
    ["approve one draft", `/api/gtm/campaigns/${id("campA")}/drafts/${id("dA3")}`, "POST", { action: "approve" }],
    ["send campaign", `/api/gtm/campaigns/${id("campA")}/send`, "POST", {}],
    ["re-run campaign", `/api/gtm/campaigns/${id("campA")}/rerun`, "POST", {}],
    ["restart stage", `/api/gtm/campaigns/${id("campA")}/restart-stage`, "POST", {}],
    ["send to a lead", `/api/gtm/leads/${id("ctA1")}/send`, "POST", {}],
    ["disconnect mailbox", `/api/gtm/mailbox`, "DELETE", undefined],
    ["start a research run", `/api/gtm/research-runs`, "POST", {}],
  ] as [string, string, string, unknown][]) {
    const r = await call(path, { method, cookie: MEM, body })
    check(`member: ${label} -> 403`, r.status === 403, `${r.status}`)
  }
  const memDraft = await call(`/api/gtm/leads/${id("ctA2")}/draft`, { method: "POST", cookie: MEM })
  check("member can draft (passes the role check; existing draft returned, no model call)", memDraft.status === 200 && memDraft.body?.alreadyExisted === true, `${memDraft.status}`)
  const admApprove = await call(`/api/gtm/campaigns/${id("campA")}/drafts/${id("dA4")}`, { method: "POST", cookie: ADM, body: { action: "reject" } })
  check("control: admin can act (reject a pending draft)", admApprove.status === 200, `${admApprove.status}`)

  console.log("\nB3 mailbox OAuth state is bound to the signed-in user and org")
  const state = (userId: string, orgId: string, ageMs = 0) => encryptToken(JSON.stringify({ orgId, userId, ts: Date.now() - ageMs }))
  const stolen = await call(`/api/gtm/mailbox/callback?code=fake&state=${encodeURIComponent(state(id("a"), id("orgA")))}`, { cookie: B })
  check("A's connect state finished by B -> refused before any token exchange", stolen.status === 307 && stolen.location.includes("state_session_mismatch"), stolen.location)
  const expired = await call(`/api/gtm/mailbox/callback?code=fake&state=${encodeURIComponent(state(id("a"), id("orgA"), 11 * 60_000))}`, { cookie: A })
  check("state older than 10 minutes -> refused", expired.status === 307 && expired.location.includes("invalid_or_expired_state"), expired.location)
  const memCb = await call(`/api/gtm/mailbox/callback?code=fake&state=${encodeURIComponent(state(id("mem"), id("orgA")))}`, { cookie: MEM })
  check("member cannot finish a mailbox connection -> 403", memCb.status === 403, `${memCb.status}`)
  const mbx = await rows`select count(*)::int n from gtm_connected_mailbox where organization_id in (${id("orgA")}, ${id("orgB")})`
  check("no mailbox was attached", mbx[0].n === 0, `${mbx[0].n}`)
  const ok = verifyMailboxOAuthState(state(id("a"), id("orgA")), new Headers({ "x-user-id": id("a"), "x-org-id": id("orgA") }))
  check("control (in-process): a fresh state for the same user and org is accepted", ok.ok)

  console.log("\nB4 no vendor data in customer responses")
  const vendor = /enrichMetadata|creditsRemaining|providerId|providerPersonId|"source"|firecrawl|apollo|enrich_verified|GOOGLE/i
  for (const [label, path] of [
    ["campaign detail", `/api/gtm/campaigns/${id("campA")}`],
    ["campaign list", "/api/gtm/campaigns"],
    ["campaign drafts", `/api/gtm/campaigns/${id("campA")}/drafts`],
    ["research runs", "/api/gtm/research-runs"],
    ["research run detail", `/api/gtm/research-runs/${id("runA")}`],
    ["leads", "/api/gtm/leads?pageSize=100"],
  ]) {
    const r = await call(path, { cookie: A })
    const hit = r.text.match(vendor)?.[0]
    check(`${label}: no vendor names, ids, credits or payloads`, r.status === 200 && !hit, hit ? `found "${hit}"` : `${r.status}`)
  }
  const detail = await call(`/api/gtm/campaigns/${id("campA")}`, { cookie: A })
  check("failure reasons are neutral", detail.body?.researchRun?.failureReason === "web_search_attempt_limit" &&
    !String(detail.body?.campaign?.failureReason).toLowerCase().includes("firecrawl"),
    `${detail.body?.researchRun?.failureReason} | ${detail.body?.campaign?.failureReason}`)
  check("contact email status shown as 'verified'", detail.body?.contacts?.[0]?.emailSource === "verified", detail.body?.contacts?.[0]?.emailSource)

  console.log("\nB5 Cal.com bookings are matched within one organization")
  const book = (uid: string, email: string) => calcom({ triggerEvent: "BOOKING_CREATED", payload: { uid: id(uid), startTime: new Date().toISOString(), attendees: [{ email }] } })
  const amb = await book("bk-both", emails.both)
  const ambRows = await rows`select count(*)::int n from gtm_meeting where calcom_booking_uid = ${id("bk-both")}`
  check("attendee emailed by two orgs: not attached", amb.status === 200 && amb.body?.matched === false && ambRows[0].n === 0, `${amb.status} ${JSON.stringify(amb.body)}`)
  const only = await book("bk-only", emails.onlyA)
  const onlyRow = await rows`select m.contact_id, r.organization_id from gtm_meeting m join gtm_contact c on c.id = m.contact_id join gtm_prospect_company pc on pc.id = c.prospect_company_id join gtm_outreach_campaign oc on oc.id = pc.outreach_campaign_id join gtm_research_run r on r.id = oc.research_run_id where m.calcom_booking_uid = ${id("bk-only")}`
  check("control: attendee emailed only by A attaches to A's contact", only.body?.matched === true && onlyRow[0]?.organization_id === id("orgA"), JSON.stringify(onlyRow))
  const unsent = await book("bk-unsent", emails.bUnsent)
  const unsentRow = await rows`select r.organization_id from gtm_meeting m join gtm_contact c on c.id = m.contact_id join gtm_prospect_company pc on pc.id = c.prospect_company_id join gtm_outreach_campaign oc on oc.id = pc.outreach_campaign_id join gtm_research_run r on r.id = oc.research_run_id where m.calcom_booking_uid = ${id("bk-unsent")}`
  check("B has the address but never emailed it: booking goes to A (who did)", unsent.body?.matched === true && unsentRow[0]?.organization_id === id("orgA"), JSON.stringify(unsentRow))
  const forged = await call("/api/webhooks/calcom", { method: "POST", raw: JSON.stringify({ triggerEvent: "BOOKING_CREATED", payload: { uid: id("bk-x"), attendees: [{ email: emails.onlyA }] } }), headers: { "x-cal-signature-256": "00".repeat(32) } })
  check("unsigned/forged webhook -> 401", forged.status === 401, `${forged.status}`)

  console.log("\nB6 Inngest endpoint in a production build without a signing setup")
  for (const method of ["GET", "POST", "PUT"]) {
    const r = await call(`/api/inngest?fnId=gtm-agent-gtm-poll-email-replies&stepId=step`, { method, body: method === "GET" ? undefined : {} })
    check(`${method} /api/inngest (dev-mode client in a production build) -> 403`, r.status === 403, `${r.status}`)
  }
}

async function cleanup() {
  await q`delete from gtm_meeting where calcom_booking_uid like ${`secb-${tag}-%`}`
  await q`delete from organization where id like ${`secb-${tag}-%`}`
  await q`delete from "user" where id like ${`secb-${tag}-%`}`
  const left = (await rows`select
    (select count(*) from organization where id like ${`secb-${tag}-%`})::int orgs,
    (select count(*) from "user" where id like ${`secb-${tag}-%`})::int users,
    (select count(*) from session where user_id like ${`secb-${tag}-%`})::int sessions,
    (select count(*) from gtm_contact where id like ${`secb-${tag}-%`})::int contacts,
    (select count(*) from gtm_meeting where calcom_booking_uid like ${`secb-${tag}-%`})::int meetings,
    (select count(*) from gtm_conversation where organization_id like ${`secb-${tag}-%`})::int conversations`)[0]
  console.log(`\nCleanup — remaining test rows: ${JSON.stringify(left)}`)
}

setup()
  .then(run)
  .catch((err) => { console.error(err); failures++ })
  .finally(async () => {
    await cleanup()
    console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
    process.exit(failures === 0 ? 0 : 1)
  })
