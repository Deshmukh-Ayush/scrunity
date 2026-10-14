/**
 * Shared helpers for scripts/test-pilot-access.ts: users with live sessions
 * (created the way Better Auth's OAuth callback creates them), HTTP calls
 * against `npm run dev`, and reading the dev server's log for magic links.
 */
import crypto from "node:crypto"
import { readFileSync } from "node:fs"
import { and, eq, sql } from "drizzle-orm"
import { auth } from "../../src/lib/auth"
import { db } from "../../src/utils/db"
import { gtmAiCreditPeriod, gtmAiCreditTransaction, organization } from "../../src/db/schema"

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
export const createdUserIds: string[] = []

export function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

export async function sessionCookie(userId: string) {
  const ctx = await auth.$context
  const session = await ctx.internalAdapter.createSession(userId)
  const signature = crypto.createHmac("sha256", ctx.secret).update(session.token).digest("base64")
  return `better-auth.session_token=${encodeURIComponent(`${session.token}.${signature}`)}`
}

/** A Google-style user (email verified) with a live session. */
export async function newUser(email: string) {
  const ctx = await auth.$context
  const { user } = await ctx.internalAdapter.createOAuthUser(
    { name: `Pilot Test ${email}`, email, emailVerified: true, image: null },
    { providerId: "google", accountId: `test-${email}` }
  )
  createdUserIds.push(user.id)
  return { userId: user.id, email, cookie: await sessionCookie(user.id) }
}

export function http(path: string, init: { method?: string; cookie?: string; body?: unknown; ip?: string } = {}) {
  const headers: Record<string, string> = {}
  if (init.cookie) headers.cookie = init.cookie
  if (init.body !== undefined) headers["content-type"] = "application/json"
  if (init.ip) headers["x-forwarded-for"] = init.ip
  // Better Auth's CSRF/origin check needs an Origin on cookie-less POSTs.
  headers.origin = BASE_URL
  return fetch(`${BASE_URL}${path}`, {
    method: init.method ?? "GET",
    redirect: "manual",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

export const onboard = (cookie: string, name: string) =>
  http("/api/onboarding", { method: "POST", cookie, body: { name } })

/** Plan, balance and ledger counts for an organization, read straight from the DB. */
export async function orgCredits(organizationId: string) {
  const [org] = await db.select().from(organization).where(eq(organization.id, organizationId))
  const [period] = await db
    .select()
    .from(gtmAiCreditPeriod)
    .where(eq(gtmAiCreditPeriod.organizationId, organizationId))
    .orderBy(sql`${gtmAiCreditPeriod.periodStart} desc`)
    .limit(1)
  const ledger = await db
    .select()
    .from(gtmAiCreditTransaction)
    .where(eq(gtmAiCreditTransaction.organizationId, organizationId))
  return {
    plan: org?.plan,
    subscriptionStatus: org?.subscriptionStatus,
    creditsRemaining: period?.creditsRemaining ?? 0,
    ledger,
    manualGrants: ledger.filter((t) => t.type === "manual_grant"),
    resets: ledger.filter((t) => t.type === "period_reset" && (t.description ?? "").includes("Pilot")),
  }
}

export async function grantRows(organizationId: string) {
  return db
    .select()
    .from(gtmAiCreditTransaction)
    .where(and(eq(gtmAiCreditTransaction.organizationId, organizationId), eq(gtmAiCreditTransaction.type, "manual_grant")))
}

/** Every magic link the console mailer printed for this email, in order. */
export function linksInLog(logPath: string, email: string): string[] {
  const log = readFileSync(logPath, "utf8")
  const pattern = new RegExp(`Sign-in link for ${email.replace(/[.+]/g, "\\$&")}: (\\S+)`, "g")
  return [...log.matchAll(pattern)].map((m) => m[1])
}

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
