/**
 * Legacy-pipeline baseline from existing data: read-only SELECTs, no writes,
 * no vendor or Firecrawl calls. Answers "what share of legacy leads ended up
 * verified and qualified, and how did real sends bounce?" so the database
 * pipeline's yield can be compared against it.
 *
 *   npx tsx scripts/report-legacy-baseline.ts
 *
 * Definitions (from how the legacy stages store outcomes):
 * - legacy contact: gtm_contact.email_status IS NULL (database-mode people are 'not_looked_up').
 * - verified: verification_status = 'enrich_verified' (provider-verified, non-catch-all).
 * - disqualified: Stage 5.5 wrote a rejected draft whose subject starts "[Disqualified]".
 * - qualified: the contact has at least one draft that is not a disqualification marker.
 * - not evaluated: the contact has no draft at all (its campaign never reached Stage 5.5/6).
 * - bounced: a 'bounced' gtm_email_event on a sent draft.
 */
import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "../src/utils/db"

const pct = (n: number, d: number) =>
  d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await db.execute(query)).rows as T[]
}

async function main() {
  const [scope] = await rows<{
    orgs: number
    campaigns: number
    companies: number
    contacts: number
    firecrawl_calls: number
    first: string
    last: string
  }>(sql`
    WITH legacy AS (
      SELECT c.id contact_id, p.id company_id, oc.id campaign_id, rr.organization_id org_id, c.created_at
      FROM gtm_contact c
      JOIN gtm_prospect_company p ON p.id = c.prospect_company_id
      JOIN gtm_outreach_campaign oc ON oc.id = p.outreach_campaign_id
      JOIN gtm_research_run rr ON rr.id = oc.research_run_id
      WHERE c.email_status IS NULL
    )
    SELECT count(DISTINCT org_id)::int orgs, count(DISTINCT campaign_id)::int campaigns,
           count(DISTINCT company_id)::int companies, count(*)::int contacts,
           (SELECT coalesce(sum(firecrawl_call_count), 0)::int FROM gtm_outreach_campaign
             WHERE id IN (SELECT campaign_id FROM legacy)) firecrawl_calls,
           min(created_at)::text first, max(created_at)::text last
    FROM legacy`)

  const contacts = await rows<{
    verification_status: string
    email_source: string
    has_email: boolean
    outcome: "qualified" | "disqualified" | "not_evaluated"
    n: number
  }>(sql`
    SELECT c.verification_status, c.email_source, (c.email IS NOT NULL) has_email,
           CASE
             WHEN EXISTS (SELECT 1 FROM gtm_email_draft d WHERE d.contact_id = c.id AND d.subject NOT LIKE '[Disqualified]%') THEN 'qualified'
             WHEN EXISTS (SELECT 1 FROM gtm_email_draft d WHERE d.contact_id = c.id) THEN 'disqualified'
             ELSE 'not_evaluated'
           END outcome,
           count(*)::int n
    FROM gtm_contact c
    WHERE c.email_status IS NULL
    GROUP BY 1, 2, 3, 4`)

  const total = contacts.reduce((s, r) => s + r.n, 0)
  const sum = (f: (r: (typeof contacts)[number]) => boolean) =>
    contacts.filter(f).reduce((s, r) => s + r.n, 0)
  const withEmail = sum((r) => r.has_email)
  const verified = sum((r) => r.verification_status === "enrich_verified")
  const qualified = sum((r) => r.outcome === "qualified")
  const disqualified = sum((r) => r.outcome === "disqualified")
  const notEvaluated = sum((r) => r.outcome === "not_evaluated")
  const verifiedQualified = sum(
    (r) =>
      r.verification_status === "enrich_verified" && r.outcome === "qualified"
  )

  const reasons = await rows<{ reason: string; n: number }>(sql`
    SELECT coalesce(d.error_message, '(none)') reason, count(DISTINCT d.contact_id)::int n
    FROM gtm_email_draft d JOIN gtm_contact c ON c.id = d.contact_id
    WHERE c.email_status IS NULL AND d.subject LIKE '[Disqualified]%'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 8`)

  const drafts = await rows<{ status: string; n: number }>(sql`
    SELECT d.status, count(*)::int n
    FROM gtm_email_draft d JOIN gtm_contact c ON c.id = d.contact_id
    WHERE c.email_status IS NULL AND d.subject NOT LIKE '[Disqualified]%'
    GROUP BY 1 ORDER BY 2 DESC`)

  const sends = await rows<{
    email_source: string
    sent: number
    bounced: number
    replied: number
  }>(sql`
    SELECT c.email_source,
           count(*)::int sent,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM gtm_email_event e WHERE e.email_draft_id = d.id AND e.type = 'bounced'))::int bounced,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM gtm_email_event e WHERE e.email_draft_id = d.id AND e.type = 'replied'))::int replied
    FROM gtm_email_draft d JOIN gtm_contact c ON c.id = d.contact_id
    WHERE c.email_status IS NULL AND d.status = 'sent'
    GROUP BY 1 ORDER BY 2 DESC`)

  const [suppressed] = await rows<{ hard_bounce: number }>(sql`
    SELECT count(*)::int hard_bounce FROM gtm_suppression_entry WHERE reason = 'hard_bounce'`)

  console.log("\n=== Legacy pipeline baseline (read-only, existing data) ===")
  console.log(
    `scope: ${scope.orgs} orgs, ${scope.campaigns} campaigns, ${scope.companies} companies, ${scope.contacts} contacts`
  )
  console.log(`contacts created between ${scope.first} and ${scope.last}`)
  console.log(
    `Firecrawl calls recorded on these campaigns: ${scope.firecrawl_calls}`
  )

  console.log("\n-- lead funnel --")
  console.table([
    { step: "contacts found", n: total, share: "100%" },
    { step: "with any email", n: withEmail, share: pct(withEmail, total) },
    {
      step: "provider-verified email",
      n: verified,
      share: pct(verified, total),
    },
    {
      step: "qualified (passed Stage 5.5)",
      n: qualified,
      share: pct(qualified, total),
    },
    {
      step: "verified AND qualified",
      n: verifiedQualified,
      share: pct(verifiedQualified, total),
    },
    {
      step: "disqualified at Stage 5.5",
      n: disqualified,
      share: pct(disqualified, total),
    },
    {
      step: "never evaluated (no draft)",
      n: notEvaluated,
      share: pct(notEvaluated, total),
    },
  ])
  console.log(
    `Firecrawl calls per verified-and-qualified contact: ${verifiedQualified ? (scope.firecrawl_calls / verifiedQualified).toFixed(1) : "n/a (none)"}`
  )

  console.log("\n-- contacts by email source / verification status --")
  const bySource = new Map<string, number>()
  for (const r of contacts)
    bySource.set(
      `${r.email_source} / ${r.verification_status}`,
      (bySource.get(`${r.email_source} / ${r.verification_status}`) ?? 0) + r.n
    )
  console.table(
    [...bySource]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => ({ "source / status": k, n, share: pct(n, total) }))
  )

  console.log("\n-- top disqualification reasons (contacts) --")
  console.table(reasons)

  console.log("\n-- outreach drafts (excluding disqualification markers) --")
  console.table(drafts)

  console.log("\n-- real sends and bounces, by how the email was found --")
  const sent = sends.reduce((s, r) => s + r.sent, 0)
  const bounced = sends.reduce((s, r) => s + r.bounced, 0)
  console.table(
    sends.map((r) => ({ ...r, bounceRate: pct(r.bounced, r.sent) }))
  )
  console.log(
    `total sent ${sent}, bounced ${bounced} (${pct(bounced, sent)}), hard-bounce suppression entries platform-wide: ${suppressed.hard_bounce}`
  )
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
