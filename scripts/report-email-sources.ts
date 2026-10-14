/**
 * Read-only diagnosis of how a campaign's contact emails were produced: the
 * stored emailSource / verificationStatus, the gate outcome, sends, bounces and
 * vendor usage. No writes, no vendor or Firecrawl calls. Email local parts are
 * masked in the output.
 *
 *   npx tsx scripts/report-email-sources.ts [ownerEmail]
 */
import "dotenv/config"
import { sql } from "drizzle-orm"
import { db } from "../src/utils/db"

const ownerEmail = process.argv[2] || "ayushdeshmukh301@gmail.com"
const mask = (e: string | null) => (e ? e.replace(/^(.).*(@.*)$/, "$1***$2") : null)

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await db.execute(query)).rows as T[]
}

async function main() {
  const orgs = await rows<{ org_id: string; name: string }>(sql`
    select o.id as org_id, o.name from member m
    join "user" u on u.id = m.user_id join organization o on o.id = m.organization_id
    where lower(u.email) = lower(${ownerEmail})`)
  console.log("Organizations:", orgs)
  const orgIds = orgs.map((o) => o.org_id)
  if (orgIds.length === 0) return

  const campaigns = await rows<Record<string, unknown>>(sql`
    select c.id, c.status, c.current_stage, c.created_at, c.stage_started_at, c.last_progress_at,
      c.firecrawl_call_count, r.organization_id,
      (select count(*) from gtm_contact ct join gtm_prospect_company pc on pc.id = ct.prospect_company_id
        where pc.outreach_campaign_id = c.id)::int as contacts
    from gtm_outreach_campaign c join gtm_research_run r on r.id = c.research_run_id
    where r.organization_id in (${sql.join(orgIds.map((id) => sql`${id}`), sql`, `)})
    order by c.created_at desc limit 5`)
  console.log("Latest campaigns:")
  console.table(campaigns)

  const target = campaigns.find((c) => Number(c.contacts) > 0)
  if (!target) return
  console.log(`\nContacts of campaign ${target.id}:`)
  const contacts = await rows<Record<string, unknown> & { email: string | null }>(sql`
    select ct.name, ct.title, pc.domain, ct.email, ct.email_source, ct.verification_status,
      ct.enrich_metadata is not null as has_enrich_metadata, ct.lookup_status,
      (ct.linkedin_url is not null) as has_linkedin,
      d.status as draft_status, left(d.error_message, 70) as reason, d.sent_at,
      (select string_agg(e.type, ',') from gtm_email_event e where e.email_draft_id = d.id) as events
    from gtm_contact ct
    join gtm_prospect_company pc on pc.id = ct.prospect_company_id
    left join gtm_email_draft d on d.contact_id = ct.id
    where pc.outreach_campaign_id = ${target.id as string}
    order by ct.created_at`)
  console.table(contacts.map((c) => ({ ...c, email: mask(c.email) })))

  console.log("\nAll sent drafts in these organizations, with email source and bounce events:")
  const sent = await rows<Record<string, unknown> & { email: string | null }>(sql`
    select d.sent_at, ct.email, ct.email_source, ct.verification_status, d.outreach_campaign_id,
      (select string_agg(e.type || coalesce(':' || left(e.raw_snippet, 60), ''), ' | ')
        from gtm_email_event e where e.email_draft_id = d.id) as events
    from gtm_email_draft d join gtm_contact ct on ct.id = d.contact_id
    join gtm_outreach_campaign c on c.id = d.outreach_campaign_id
    join gtm_research_run r on r.id = c.research_run_id
    where d.status = 'sent' and r.organization_id in (${sql.join(orgIds.map((id) => sql`${id}`), sql`, `)})
    order by d.sent_at`)
  console.table(sent.map((s) => ({ ...s, email: mask(s.email) })))

  console.log("\nHard-bounce suppression entries:")
  console.table(
    (await rows<{ email: string | null; domain: string; created_at: string; is_real_send_bounce: boolean }>(sql`
      select email, domain, created_at, is_real_send_bounce from gtm_suppression_entry
      where reason = 'hard_bounce' order by created_at desc limit 10`)).map((r) => ({ ...r, email: mask(r.email) }))
  )

  console.log("\nVendor ledger (gtm_vendor_usage) by vendor:")
  console.table(await rows(sql`select vendor, endpoint, sum(credits_used)::int as credits, count(*)::int as calls
    from gtm_vendor_usage group by vendor, endpoint`))
  console.log("enrich.so usage events (usage_event, tool enrich.email-finder):")
  console.table(await rows(sql`select organization_id, count(*)::int as calls, max(created_at) as last
    from usage_event where tool_name = 'enrich.email-finder' group by organization_id`))
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
