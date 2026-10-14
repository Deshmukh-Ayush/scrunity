/**
 * Verifies real onboarding end to end against `npm run dev` and the real DB.
 *
 *   npx tsx scripts/test-onboarding.ts            # BASE_URL defaults to http://localhost:3000
 *
 * Users are created through Better Auth's own internal adapter, the same calls
 * its Google OAuth callback makes (createOAuthUser + createSession), because a
 * script cannot complete a Google consent screen. Everything after that goes
 * over HTTP through the proxy and /api/onboarding. All created users and orgs
 * are deleted at the end. No vendor calls.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { auth } from "../src/lib/auth"
import { onboardingOrganizationId } from "../src/lib/onboarding-id"
import { db } from "../src/utils/db"
import { member, organization, user } from "../src/db/schema"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const tag = crypto.randomBytes(4).toString("hex")
const createdUserIds: string[] = []

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

/** A brand-new Google user with a live session, exactly as the OAuth callback creates them. */
async function newOAuthUser(label: string) {
  const ctx = await auth.$context
  const { user: created } = await ctx.internalAdapter.createOAuthUser(
    {
      name: `Onboarding Test ${label}`,
      email: `onboarding-${label}-${tag}@scrunity-test.invalid`,
      emailVerified: true,
      image: null,
    },
    { providerId: "google", accountId: `test-${label}-${tag}` }
  )
  createdUserIds.push(created.id)
  const session = await ctx.internalAdapter.createSession(created.id)
  const signature = crypto
    .createHmac("sha256", ctx.secret)
    .update(session.token)
    .digest("base64")
  const cookie = `better-auth.session_token=${encodeURIComponent(`${session.token}.${signature}`)}`
  return { userId: created.id, cookie }
}

const get = (path: string, cookie?: string) =>
  fetch(`${BASE_URL}${path}`, { redirect: "manual", headers: cookie ? { cookie } : {} })

const submit = (name: string, cookie?: string) =>
  fetch(`${BASE_URL}/api/onboarding`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ name }),
  })

async function membershipsOf(userId: string) {
  return db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, userId))
}

async function activeOrgOf(cookie: string) {
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
  return session?.session.activeOrganizationId ?? null
}

