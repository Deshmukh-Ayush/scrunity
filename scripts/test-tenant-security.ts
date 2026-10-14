/**
 * Verifies the tenant-security fixes (docs/tenant-security-audit.md, Part A)
 * over HTTP against a production build, with throwaway organizations:
 *   A1 plan self-upgrade, A2 ?test_org= bypass, A3 removed members,
 *   A4 re-approving blocked drafts, A5 opted-out contacts (HTTP part),
 *   A6 spend quotas (research runs, campaigns, logo lookups, chat).
 *
 * No vendor call can happen: start the server so dispatched work is only
 * queued, against the stand-in Inngest receiver (scratch script), and with
 * low quotas, e.g.
 *   node fake-inngest.cjs &      # listens on 127.0.0.1:8299
 *   PIPELINE_EXECUTOR=inngest INNGEST_BASE_URL=http://127.0.0.1:8299 \
 *   PLATFORM_ADMIN_EMAILS=pilot-admin@scrunity-test.invalid \
 *   GTM_RESEARCH_RUNS_PER_DAY=2 GTM_CAMPAIGNS_PER_DAY=1 GTM_LOGO_FETCHES_PER_DAY=3 \
 *   GTM_CHAT_MESSAGES_PER_HOUR=0 npm run start
 *   npx tsx scripts/test-tenant-security.ts
 *
 * Everything created is deleted at the end; remaining-row counts are printed.
 */
import "dotenv/config"
import crypto from "node:crypto"
import os from "node:os"
import { sql } from "drizzle-orm"
import { db } from "../src/utils/db"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const ADMIN_EMAIL = "pilot-admin@scrunity-test.invalid"
const tag = crypto.randomBytes(3).toString("hex")
const id = (k: string) => `sec-${tag}-${k}`
const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || ""
let failures = 0

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures++
}

const q = (strings: TemplateStringsArray, ...values: unknown[]) => db.execute(sql(strings, ...values))
const one = async <T,>(strings: TemplateStringsArray, ...values: unknown[]) =>
  (await q(strings, ...values)).rows[0] as T

async function cookieFor(userId: string, activeOrg: string | null) {
  const token = crypto.randomBytes(24).toString("hex")
  await q`insert into session (id, expires_at, token, created_at, updated_at, user_id, active_organization_id)
          values (${id("s-" + token.slice(0, 8))}, now() + interval '1 hour', ${token}, now(), now(), ${userId}, ${activeOrg})`
  const sig = crypto.createHmac("sha256", secret).update(token).digest("base64")
  return `better-auth.session_token=${encodeURIComponent(`${token}.${sig}`)}`
}

