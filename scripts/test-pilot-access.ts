/**
 * Verifies pilot access end to end against `npm run dev` and the real DB:
 * the platform admin gate, pilot invites (create, duplicate, revoke, claim
 * under a concurrent double submit, retry after a half-applied claim), manual
 * credit grants, set plan, the "no access yet" message and magic-link sign-in.
 *
 * No email is sent and no vendor is called: start the dev server with the
 * console mailer and log its output to a file, e.g.
 *
 *   PLATFORM_ADMIN_EMAILS=pilot-admin@scrunity-test.invalid MAGIC_LINK_MAILER=console \
 *     npm run dev > dev.log 2>&1     (or npm run build && npm run start, much faster)
 *   DEV_LOG=dev.log npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-pilot-access.ts
 *
 * Everything it creates (users, orgs, invites, ledger rows, tokens) is deleted at the end.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { eq, inArray, like } from "drizzle-orm"
import { db } from "../src/utils/db"
import { gtmIcpSegment, gtmResearchRun, organization, pilotInvite, user, verification } from "../src/db/schema"
import { onboardingOrganizationId } from "../src/lib/onboarding-id"
import { activateOrganizationPlan } from "../src/lib/billing-plan"
import { addTopupCredits } from "../src/lib/gtm-ai-credits"
import { resolveCampaignAccess } from "../src/lib/pilot/access"
import { magicLinkRateIdentifier } from "../src/lib/magic-link"
import {
  check, createdUserIds, grantRows, http, linksInLog, newUser, onboard, orgCredits, pause, sessionCookie,
} from "./support/pilot-test-helpers"

const ADMIN_EMAIL = "pilot-admin@scrunity-test.invalid"
const DEV_LOG = process.env.DEV_LOG
if (!DEV_LOG) throw new Error("Set DEV_LOG to the dev server's log file (see header)")
const tag = crypto.randomBytes(4).toString("hex")
const email = (label: string) => `pilot-${label}-${tag}@scrunity-test.invalid`
const ip = `10.${crypto.randomInt(255)}.${crypto.randomInt(255)}.${crypto.randomInt(255)}`

async function adminGate(admin: { cookie: string }, outsider: { cookie: string; orgId: string }) {
  console.log("\n1. Admin gate")
  const adminApis: [string, string][] = [
    ["POST", "/api/admin/invites"],
    ["DELETE", "/api/admin/invites/x"],
    ["POST", `/api/admin/organizations/${outsider.orgId}/credits`],
    ["POST", `/api/admin/organizations/${outsider.orgId}/plan`],
    ["GET", "/api/gtm/admin/suppression"],
  ]
  const page = await http("/dashboard/admin", { cookie: outsider.cookie })
  check("non-admin: /dashboard/admin is 404", page.status === 404, `${page.status}`)
  const impersonated = await http(`/dashboard/admin?test_org=${outsider.orgId}`)
  check("localhost test_org impersonation: /dashboard/admin is 404", impersonated.status === 404, `${impersonated.status}`)
  for (const [method, path] of adminApis) {
    const res = await http(path, { method, cookie: outsider.cookie, body: method === "GET" ? undefined : { plan: "scale", amount: 999, reason: "nope", requestId: "x".repeat(12), emails: email("evil") } })
    check(`non-admin: ${method} ${path} is 404`, res.status === 404, `${res.status}`)
    const anon = await http(path, { method, body: method === "GET" ? undefined : {} })
    check(`signed out: ${method} ${path} is 401/404`, anon.status === 404 || anon.status === 401, `${anon.status}`)
  }
  const [evil] = await db.select().from(pilotInvite).where(eq(pilotInvite.email, email("evil")))
  check("non-admin calls created nothing", !evil)
  const adminPage = await http("/dashboard/admin", { cookie: admin.cookie })
  const html = await adminPage.text()
  check("admin: /dashboard/admin renders", adminPage.status === 200 && html.includes("Platform admin"), `${adminPage.status}`)
  const supp = await http("/api/gtm/admin/suppression", { cookie: admin.cookie })
  check("admin: suppression inspection works", supp.status === 200, `${supp.status}`)
}

async function invites(admin: { cookie: string }) {
  console.log("\n2. Invites: create, duplicate, revoke")
  const add = (emails: string, credits: number) =>
    http("/api/admin/invites", { method: "POST", cookie: admin.cookie, body: { emails, plan: "pilot", credits, note: `test ${tag}` } })
  const r1 = await (await add(`${email("a")}, ${email("b")}\n${email("d")} ${email("e")} not-an-email`, 50)).json()
  check("4 invites created, invalid one reported", r1.results.filter((r: { outcome: string }) => r.outcome === "created").length === 4 && r1.invalid.includes("not-an-email"), JSON.stringify(r1.invalid))
  const r2 = await (await add(email("A").toUpperCase(), 50)).json()
  const rowsA = await db.select().from(pilotInvite).where(eq(pilotInvite.email, email("a")))
  check("re-adding (different case) updates, no duplicate", r2.results[0]?.outcome === "updated" && rowsA.length === 1, `${r2.results[0]?.outcome}, ${rowsA.length} row(s)`)
  const [b] = await db.select().from(pilotInvite).where(eq(pilotInvite.email, email("b")))
  const rev = await http(`/api/admin/invites/${b.id}`, { method: "DELETE", cookie: admin.cookie })
  const rev2 = await http(`/api/admin/invites/${b.id}`, { method: "DELETE", cookie: admin.cookie })
  check("revoke unclaimed invite: 200, then 409", rev.status === 200 && rev2.status === 409, `${rev.status}, ${rev2.status}`)
}

async function claims() {
  console.log("\n3. Claim on onboarding (concurrent double submit)")
  const a = await newUser(email("a"))
  const orgA = onboardingOrganizationId(a.userId)
  const [s1, s2] = await Promise.all([onboard(a.cookie, `Pilot A ${tag}`), onboard(a.cookie, `Pilot A ${tag}`)])
  const resub = await onboard(a.cookie, `Pilot A ${tag}`)
  const ca = await orgCredits(orgA)
  const [inviteA] = await db.select().from(pilotInvite).where(eq(pilotInvite.email, email("a")))
  check("both submits and a resubmit succeed", s1.ok && s2.ok && resub.ok, `${s1.status} ${s2.status} ${resub.status}`)
  check("org is on pilot", ca.plan === "pilot", ca.plan)
  check("balance = 300 pilot + 50 invited = 350", ca.creditsRemaining === 350, `${ca.creditsRemaining}`)
  check("exactly one manual_grant ledger row", ca.manualGrants.length === 1 && ca.manualGrants[0].amount === 50, `${ca.manualGrants.length}`)
  check("exactly one pilot plan reset", ca.resets.length === 1, `${ca.resets.length}`)
  check("invite marked claimed for this org", inviteA.status === "claimed" && inviteA.claimedOrgId === orgA, inviteA.status)

  console.log("\n4. Revoked and missing invites grant nothing")
  for (const label of ["b", "c"]) {
    const u = await newUser(email(label))
    await onboard(u.cookie, `Pilot ${label} ${tag}`)
    const c = await orgCredits(onboardingOrganizationId(u.userId))
    check(`${label === "b" ? "revoked" : "no"} invite: free plan, 0 credits, no grant`, c.plan === "free" && c.creditsRemaining === 0 && c.manualGrants.length === 0, `${c.plan} ${c.creditsRemaining}`)
  }

  console.log("\n5. A claim that failed halfway is completed by a retry")
  // d: crashed after the plan was applied, before the credits (stale lease).
  // e: crashed after the credits were granted, before that was recorded.
  for (const label of ["d", "e"]) {
    const u = await newUser(email(label))
    const orgId = onboardingOrganizationId(u.userId)
    await db.insert(organization).values({ id: orgId, name: `Half ${label}`, slug: `half-${label}-${tag}` })
    const [inv] = await db.select().from(pilotInvite).where(eq(pilotInvite.email, email(label)))
    await activateOrganizationPlan(orgId, "pilot")
    if (label === "e") {
      await addTopupCredits(orgId, 50, "Pilot access (pre-crash)", { type: "manual_grant", idempotencyKey: `pilot_invite:${inv.id}` })
    }
    await db.update(pilotInvite).set({
      claimedOrgId: orgId, claimedUserId: u.userId, planAppliedAt: new Date(), claimLockedAt: new Date(Date.now() - 10 * 60 * 1000),
    }).where(eq(pilotInvite.id, inv.id))
    const retry = await onboard(u.cookie, `Half ${label}`)
    const c = await orgCredits(orgId)
    const [after] = await db.select().from(pilotInvite).where(eq(pilotInvite.id, inv.id))
    check(`${label}: retry succeeds and the invite is claimed`, retry.ok && after.status === "claimed", `${retry.status} ${after.status}`)
    check(`${label}: balance 350, one grant row, one plan reset`, c.creditsRemaining === 350 && c.manualGrants.length === 1 && c.resets.length === 1, `${c.creditsRemaining}, ${c.manualGrants.length}, ${c.resets.length}`)
  }
  return a
}

async function noAccessAndLateInvite(admin: { cookie: string }) {
  console.log("\n6. No plan: clear message; an invite added after onboarding is applied on access check")
  const c = await db.select().from(user).where(eq(user.email, email("c")))
  const cookie = await sessionCookie(c[0].id)
  const orgC = onboardingOrganizationId(c[0].id)
  const [run] = await db.insert(gtmResearchRun).values({
    organizationId: orgC, createdBy: c[0].id, websiteUrl: "https://pilot-test.example", companyName: "C",
    companyDescription: "x", companySize: "11-50", status: "done", currentStage: "done",
  }).returning()
  const [segment] = await db.insert(gtmIcpSegment).values({
    researchRunId: run.id, name: "seg", painPoint: "x", criteria: ["x"], exampleCompanies: [], targetKeywords: ["x"],
  }).returning()
  const res = await http("/api/gtm/campaigns", { method: "POST", cookie, body: { icpSegmentId: segment.id } })
  const body = await res.json()
  check("launching a campaign without a plan: 403 with the no-access message", res.status === 403 && /doesn't have access yet\. Contact \S+@\S+/.test(body.error), `${res.status} ${body.error}`)

  await http("/api/admin/invites", { method: "POST", cookie: admin.cookie, body: { emails: email("c"), plan: "starter", credits: 0 } })
  const access = await resolveCampaignAccess(orgC, c[0].id)
  const cc = await orgCredits(orgC)
  check("late invite is claimed by the access check", access.hasAccess && cc.plan === "starter" && cc.creditsRemaining === 600, `${cc.plan} ${cc.creditsRemaining}`)
  return orgC
}

async function manualGrants(admin: { cookie: string; userId: string }, orgId: string) {
  console.log("\n7. Manual grant and set plan")
  const before = await orgCredits(orgId)
  const requestId = crypto.randomUUID()
  const grant = () => http(`/api/admin/organizations/${orgId}/credits`, {
    method: "POST", cookie: admin.cookie, body: { amount: 25, reason: `paid ₹999 directly, invoice ${tag}`, requestId },
  })
  const [g1, g2] = await Promise.all([grant(), grant()])
  const after = await orgCredits(orgId)
  const rows = (await grantRows(orgId)).filter((r) => (r.description ?? "").includes(`invoice ${tag}`))
  check("double-submitted grant: both 200", g1.ok && g2.ok, `${g1.status} ${g2.status}`)
  check("balance changed by exactly 25", after.creditsRemaining - before.creditsRemaining === 25, `${before.creditsRemaining} -> ${after.creditsRemaining}`)
  check("one ledger row with the reason and the admin id", rows.length === 1 && rows[0].createdByUserId === admin.userId, `${rows.length} row(s)`)
  const noReason = await http(`/api/admin/organizations/${orgId}/credits`, { method: "POST", cookie: admin.cookie, body: { amount: 5, reason: "", requestId: crypto.randomUUID() } })
  check("grant without a reason is refused", noReason.status === 400, `${noReason.status}`)
  const plan = await http(`/api/admin/organizations/${orgId}/plan`, { method: "POST", cookie: admin.cookie, body: { plan: "growth" } })
  const p = await orgCredits(orgId)
  check("set plan growth: plan, active status, 1800 credits", plan.ok && p.plan === "growth" && p.subscriptionStatus === "active" && p.creditsRemaining === 1800, `${p.plan} ${p.subscriptionStatus} ${p.creditsRemaining}`)
}

async function magicLinks(admin: { cookie: string }) {
  console.log("\n8. Magic link")
  await http("/api/admin/invites", { method: "POST", cookie: admin.cookie, body: { emails: email("g"), plan: "pilot", credits: 10 } })
  const request = (to: string, from = ip) => http("/api/auth/sign-in/magic-link", {
    method: "POST", ip: from, body: { email: to, callbackURL: "/dashboard", newUserCallbackURL: "/onboarding", errorCallbackURL: "/sign-in" },
  })
  const t0 = performance.now()
  const invited = await request(email("g"))
  const t1 = performance.now()
  const stranger = await request(email("h"))
  const t2 = performance.now()
  const [bi, bs] = [await invited.text(), await stranger.text()]
  check("invited and uninvited get the identical response", invited.status === stranger.status && bi === bs, `${invited.status} ${bi} | ${stranger.status} ${bs}`)
  console.log(`   response times: invited ${(t1 - t0).toFixed(0)}ms, uninvited ${(t2 - t1).toFixed(0)}ms`)
  await pause(2500)
  const linksG = linksInLog(DEV_LOG!, email("g"))
  check("invited email got a link (console mailer)", linksG.length === 1, `${linksG.length}`)
  check("uninvited email got no link", linksInLog(DEV_LOG!, email("h")).length === 0)
  check("link uses the public base URL with absolute callbacks", linksG[0]?.startsWith("http://localhost:3000/api/auth/magic-link/verify") && decodeURIComponent(linksG[0]).includes("callbackURL=http://localhost:3000/dashboard"))

  const first = await fetch(linksG[0], { redirect: "manual" })
  const cookie = (first.headers.get("set-cookie") ?? "").match(/better-auth\.session_token=[^;]+/)?.[0] ?? ""
  check("first click signs in a new user and goes to onboarding", first.status === 302 && (first.headers.get("location") ?? "").endsWith("/onboarding") && Boolean(cookie), `${first.status} -> ${first.headers.get("location")}`)
  const reuse = await fetch(linksG[0], { redirect: "manual" })
  check("reusing the link fails", (reuse.headers.get("location") ?? "").includes("error=INVALID_TOKEN"), `${reuse.status} -> ${reuse.headers.get("location")}`)

  await request(email("g"))
  await pause(2500)
  const second = linksInLog(DEV_LOG!, email("g"))[1]
  await db.update(verification).set({ expiresAt: new Date(Date.now() - 60_000) }).where(like(verification.value, `%${email("g")}%`))
  const expired = await fetch(second, { redirect: "manual" })
  check("an expired link fails", (expired.headers.get("location") ?? "").includes("error="), `${expired.status} -> ${expired.headers.get("location")}`)

  const [g] = await db.select().from(user).where(eq(user.email, email("g")))
  if (g) createdUserIds.push(g.id)
  const ob = await onboard(cookie, `Pilot G ${tag}`)
  const dash = await http("/dashboard", { cookie })
  const cg = await orgCredits(onboardingOrganizationId(g.id))
  check("new magic-link user onboards and reaches /dashboard", ob.ok && dash.status === 200, `${ob.status} ${dash.status}`)
  check("with the invited plan and credits (300 + 10)", cg.plan === "pilot" && cg.creditsRemaining === 310, `${cg.plan} ${cg.creditsRemaining}`)

  console.log("   rate limits")
  for (let i = 0; i < 5; i++) await request(email("g"), `10.99.${crypto.randomInt(255)}.${i}`)
  await pause(3000)
  // g has made 2 earlier requests in this window; at most 3 per email are delivered.
  check("per-email: at most 3 links in the window", linksInLog(DEV_LOG!, email("g")).length === 3, `${linksInLog(DEV_LOG!, email("g")).length}`)
  const busyIp = `10.98.${crypto.randomInt(255)}.${crypto.randomInt(255)}`
  for (let i = 0; i < 10; i++) await request(email(`x${i}`), busyIp)
  await http("/api/admin/invites", { method: "POST", cookie: admin.cookie, body: { emails: email("k"), plan: "pilot" } })
  const limited = await request(email("k"), busyIp)
  await pause(2500)
  // In production Better Auth also answers 429 after 5/min per IP (for any email); either way nothing is sent.
  check("per-IP: 11th request from one IP sends nothing", [200, 429].includes(limited.status) && linksInLog(DEV_LOG!, email("k")).length === 0, `${limited.status}`)
}

async function cleanup() {
  const orgIds = createdUserIds.map(onboardingOrganizationId)
  await db.delete(organization).where(inArray(organization.id, orgIds))
  await db.delete(pilotInvite).where(like(pilotInvite.email, `pilot-%-${tag}@scrunity-test.invalid`))
  await db.delete(verification).where(like(verification.value, `%-${tag}@scrunity-test.invalid%`))
  const rateMarkers = ["g", "h", "k", ...Array.from({ length: 10 }, (_, i) => `x${i}`)].map((l) => magicLinkRateIdentifier(email(l)))
  await db.delete(verification).where(inArray(verification.identifier, rateMarkers))
  await db.delete(user).where(inArray(user.id, createdUserIds))
  console.log(`\nCleanup: ${createdUserIds.length} users, their orgs, invites and tokens removed`)
}

async function main() {
  await db.delete(user).where(eq(user.email, ADMIN_EMAIL))
  const admin = await newUser(ADMIN_EMAIL)
  await onboard(admin.cookie, `Pilot Admin ${tag}`) // the founder has an org; /dashboard/* needs one
  const outsider = await newUser(email("outsider"))
  await onboard(outsider.cookie, `Outsider ${tag}`)
  await adminGate(admin, { cookie: outsider.cookie, orgId: onboardingOrganizationId(outsider.userId) })
  await invites(admin)
  await claims()
  const orgC = await noAccessAndLateInvite(admin)
  await manualGrants(admin, orgC)
  await magicLinks(admin)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => cleanup().then(() => process.exit()))