async function main() {
  const orgName = `Acme Onboarding ${tag}`

  console.log("\n1. Brand-new OAuth user, no organization")
  const a = await newOAuthUser("a")
  check("session cookie is accepted by Better Auth", (await auth.api.getSession({ headers: new Headers({ cookie: a.cookie }) })) !== null)
  check("user starts with zero memberships", (await membershipsOf(a.userId)).length === 0)
  const dash = await get("/dashboard", a.cookie)
  check("/dashboard redirects to /onboarding", dash.status === 307 && (dash.headers.get("location") ?? "").endsWith("/onboarding"), `${dash.status} -> ${dash.headers.get("location")}`)
  const onb = await get("/onboarding", a.cookie)
  check("/onboarding renders for them", onb.status === 200 && (await onb.text()).includes("Create your organization"), `${onb.status}`)

  console.log("\n2. Double submit (two concurrent requests) plus a later resubmit")
  const [r1, r2] = await Promise.all([submit(orgName, a.cookie), submit(orgName, a.cookie)])
  const b1 = await r1.json()
  const b2 = await r2.json()
  console.log("   responses:", r1.status, b1, "|", r2.status, b2)
  const r3 = await submit(`${orgName} again`, a.cookie)
  const b3 = await r3.json()
  console.log("   resubmit:", r3.status, b3)
  const expectedOrgId = onboardingOrganizationId(a.userId)
  const orgs = await db.select().from(organization).where(eq(organization.id, expectedOrgId))
  const memberships = await membershipsOf(a.userId)
  check("both concurrent requests succeeded", r1.ok && r2.ok)
  check("exactly one of them created the org", [b1.status, b2.status].filter((s) => s === "created").length === 1)
  check("resubmit returned the existing org", r3.status === 200 && b3.status === "existing" && b3.organizationId === expectedOrgId)
  check("exactly one organization row", orgs.length === 1, orgs.map((o) => `${o.id} slug=${o.slug} plan=${o.plan}`).join(", "))
  check("exactly one membership, role owner", memberships.length === 1 && memberships[0].role === "owner", JSON.stringify(memberships))
  check("organization is active on the session", (await activeOrgOf(a.cookie)) === expectedOrgId)
  check("new org gets the default plan", orgs[0]?.plan === "free", orgs[0]?.plan)

  console.log("\n3. User with an organization")
  const onbAgain = await get("/onboarding", a.cookie)
  check("/onboarding redirects to /dashboard", onbAgain.status === 307 && (onbAgain.headers.get("location") ?? "").endsWith("/dashboard"), `${onbAgain.status} -> ${onbAgain.headers.get("location")}`)
  const dashAgain = await get("/dashboard", a.cookie)
  const dashHtml = await dashAgain.text()
  check("/dashboard renders the campaigns view", dashAgain.status === 200 && dashHtml.includes("Outreach Campaigns"), `${dashAgain.status}`)

  console.log("\n4. Name collision with another user's organization")
  const b = await newOAuthUser("b")
  const rb = await submit(orgName, b.cookie)
  const bb = await rb.json()
  const [orgB] = await db.select().from(organization).where(eq(organization.id, onboardingOrganizationId(b.userId)))
  check("second user with the same name still gets an org", rb.status === 201 && bb.status === "created", `${rb.status}`)
  check("with a different slug", Boolean(orgB) && orgB.slug !== orgs[0]?.slug, `${orgs[0]?.slug} vs ${orgB?.slug}`)

  console.log("\n5. Retry after a partial failure (org row written, membership missing)")
  const c = await newOAuthUser("c")
  await db.insert(organization).values({ id: onboardingOrganizationId(c.userId), name: "Half Created", slug: `half-created-${tag}` })
  const rc = await submit("Half Created", c.cookie)
  const bc = await rc.json()
  const membershipsC = await membershipsOf(c.userId)
  check("retry resumes instead of failing", rc.status === 200 && bc.status === "resumed", `${rc.status} ${bc.status}`)
  check("owner membership now exists, once", membershipsC.length === 1 && membershipsC[0].role === "owner")
  check("and is active on the session", (await activeOrgOf(c.cookie)) === onboardingOrganizationId(c.userId))

  console.log("\n6. Existing user who has no organization (signed in before, never onboarded)")
  const d = await newOAuthUser("d")
  const second = await auth.$context.then((ctx) => ctx.internalAdapter.createSession(d.userId))
  const sig = crypto.createHmac("sha256", (await auth.$context).secret).update(second.token).digest("base64")
  const laterCookie = `better-auth.session_token=${encodeURIComponent(`${second.token}.${sig}`)}`
  const dashD = await get("/dashboard/campaigns", laterCookie)
  check("a later session is still sent to /onboarding", dashD.status === 307 && (dashD.headers.get("location") ?? "").endsWith("/onboarding"), `${dashD.status} -> ${dashD.headers.get("location")}`)

  console.log("\n7. Signed out")
  const anon = await submit(orgName)
  check("POST /api/onboarding without a session is 401", anon.status === 401, `${anon.status}`)
  const anonPage = await get("/onboarding")
  check("/onboarding without a session redirects to /sign-in", anonPage.status === 307 && (anonPage.headers.get("location") ?? "").endsWith("/sign-in"), `${anonPage.status}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    const orgIds = createdUserIds.map(onboardingOrganizationId)
    if (orgIds.length) await db.delete(organization).where(inArray(organization.id, orgIds))
    if (createdUserIds.length) await db.delete(user).where(inArray(user.id, createdUserIds))
    const leftover = createdUserIds.length
      ? await db.select({ id: member.id }).from(member).where(and(inArray(member.userId, createdUserIds)))
      : []
    console.log(`\nCleaned up ${createdUserIds.length} users and their orgs (leftover memberships: ${leftover.length}).`)
  })
