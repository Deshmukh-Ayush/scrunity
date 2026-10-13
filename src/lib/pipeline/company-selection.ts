import { eq, inArray, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmOutreachCampaign, gtmProspectCompany } from "@/db/schema"

export type ConfirmSelectionOutcome =
  /** This call moved the campaign past the gate and stored the selection. */
  | "confirmed"
  /** The gate was already passed (double click, retry): nothing was changed. */
  | "already_confirmed"
  /** The campaign never reached the gate (still searching, failed, legacy mode). */
  | "not_at_gate"

/**
 * Passes the company-selection gate. One SQL statement both advances the
 * campaign (only if it is still at `awaiting_company_selection`) and writes
 * every company's selection, so concurrent confirms cannot interleave: exactly
 * one wins, and the losers change nothing. Callers must have checked that
 * `selectedIds` belong to this campaign.
 */
export async function confirmCompanySelection(
  campaignId: string,
  selectedIds: string[]
): Promise<ConfirmSelectionOutcome> {
  // Same UTC wall-clock encoding drizzle uses for `timestamp` columns.
  const now = new Date().toISOString().replace("T", " ").replace("Z", "")
  const result = await db.execute(sql`
    WITH advanced AS (
      UPDATE ${gtmOutreachCampaign}
      SET current_stage = 'find_contacts',
          status = 'in_progress',
          failure_reason = NULL,
          stage_started_at = ${now}::timestamp,
          last_progress_at = NULL
      WHERE ${gtmOutreachCampaign.id} = ${campaignId}
        AND ${gtmOutreachCampaign.currentStage} = 'awaiting_company_selection'
      RETURNING id
    ), updated AS (
      UPDATE ${gtmProspectCompany}
      SET selection_status = CASE WHEN ${inArray(gtmProspectCompany.id, selectedIds)}
                                  THEN 'selected' ELSE 'excluded' END
      WHERE ${gtmProspectCompany.outreachCampaignId} IN (SELECT id FROM advanced)
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM advanced)::int AS advanced,
           (SELECT count(*) FROM updated)::int AS updated
  `)
  if (Number(result.rows[0]?.advanced) > 0) return "confirmed"

  const [campaign] = await db
    .select({ currentStage: gtmOutreachCampaign.currentStage })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  const pastGate =
    campaign &&
    !["find_companies", "awaiting_company_selection"].includes(
      campaign.currentStage
    )
  return pastGate ? "already_confirmed" : "not_at_gate"
}
