import "server-only"
import { and, eq, isNull, lt, or, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/utils/db"
import { pilotInvite } from "@/db/schema"

/** Plans an admin may grant. The plan definitions themselves live in config/billing.ts. */
export const GRANTABLE_PLANS = ["pilot", "starter", "growth", "scale"] as const
export type GrantablePlan = (typeof GRANTABLE_PLANS)[number]

/** How long one claim attempt holds an invite before a retry may take it over. */
export const CLAIM_LEASE_MS = 2 * 60 * 1000

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

const emailSchema = z.string().email()

/** Splits a pasted list (commas, semicolons, whitespace) into unique valid and invalid emails. */
export function parseEmailList(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw
    .split(/[\s,;]+/)
    .map(normalizeInviteEmail)
    .filter(Boolean)
  const unique = Array.from(new Set(parts))
  return {
    valid: unique.filter((e) => emailSchema.safeParse(e).success),
    invalid: unique.filter((e) => !emailSchema.safeParse(e).success),
  }
}

export type InviteUpsertOutcome = "created" | "updated" | "unchanged_claimed"

export interface UpsertInvitesInput {
  emails: string[]
  plan: GrantablePlan
  credits: number
  note: string | null
  createdByUserId: string
}

/**
 * Adds or updates invites. One row per email (unique index): re-adding an
 * email that is still invited (or was revoked) updates its plan, credits and
 * note and makes it invited again; a claimed invite is left untouched.
 */
export async function upsertInvites(input: UpsertInvitesInput) {
  const results: { email: string; outcome: InviteUpsertOutcome }[] = []
  for (const email of input.emails) {
    const [row] = await db
      .insert(pilotInvite)
      .values({
        email,
        plan: input.plan,
        credits: input.credits,
        note: input.note,
        createdByUserId: input.createdByUserId,
      })
      .onConflictDoUpdate({
        target: pilotInvite.email,
        set: {
          plan: input.plan,
          credits: input.credits,
          note: input.note,
          status: "invited",
          revokedAt: null,
          updatedAt: new Date(),
        },
        // Never rewrite an invite that has been (or is being) applied.
        setWhere: sql`${pilotInvite.status} <> 'claimed' AND (${pilotInvite.claimLockedAt} IS NULL OR ${pilotInvite.claimLockedAt} < ${leaseCutoffSql()}::timestamp)`,
      })
      // xmax = 0 only for a freshly inserted row.
      .returning({ inserted: sql<boolean>`(xmax = 0)` })
    results.push({
      email,
      outcome: !row ? "unchanged_claimed" : row.inserted ? "created" : "updated",
    })
  }
  return results
}

export type RevokeOutcome = "revoked" | "not_revocable"

/** Revokes an invite that has not been claimed and is not being claimed right now. */
export async function revokeInvite(inviteId: string): Promise<RevokeOutcome> {
  const leaseCutoff = new Date(Date.now() - CLAIM_LEASE_MS)
  const revoked = await db
    .update(pilotInvite)
    .set({ status: "revoked", revokedAt: new Date(), claimLockedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(pilotInvite.id, inviteId),
        eq(pilotInvite.status, "invited"),
        or(isNull(pilotInvite.claimLockedAt), lt(pilotInvite.claimLockedAt, leaseCutoff))
      )
    )
    .returning({ id: pilotInvite.id })
  return revoked.length > 0 ? "revoked" : "not_revocable"
}

/** True when the email has an open (invited) pilot invite. */
export async function hasOpenInvite(email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: pilotInvite.id })
    .from(pilotInvite)
    .where(and(eq(pilotInvite.email, normalizeInviteEmail(email)), eq(pilotInvite.status, "invited")))
    .limit(1)
  return Boolean(row)
}

/** The lease cutoff in the UTC wall-clock form drizzle writes to `timestamp` columns, for raw SQL. */
function leaseCutoffSql(): string {
  return new Date(Date.now() - CLAIM_LEASE_MS).toISOString().replace("T", " ").replace("Z", "")
}
