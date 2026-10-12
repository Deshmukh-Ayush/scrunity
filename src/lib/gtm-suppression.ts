import { db } from "@/utils/db";
import { gtmSuppressionEntry } from "@/db/schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { extractDomain } from "./firecrawl";

export type SuppressionReason =
  | "hard_bounce"
  | "invalid_contact_name"
  | "no_linkedin_found"
  | "aggregator_domain"
  | "mx_invalid"
  | "duplicate";

/**
 * Normalizes email address: lowercase and trimmed.
 */
export function normalizeEmail(email?: string | null): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes domain: strips protocol, path, and www prefix, lowercase.
 */
export function normalizeDomain(domain?: string | null): string | null {
  if (!domain || typeof domain !== "string") return null;
  const extracted = extractDomain(domain.trim());
  return extracted ? extracted.replace(/^www\./, "").toLowerCase() : null;
}

export interface RecordSuppressionParams {
  email?: string | null;
  domain?: string | null;
  reason: SuppressionReason;
  sourceOrgId?: string | null;
  sourceContactId?: string | null;
  isRealSendBounce?: boolean;
  statusCode?: string | null;
  rawSnippet?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Records a platform-wide suppression entry.
 * Deduplicates to prevent duplicate entries for identical email/domain + reason pairs.
 */
export async function recordSuppressionEntry({
  email,
  domain,
  reason,
  sourceOrgId,
  sourceContactId,
  isRealSendBounce = false,
  statusCode,
  rawSnippet,
  metadata,
}: RecordSuppressionParams): Promise<typeof gtmSuppressionEntry.$inferSelect> {
  const normEmail = normalizeEmail(email);
  let normDomain = normalizeDomain(domain);

  if (!normDomain && normEmail && normEmail.includes("@")) {
    normDomain = normalizeDomain(normEmail.split("@")[1]);
  }

  if (!normDomain) {
    throw new Error("Cannot record suppression entry without a valid domain");
  }

  // 1. Deduplication check
  if (normEmail) {
    const [existing] = await db
      .select()
      .from(gtmSuppressionEntry)
      .where(
        and(
          eq(gtmSuppressionEntry.email, normEmail),
          eq(gtmSuppressionEntry.reason, reason)
        )
      )
      .limit(1);

    if (existing) {
      // If the new finding is a confirmed real send bounce, upgrade the existing record
      if (isRealSendBounce && !existing.isRealSendBounce) {
        const [updated] = await db
          .update(gtmSuppressionEntry)
          .set({
            isRealSendBounce: true,
            statusCode: statusCode || existing.statusCode,
            rawSnippet: rawSnippet || existing.rawSnippet,
            metadata: metadata || existing.metadata,
          })
          .where(eq(gtmSuppressionEntry.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }
  } else {
    // Domain-level suppression deduplication (email is null)
    const [existing] = await db
      .select()
      .from(gtmSuppressionEntry)
      .where(
        and(
          isNull(gtmSuppressionEntry.email),
          eq(gtmSuppressionEntry.domain, normDomain),
          eq(gtmSuppressionEntry.reason, reason)
        )
      )
      .limit(1);

    if (existing) {
      return existing;
    }
  }

  // 2. Insert new suppression entry
  const [inserted] = await db
    .insert(gtmSuppressionEntry)
    .values({
      email: normEmail,
      domain: normDomain,
      reason,
      sourceOrgId: sourceOrgId || null,
      sourceContactId: sourceContactId || null,
      isRealSendBounce,
      statusCode: statusCode || null,
      rawSnippet: rawSnippet || null,
      metadata: metadata || null,
    })
    .returning();

  return inserted;
}

export interface CheckSuppressionParams {
  email?: string | null;
  domain?: string | null;
}

/**
 * Checks platform-wide suppression entries.
 * Evaluates by normalized email first, then falls back to domain-level entries (e.g. aggregator domains).
 * Read is globally scoped (zero org-scoping).
 */
export async function checkSuppression({
  email,
  domain,
}: CheckSuppressionParams): Promise<typeof gtmSuppressionEntry.$inferSelect | null> {
  const normEmail = normalizeEmail(email);
  let normDomain = normalizeDomain(domain);

  if (!normDomain && normEmail && normEmail.includes("@")) {
    normDomain = normalizeDomain(normEmail.split("@")[1]);
  }

  // 1. Check by email first (highest specificity)
  if (normEmail) {
    const emailMatches = await db
      .select()
      .from(gtmSuppressionEntry)
      .where(eq(gtmSuppressionEntry.email, normEmail))
      .orderBy(desc(gtmSuppressionEntry.isRealSendBounce), desc(gtmSuppressionEntry.createdAt));

    if (emailMatches.length > 0) {
      // Prioritize hard_bounce entries if multiple exist
      const hardBounce = emailMatches.find((m) => m.reason === "hard_bounce");
      return hardBounce || emailMatches[0];
    }
  }

  // 2. Secondary lookup by domain alone (for domain-level suppressions such as aggregator_domain)
  if (normDomain) {
    const domainMatches = await db
      .select()
      .from(gtmSuppressionEntry)
      .where(
        and(
          eq(gtmSuppressionEntry.domain, normDomain),
          or(
            isNull(gtmSuppressionEntry.email),
            eq(gtmSuppressionEntry.reason, "aggregator_domain")
          )
        )
      )
      .orderBy(desc(gtmSuppressionEntry.createdAt));

    if (domainMatches.length > 0) {
      return domainMatches[0];
    }
  }

  return null;
}

/**
 * Returns standard disqualification reason message mapped to existing vocabulary.
 * Strictly avoids customer-facing references to "suppression" or internal negative cache.
 */
export function getSuppressionDisqualificationMessage(
  entry: typeof gtmSuppressionEntry.$inferSelect
): string {
  switch (entry.reason) {
    case "hard_bounce":
      return "Email bounced (recipient address not found) — needs re-discovery before this can be sent.";
    case "invalid_contact_name":
      return "contact name invalid — pending re-discovery";
    case "no_linkedin_found":
      return "No LinkedIn profile found";
    case "aggregator_domain":
      return "Domain is an aggregator or review directory";
    case "mx_invalid":
      return "Email confidence too low — pattern-guessed with no MX validation";
    case "duplicate":
      return "Duplicate contact previously disqualified";
    default:
      return "Contact disqualified by qualification gates";
  }
}