async function call(path: string, opts: { method?: string; cookie?: string; body?: unknown; base?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { origin: BASE, ...(opts.headers ?? {}) }
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.body !== undefined) headers["content-type"] = "application/json"
  const res = await fetch(`${opts.base ?? BASE}${path}`, {
    method: opts.method ?? "GET", headers, redirect: "manual",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const text = await res.text()
  let body: any = text
  try { body = JSON.parse(text) } catch {}
  return { status: res.status, body, location: res.headers.get("location") }
}

async function setup() {
  for (const u of ["a", "b", "c", "m", "m2"]) {
    await q`insert into "user" (id, name, email, email_verified, created_at, updated_at)
            values (${id(u)}, ${"Sec " + u}, ${`sec-${u}-${tag}@scrunity-test.invalid`}, true, now(), now())`
  }
  await q`delete from "user" where email = ${ADMIN_EMAIL}`
  await q`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id("admin")}, 'Sec admin', ${ADMIN_EMAIL}, true, now(), now())`
  for (const [o, plan] of [["A", "pilot"], ["B", "pilot"], ["C", "free"], ["ADM", "free"]]) {
    await q`insert into organization (id, name, slug, plan, created_at, updated_at) values (${id("org" + o)}, ${"Sec " + o}, ${id("slug" + o)}, ${plan}, now(), now())`
  }
  for (const [u, o, role] of [["a", "A", "owner"], ["b", "B", "owner"], ["c", "C", "owner"], ["m", "A", "member"], ["m2", "A", "member"], ["admin", "ADM", "owner"]]) {
    await q`insert into member (id, organization_id, user_id, role, created_at) values (${id("mem-" + u)}, ${id("org" + o)}, ${id(u)}, ${role}, now())`
  }
  for (const o of ["A", "B"]) {
    await q`insert into gtm_ai_credit_period (id, organization_id, period_start, period_end, plan, plan_allotment, credits_used, credits_remaining)
            values (${id("period" + o)}, ${id("org" + o)}, now() - interval '1 hour', now() + interval '30 days', 'pilot', 300, 0, 300)`
  }
  await q`insert into gtm_research_run (id, organization_id, created_by, website_url, company_name, company_description, company_size, status, current_stage)
          values (${id("run")}, ${id("orgA")}, ${id("a")}, 'https://sec-a.example', 'Sec A', 'x', '11-50', 'done', 'done')`
  for (const s of ["s1", "s2", "s3"]) {
    await q`insert into gtm_icp_segment (id, research_run_id, name, pain_point, criteria, example_companies, target_keywords)
            values (${id(s)}, ${id("run")}, ${s}, 'x', '["x"]', '[]', '["x"]')`
  }
  await q`insert into gtm_outreach_campaign (id, icp_segment_id, research_run_id, status, current_stage)
          values (${id("camp")}, ${id("s1")}, ${id("run")}, 'awaiting_approval', 'awaiting_approval')`
  await q`insert into gtm_prospect_company (id, outreach_campaign_id, name, domain, description, location)
          values (${id("co")}, ${id("camp")}, 'Sec Prospect', ${`sec-${tag}.example`}, 'x', 'IN')`
  const contacts: [string, string, string][] = [
    ["ct1", "Rahul Verma", "rahul"], ["ct2", "Anita Desai", "anita"], ["ct3", "Priya Sharma", "priya"], ["ct4", "Kiran Rao", "kiran"],
  ]
  for (const [k, name, local] of contacts) {
    await q`insert into gtm_contact (id, prospect_company_id, name, title, email, email_source, verification_status, linkedin_url)
            values (${id(k)}, ${id("co")}, ${name}, 'CEO', ${`${local}@sec-${tag}.example`}, 'enrich_verified', 'enrich_verified', ${`https://www.linkedin.com/in/sec-${local}`})`
  }
  await q`insert into gtm_email_draft (id, contact_id, outreach_campaign_id, subject, body, status, error_message)
          values (${id("d1")}, ${id("ct1")}, ${id("camp")}, 's', 'b', 'rejected', 'aggregator job-board domain — pending re-discovery')`
  await q`insert into gtm_email_draft (id, contact_id, outreach_campaign_id, subject, body, status) values (${id("d2")}, ${id("ct2")}, ${id("camp")}, 's', 'b', 'draft')`
  await q`insert into gtm_email_draft (id, contact_id, outreach_campaign_id, subject, body, status) values (${id("d3")}, ${id("ct3")}, ${id("camp")}, 's', 'b', 'draft')`
  // A hard bounce recorded by another organization is platform-wide.
  await q`insert into gtm_suppression_entry (id, email, domain, reason, source_org_id, is_real_send_bounce)
          values (${id("sup")}, ${`anita@sec-${tag}.example`}, ${`sec-${tag}.example`}, 'hard_bounce', ${id("orgB")}, true)`
  // Kiran opted out of organization A.
  await q`insert into gtm_do_not_contact (id, organization_id, email, reason, contact_id) values (${id("dnc")}, ${id("orgA")}, ${`kiran@sec-${tag}.example`}, 'opt_out', ${id("ct4")})`
}

async function run() {
  const A = await cookieFor(id("a"), id("orgA"))
  const B = await cookieFor(id("b"), id("orgB"))
  const C = await cookieFor(id("c"), id("orgC"))
  const ADMIN = await cookieFor(id("admin"), id("orgADM"))

  console.log("\nA1 plan and billing fields are not customer-writable")
  const up = await call("/api/organizations", { method: "PATCH", cookie: A, body: { orgId: id("orgA"), plan: "scale" } })
  const planAfter = await one<{ plan: string }>`select plan from organization where id = ${id("orgA")}`
  check("PATCH plan=scale as owner is refused", up.status === 400, `${up.status} ${JSON.stringify(up.body)}`)
  check("plan unchanged", planAfter.plan === "pilot", planAfter.plan)
  const cur = await call("/api/organizations", { method: "PATCH", cookie: A, body: { orgId: id("orgA"), name: "Renamed A", globalCurrency: "INR" } })
  check("PATCH with another billing field (globalCurrency) is refused", cur.status === 400, `${cur.status}`)
  const rename = await call("/api/organizations", { method: "PATCH", cookie: A, body: { orgId: id("orgA"), name: "Renamed A" } })
  const nameAfter = await one<{ name: string }>`select name from organization where id = ${id("orgA")}`
  check("control: renaming the org still works", rename.status === 200 && nameAfter.name === "Renamed A", `${rename.status} ${nameAfter.name}`)
  const grant = await call(`/api/admin/organizations/${id("orgA")}/credits`, { method: "POST", cookie: ADMIN, body: { amount: 25, reason: "security test grant", requestId: crypto.randomUUID() } })
  const bal = await one<{ credits_remaining: number }>`select credits_remaining from gtm_ai_credit_period where id = ${id("periodA")}`
  check("control: admin grant still works", grant.status === 200 && bal.credits_remaining === 325, `${grant.status} balance ${bal.credits_remaining}`)

  console.log("\nA2 ?test_org= impersonation is off in a production build")
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address
  const probes: [string, string, Record<string, string>][] = [
    ["localhost", BASE, {}],
    ...(lan ? ([[`LAN ${lan}`, `http://${lan}:3000`, {}], [`LAN ${lan} + Host: localhost`, `http://${lan}:3000`, { host: "localhost:3000" }]] as [string, string, Record<string, string>][]) : []),
  ]
  for (const [label, base, headers] of probes) {
    const r = await call(`/api/gtm/campaigns?test_org=${id("orgA")}`, { base, headers })
    check(`${label}: /api/gtm/campaigns?test_org=<A> without a session -> 401, no data`, r.status === 401 && !JSON.stringify(r.body).includes(id("camp")), `${r.status}`)
    const cookieProbe = await call(`/api/gtm/campaigns`, { base, headers: { ...headers, cookie: `test_org=${id("orgA")}` } })
    check(`${label}: test_org cookie -> 401`, cookieProbe.status === 401, `${cookieProbe.status}`)
  }
  const spoof = await call(`/api/gtm/campaigns`, { headers: { "x-user-id": id("a"), "x-org-id": id("orgA"), "x-org-role": "owner" } })
  check("forged x-user-id / x-org-id headers without a session -> 401", spoof.status === 401, `${spoof.status}`)
  const page = await call(`/dashboard/campaigns?test_org=${id("orgA")}`)
  check("dashboard with test_org and no session -> redirect to sign-in", page.status === 307 && (page.location ?? "").includes("/sign-in"), `${page.status} ${page.location}`)

  console.log("\nA3 removed members are refused on their very next call")
  const M = await cookieFor(id("m"), id("orgA"))
  const M2 = await cookieFor(id("m2"), id("orgA"))
  const before = await call(`/api/gtm/campaigns/${id("camp")}`, { cookie: M })
  check("member can read the campaign before removal", before.status === 200, `${before.status}`)
  const removal = await call(`/api/auth/organization/remove-member`, { method: "POST", cookie: A, body: { memberIdOrEmail: id("mem-m"), organizationId: id("orgA") } })
  check("owner removes the member through Better Auth", removal.status === 200, `${removal.status} ${JSON.stringify(removal.body).slice(0, 120)}`)
  const after = await call(`/api/gtm/campaigns/${id("camp")}`, { cookie: M })
  check("removed member's next API call -> 403", after.status === 403, `${after.status} ${JSON.stringify(after.body)}`)
  const leadsAfter = await call(`/api/gtm/leads`, { cookie: M })
  check("removed member: leads list refused too", leadsAfter.status === 403, `${leadsAfter.status}`)
  const sess = await one<{ n: number }>`select count(*)::int n from session where user_id = ${id("m")} and active_organization_id is not null`
  check("removed member's sessions no longer have the org active", sess.n === 0, `${sess.n} active`)
  const other = await call(`/api/gtm/campaigns/${id("camp")}`, { cookie: M2 })
  check("control: remaining member unaffected", other.status === 200, `${other.status}`)

  console.log("\nA4 blocked drafts cannot be approved by a client call")
  const d = (k: string) => `/api/gtm/campaigns/${id("camp")}/drafts/${id(k)}`
  const r1 = await call(d("d1"), { method: "POST", cookie: A, body: { action: "approve" } })
  check("re-approving a rejected (disqualified) draft -> 409", r1.status === 409, `${r1.status} ${r1.body?.error}`)
  const r2 = await call(d("d2"), { method: "POST", cookie: A, body: { action: "approve" } })
  check("approving a draft for a hard-bounced address -> 409", r2.status === 409, `${r2.status} ${r2.body?.error}`)
  const r3 = await call(d("d3"), { method: "POST", cookie: A, body: { action: "approve" } })
  check("control: approving a normal verified draft -> 200", r3.status === 200 && r3.body?.draft?.status === "approved", `${r3.status}`)
  const send1 = await call(`/api/gtm/leads/${id("ct1")}/send`, { method: "POST", cookie: A, body: { approveFirst: true } })
  check("lead send on a rejected draft -> 409 (not re-approved)", send1.status === 409, `${send1.status} ${send1.body?.error}`)
  const states = (await q`select id, status from gtm_email_draft where id in (${id("d1")}, ${id("d2")}, ${id("d3")}) order by id`).rows
  check("draft states after the attempts: d1 rejected, d2 draft, d3 approved",
    JSON.stringify(states.map((s: any) => s.status)) === JSON.stringify(["rejected", "draft", "approved"]), JSON.stringify(states))

  console.log("\nA5 opted-out contact cannot be drafted (HTTP part)")
  const dnc = await call(`/api/gtm/leads/${id("ct4")}/draft`, { method: "POST", cookie: A })
  check("drafting for an opted-out contact -> 422 before any LLM call", dnc.status === 422, `${dnc.status} ${dnc.body?.error}`)

  console.log("\nA6 spend quotas")
  const research = (cookie: string, n: number) => call("/api/gtm/research-runs", {
    method: "POST", cookie,
    body: { websiteUrl: `https://sec-${tag}-${n}.example`, companyName: `Sec ${n}`, companyDescription: "security test", companySize: "11-50", targetCountryCode: "IN" },
  })
  const noPlan = await research(C, 0)
  check("org with no plan and no credits cannot start a research run", noPlan.status === 403, `${noPlan.status} ${noPlan.body?.error}`)
  const ra = [await research(A, 1), await research(A, 2), await research(A, 3)]
  check("org A: runs 1-2 accepted, run 3 over quota -> 429", ra[0].status === 201 && ra[1].status === 201 && ra[2].status === 429, ra.map((r) => r.status).join(","))
  check("over-quota message is plain", typeof ra[2].body?.error === "string" && ra[2].body.error.includes("today"), ra[2].body?.error)
  const rb = await research(B, 4)
  check("org B unaffected by A's quota", rb.status === 201, `${rb.status}`)
  const camp = (seg: string) => call("/api/gtm/campaigns", { method: "POST", cookie: A, body: { icpSegmentId: id(seg) } })
  const c1 = await camp("s2")
  const c2 = await camp("s3")
  check("campaign quota: 1st accepted, 2nd over quota -> 429", c1.status === 201 && c2.status === 429, `${c1.status},${c2.status}`)
  const logos = []
  for (let i = 0; i < 4; i++) logos.push((await call(`/api/gtm/fetch-logo?url=sec-${i}.example`, { cookie: A })).status)
  check("logo lookups: 3 allowed, 4th -> 429", logos.join(",") === "200,200,200,429", logos.join(","))
  const logoB = await call(`/api/gtm/fetch-logo?url=sec.example`, { cookie: B })
  check("logo quota: org B unaffected", logoB.status === 200, `${logoB.status}`)
  const chat = await call("/api/gtm/chat", { method: "POST", cookie: A, body: { messages: [{ role: "user", content: "hi" }] } })
  check("chat over quota -> 429 before any model call", chat.status === 429, `${chat.status} ${chat.body?.error}`)
  const runs = (await q`select current_stage, status from gtm_research_run where organization_id in (${id("orgA")}, ${id("orgB")}) and id <> ${id("run")}`).rows
  check("created runs were only queued (still at research_company, nothing executed in-process)",
    runs.length === 3 && runs.every((r: any) => r.current_stage === "research_company"), JSON.stringify(runs))
}

async function cleanup() {
  await q`delete from gtm_suppression_entry where id = ${id("sup")}`
  await q`delete from gtm_vendor_usage where organization_id like ${`sec-${tag}-%`}`
  await q`delete from organization where id like ${`sec-${tag}-%`}`
  await q`delete from "user" where id like ${`sec-${tag}-%`}`
  const left = await one<Record<string, number>>`select
    (select count(*) from "user" where id like ${`sec-${tag}-%`})::int users,
    (select count(*) from organization where id like ${`sec-${tag}-%`})::int orgs,
    (select count(*) from session where user_id like ${`sec-${tag}-%`})::int sessions,
    (select count(*) from member where id like ${`sec-${tag}-%`})::int members,
    (select count(*) from gtm_research_run where organization_id like ${`sec-${tag}-%`})::int runs,
    (select count(*) from gtm_email_draft where id like ${`sec-${tag}-%`})::int drafts,
    (select count(*) from gtm_suppression_entry where id like ${`sec-${tag}-%`})::int suppression,
    (select count(*) from gtm_do_not_contact where organization_id like ${`sec-${tag}-%`})::int dnc,
    (select count(*) from org_usage_counter where organization_id like ${`sec-${tag}-%`})::int counters,
    (select count(*) from gtm_ai_credit_transaction where organization_id like ${`sec-${tag}-%`})::int ledger`
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
