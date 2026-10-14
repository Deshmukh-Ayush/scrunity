import { sql } from "drizzle-orm"
import { db } from "@/utils/db"

/**
 * Per-organization quotas backed by org_usage_counter, so they hold across
 * serverless instances (an in-memory counter resets per instance). Each use is
 * one atomic upsert that returns the new count; the request is allowed when the
 * count is within the limit. Windows are fixed UTC hours/days.
 */
export type QuotaWindow = "hour" | "day"

export interface QuotaDefinition {
  key: string
  window: QuotaWindow
  /** Env var that overrides `fallback`. */
  env: string
  fallback: number
  /** Plain message shown when the quota is used up. */
  message: string
}

export const QUOTAS = {
  researchRun: {
    key: "research_run",
    window: "day",
    env: "GTM_RESEARCH_RUNS_PER_DAY",
    fallback: 10,
    message: "Your organization has started the maximum number of research runs for today. Try again tomorrow.",
  },
  campaign: {
    key: "campaign",
    window: "day",
    env: "GTM_CAMPAIGNS_PER_DAY",
    fallback: 20,
    message: "Your organization has launched the maximum number of campaigns for today. Try again tomorrow.",
  },
  chatMessage: {
    key: "chat_message",
    window: "hour",
    env: "GTM_CHAT_MESSAGES_PER_HOUR",
    fallback: 60,
    message: "You've reached the chat limit for this hour. Please try again a bit later.",
  },
  leadDraft: {
    key: "lead_draft",
    window: "day",
    env: "GTM_LEAD_DRAFTS_PER_DAY",
    fallback: 200,
    message: "Your organization has generated the maximum number of drafts for today. Try again tomorrow.",
  },
  logoFetch: {
    key: "logo_fetch",
    window: "day",
    env: "GTM_LOGO_FETCHES_PER_DAY",
    fallback: 200,
    message: "Too many logo lookups today. Try again tomorrow.",
  },
} satisfies Record<string, QuotaDefinition>

export function quotaLimit(def: QuotaDefinition): number {
  const parsed = parseInt(process.env[def.env] ?? "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : def.fallback
}

function windowStart(window: QuotaWindow, now = new Date()): string {
  const start = new Date(now)
  start.setUTCMinutes(0, 0, 0)
  if (window === "day") start.setUTCHours(0)
  // Same UTC wall-clock encoding drizzle uses for `timestamp` columns.
  return start.toISOString().replace("T", " ").replace("Z", "")
}

/** Counts one use. Returns `allowed: false` (with the message) once over the limit. */
export async function consumeOrgQuota(organizationId: string, def: QuotaDefinition) {
  const limit = quotaLimit(def)
  const result = await db.execute(sql`
    INSERT INTO org_usage_counter (organization_id, key, window_start, count)
    VALUES (${organizationId}, ${def.key}, ${windowStart(def.window)}::timestamp, 1)
    ON CONFLICT (organization_id, key, window_start)
    DO UPDATE SET count = org_usage_counter.count + 1
    RETURNING count
  `)
  const count = Number((result.rows[0] as { count: number } | undefined)?.count ?? 0)
  return { allowed: count <= limit, count, limit, message: def.message }
}
