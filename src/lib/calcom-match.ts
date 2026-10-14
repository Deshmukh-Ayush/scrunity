import { sql } from "drizzle-orm"
import { db } from "@/utils/db"

export type BookingMatch =
  | { kind: "matched"; contactId: string; outreachCampaignId: string; email: string; organizationId: string }
  | { kind: "ambiguous"; organizationCount: number }
  | { kind: "none" }

/**
 * Finds the contact a Cal.com booking belongs to. The webhook carries no
 * organization, so it is scoped by who actually emailed the attendee: only
 * contacts with a sent draft count, and only when exactly one organization sent
 * to that address. If several organizations emailed the same person the
 * booking is left unattached rather than guessed (it could be any of them).
 */
export async function matchBookingContact(email: string): Promise<BookingMatch> {
  const result = await db.execute(sql`
    SELECT c.id AS contact_id, pc.outreach_campaign_id, c.email, r.organization_id, max(d.sent_at) AS last_sent
    FROM gtm_contact c
    JOIN gtm_prospect_company pc ON pc.id = c.prospect_company_id
    JOIN gtm_outreach_campaign oc ON oc.id = pc.outreach_campaign_id
    JOIN gtm_research_run r ON r.id = oc.research_run_id
    JOIN gtm_email_draft d ON d.contact_id = c.id AND d.status = 'sent'
    WHERE lower(c.email) = lower(${email})
    GROUP BY c.id, pc.outreach_campaign_id, c.email, r.organization_id
    ORDER BY last_sent DESC
  `)
  const rows = result.rows as {
    contact_id: string
    outreach_campaign_id: string
    email: string
    organization_id: string
  }[]
  if (rows.length === 0) return { kind: "none" }
  const organizations = new Set(rows.map((r) => r.organization_id))
  if (organizations.size > 1) return { kind: "ambiguous", organizationCount: organizations.size }
  const latest = rows[0]
  return {
    kind: "matched",
    contactId: latest.contact_id,
    outreachCampaignId: latest.outreach_campaign_id,
    email: latest.email,
    organizationId: latest.organization_id,
  }
}

/** The single booked meeting for this attendee, or null when there are none or several. */
export async function uniqueBookedMeetingId(email: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id FROM gtm_meeting WHERE lower(attendee_email) = lower(${email}) AND status = 'booked' LIMIT 2
  `)
  return result.rows.length === 1 ? (result.rows[0] as { id: string }).id : null
}
