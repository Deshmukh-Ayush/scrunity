/**
 * Read-only wall-clock report for the most recent campaigns (and the research
 * runs they came from). No writes, no vendor calls.
 *
 *   npx tsx scripts/report-stage-timings.ts [count=3]
 *
 * Campaigns created after the stage_timings column existed carry exact
 * per-stage start/end times. Older rows have none, so stage boundaries are
 * reconstructed from the rows each stage writes:
 * - research_company ends when the first competitor row is written,
 *   research_competitors when the first segment is written;
 * - find_companies ends at the last prospect-company insert;
 * - find_contacts runs from the first to the last contact insert;
 * - write_emails ends at the (single batch) draft insert;
 * - Firecrawl calls per stage come from gtm_vendor_usage (vendor 'firecrawl').
 * Gaps between one stage's last write and the next stage's first write are
 * reported as "between" (LLM work at the start of a stage, or scheduling).
 */
import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "../src/utils/db"

const count = Number(process.argv[2] || 3)
const sec = (a: Date | string | null, b: Date | string | null) =>
  a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000) : null

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await db.execute(query)).rows as T[]
}

async function main() {
  const campaigns = await rows<Record<string, string | null>>(sql`
    select c.id, c.created_at, c.research_run_id, c.status, to_jsonb(c)->'stage_timings' as stage_timings,
      r.created_at as run_created_at, to_jsonb(r)->'stage_timings' as run_timings,
      (select min(created_at) from gtm_competitor where research_run_id = r.id) as competitors_at,
      (select min(created_at) from gtm_icp_segment where research_run_id = r.id) as segments_at,
      (select max(created_at) from gtm_prospect_company where outreach_campaign_id = c.id) as companies_end,
      (select min(ct.created_at) from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id
        where pc.outreach_campaign_id = c.id) as contacts_start,
      (select max(ct.created_at) from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id
        where pc.outreach_campaign_id = c.id) as contacts_end,
      (select max(created_at) from gtm_email_draft where outreach_campaign_id = c.id) as drafts_at,
      (select count(*) from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id
        where pc.outreach_campaign_id = c.id)::int as contacts,
      (select count(*) from gtm_prospect_company where outreach_campaign_id = c.id)::int as companies
    from gtm_outreach_campaign c join gtm_research_run r on r.id = c.research_run_id
    where exists (select 1 from gtm_email_draft d where d.outreach_campaign_id = c.id)
    order by c.created_at desc limit ${count}`)

  for (const c of campaigns) {
    console.log(`\nCampaign ${c.id} (${c.status}), ${c.companies} companies, ${c.contacts} contacts`)
    if (c.stage_timings) {
      console.log("  Recorded stage timings:", JSON.stringify(c.stage_timings))
    }
    console.log("  Research run (reconstructed):", {
      research_company_s: sec(c.run_created_at, c.competitors_at),
      research_competitors_to_segments_s: sec(c.competitors_at, c.segments_at),
    })
    const fc = await rows<{ stage: string; calls: number; first: string; last: string }>(sql`
      select case
          when created_at <= ${c.companies_end} then 'find_companies'
          when created_at <= ${c.contacts_end} then 'find_contacts'
          else 'later' end as stage,
        count(*)::int as calls, min(created_at) as first, max(created_at) as last
      from gtm_vendor_usage where vendor = 'firecrawl' and campaign_id = ${c.id}
      group by 1 order by 2 desc`)
    console.table({
      find_companies: { seconds: sec(c.created_at, c.companies_end) },
      between_4_and_5: { seconds: sec(c.companies_end, c.contacts_start) },
      find_contacts: { seconds: sec(c.contacts_start, c.contacts_end) },
      qualify_and_write_emails: { seconds: sec(c.contacts_end, c.drafts_at) },
      campaign_total: { seconds: sec(c.created_at, c.drafts_at) },
    })
    console.table(
      fc.map((f) => ({
        stage: f.stage,
        firecrawl_calls: f.calls,
        span_s: sec(f.first, f.last),
        s_per_call: f.calls > 1 ? Number(((sec(f.first, f.last) ?? 0) / (f.calls - 1)).toFixed(1)) : null,
      }))
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
