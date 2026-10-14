import { createHash, randomUUID } from "node:crypto"
import { after } from "next/server"
import { and, eq, gt, sql } from "drizzle-orm"
import { Resend } from "resend"
import { db } from "@/utils/db"
import { invitation, pilotInvite, user, verification } from "@/db/schema"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Magic-link sign-in (Better Auth `magicLink` plugin, configured in lib/auth.ts).
 *
 * The plugin always answers `{ status: true }` and calls `sendMagicLink`. This
 * module decides, silently, whether a link is actually delivered: only to an
 * existing user, an open pilot invite or a pending team invitation, and only
 * within the per-email and per-IP limits. Nothing here throws back to the
 * request and the send runs after the response (`after`), so the browser sees
 * the same answer, in about the same time, for every email.
 */

export const MAGIC_LINK_EXPIRES_IN_SECONDS = 5 * 60

/** Deliveries allowed per email address and per IP within the window. */
const PER_EMAIL_LIMIT = 3
const PER_IP_LIMIT = 10
const LIMIT_WINDOW_MS = 15 * 60 * 1000

export interface MagicLinkMessage {
  email: string
  url: string
}

type Mailer = (message: MagicLinkMessage) => Promise<void>

/** The public address links point at (LAN address or tunnel for in-person demos). */
export function magicLinkBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "")
}

/**
 * Points the plugin's verify link at the public base URL, and makes the
 * callback URLs absolute on that same address: the verify endpoint resolves
 * relative callbacks against BETTER_AUTH_URL, which would send a customer's
 * phone to `localhost` after a successful sign-in.
 */
export function toPublicLink(pluginUrl: string): string {
  const base = new URL(magicLinkBaseUrl())
  const url = new URL(pluginUrl)
  url.protocol = base.protocol
  url.host = base.host
  for (const param of ["callbackURL", "newUserCallbackURL", "errorCallbackURL"]) {
    const value = url.searchParams.get(param)
    if (value?.startsWith("/")) url.searchParams.set(param, `${base.origin}${value}`)
  }
  return url.toString()
}

const consoleMailer: Mailer = async ({ email, url }) => {
  console.info(`[magic-link] No mailer configured. Sign-in link for ${email}: ${url}`)
}

const resendMailer: Mailer = async ({ email, url }) => {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Scrunity <noreply@scrunity.com>",
    to: email,
    subject: "Your Scrunity sign-in link",
    text: `Sign in to Scrunity:\n\n${url}\n\nThis link works once and expires in ${
      MAGIC_LINK_EXPIRES_IN_SECONDS / 60
    } minutes. If you did not ask for it, ignore this email.`,
  })
  if (error) throw new Error(`Resend: ${error.message}`)
}

let mailerOverride: Mailer | null = null

/** Test hook: replaces the mailer for in-process verification scripts. */
export function setMagicLinkMailerForTests(mailer: Mailer | null) {
  mailerOverride = mailer
}

/**
 * MAGIC_LINK_MAILER=console|resend picks the mailer. Without it: Resend when
 * RESEND_API_KEY is set, else the console (dev fallback, prints the link).
 */
function activeMailer(): Mailer {
  if (mailerOverride) return mailerOverride
  const choice = process.env.MAGIC_LINK_MAILER
  if (choice === "console") return consoleMailer
  if (choice === "resend" || process.env.RESEND_API_KEY) return resendMailer
  return consoleMailer
}

/** True for an existing user, an open pilot invite or a pending, unexpired team invitation. */
export async function isMagicLinkEligible(email: string): Promise<boolean> {
  const [[existingUser], [openInvite], [teamInvite]] = await Promise.all([
    db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`).limit(1),
    db
      .select({ id: pilotInvite.id })
      .from(pilotInvite)
      .where(and(eq(pilotInvite.email, email), eq(pilotInvite.status, "invited")))
      .limit(1),
    db
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          sql`lower(${invitation.email}) = ${email}`,
          eq(invitation.status, "pending"),
          gt(invitation.expiresAt, new Date())
        )
      )
      .limit(1),
  ])
  return Boolean(existingUser || openInvite || teamInvite)
}

/** Identifier of the per-email rate-limit marker rows (hashed: no address stored). */
export function magicLinkRateIdentifier(email: string): string {
  return `magic_link_rate:${createHash("sha256").update(email).digest("hex")}`
}

/**
 * Records this request and returns its position among the requests for this
 * email in the window (1 = first). Kept as marker rows in `verification`,
 * which survive restarts and serverless instances (the sign-in token rows can
 * not be counted: Better Auth deletes them when a link is used). The position
 * counts only markers created before this one, so overlapping requests each
 * get their own place instead of all seeing the full burst.
 */
async function recordRequestForEmail(email: string): Promise<number> {
  const identifier = magicLinkRateIdentifier(email)
  const id = randomUUID()
  await db.insert(verification).values({
    id,
    identifier,
    value: "1",
    expiresAt: new Date(Date.now() + LIMIT_WINDOW_MS),
  })
  const [row] = await db
    .select({ earlier: sql<number>`count(*)::int` })
    .from(verification)
    .where(
      and(
        eq(verification.identifier, identifier),
        gt(verification.expiresAt, new Date()),
        sql`(${verification.createdAt}, ${verification.id}) < (SELECT created_at, id FROM verification WHERE id = ${id})`
      )
    )
  return Number(row?.earlier ?? 0) + 1
}

function clientIp(headers: Headers | undefined): string {
  return headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || headers?.get("x-real-ip") || "unknown"
}

async function deliver(email: string, url: string, ip: string) {
  try {
    if (!rateLimit(`magic_link_ip_${ip}`, PER_IP_LIMIT, LIMIT_WINDOW_MS).success) {
      console.warn(`[magic-link] Per-IP limit reached for ${ip}; link not sent.`)
      return
    }
    if ((await recordRequestForEmail(email)) > PER_EMAIL_LIMIT) {
      console.warn("[magic-link] Per-email limit reached; link not sent.")
      return
    }
    if (!(await isMagicLinkEligible(email))) {
      console.info("[magic-link] Email has no account or invite; link not sent.")
      return
    }
    const link = toPublicLink(url)
    if (new URL(link).hostname === "localhost" || new URL(link).hostname === "127.0.0.1") {
      console.warn(
        "[magic-link] The link points at localhost and will only open on this machine. Set NEXT_PUBLIC_APP_URL to a LAN address or tunnel for demos on other devices."
      )
    }
    await activeMailer()({ email, url: link })
  } catch (err) {
    console.error("[magic-link] Failed to send sign-in link:", err)
  }
}

/** Better Auth `sendMagicLink` callback. Never throws; delivery happens after the response. */
export async function sendMagicLink(
  data: { email: string; url: string },
  ctx?: { headers?: Headers; request?: Request }
) {
  const email = data.email.trim().toLowerCase()
  const ip = clientIp(ctx?.headers ?? ctx?.request?.headers)
  const task = () => deliver(email, data.url, ip)
  try {
    after(task)
  } catch {
    // Outside a Next.js request (verification scripts): deliver inline.
    await task()
  }
}
