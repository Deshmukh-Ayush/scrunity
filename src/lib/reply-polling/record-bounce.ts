import { and, eq } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"
import { recordSuppressionEntry } from "@/lib/gtm-suppression"

/**
 * Records a delivery bounce event for a sent draft and updates draft status cleanly.
 */
export async function recordBounceForDraft({
  draftId,
  rawSnippet = "Delivery Status Notification (Failure): Address not found (550)",
  occurredAt = new Date(),
}: {
  draftId: string
  rawSnippet?: string
  occurredAt?: Date
}): Promise<boolean> {
  const [existingBounceEvent] = await db
    .select({ id: gtmEmailEvent.id })
    .from(gtmEmailEvent)
    .where(
      and(
        eq(gtmEmailEvent.emailDraftId, draftId),
        eq(gtmEmailEvent.type, "bounced")
      )
    )

  if (!existingBounceEvent) {
    await db.insert(gtmEmailEvent).values({
      emailDraftId: draftId,
      type: "bounced",
      rawSnippet: rawSnippet.slice(0, 2000),
      occurredAt,
    })
  }

  await db
    .update(gtmEmailDraft)
    .set({
      status: "failed",
      errorMessage:
        "Email bounced (recipient address not found) — needs re-discovery before this can be sent.",
    })
    .where(eq(gtmEmailDraft.id, draftId))

  // Platform-wide suppression: write permanent hard_bounce entry for this confirmed real send bounce
  try {
    const [draftInfo] = await db
      .select({
        contactId: gtmEmailDraft.contactId,
        contactEmail: gtmContact.email,
        prospectCompanyId: gtmContact.prospectCompanyId,
        orgId: gtmResearchRun.organizationId,
      })
      .from(gtmEmailDraft)
      .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
      .innerJoin(
        gtmOutreachCampaign,
        eq(gtmEmailDraft.outreachCampaignId, gtmOutreachCampaign.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .where(eq(gtmEmailDraft.id, draftId))

    if (draftInfo?.contactEmail) {
      let domain = ""
      if (draftInfo.prospectCompanyId) {
        const [comp] = await db
          .select({ domain: gtmProspectCompany.domain })
          .from(gtmProspectCompany)
          .where(eq(gtmProspectCompany.id, draftInfo.prospectCompanyId))
        if (comp?.domain) domain = comp.domain
      }
      if (!domain) {
        domain = draftInfo.contactEmail.split("@")[1] || ""
      }

      const statusCodeMatch = rawSnippet.match(/\b(55[0-9]|5\.[0-7]\.[0-9])\b/)
      const statusCode = statusCodeMatch ? statusCodeMatch[1] : undefined

      await recordSuppressionEntry({
        email: draftInfo.contactEmail,
        domain,
        reason: "hard_bounce",
        sourceOrgId: draftInfo.orgId,
        sourceContactId: draftInfo.contactId,
        isRealSendBounce: true,
        statusCode,
        rawSnippet: rawSnippet.slice(0, 1000),
        metadata: {
          draftId,
          occurredAt: occurredAt.toISOString(),
          detectionSource: "stage_8_bounce_poller",
        },
      })
    }
  } catch (suppressErr) {
    console.error(
      `[Poll Replies] Failed to write hard_bounce suppression entry for draft ${draftId}:`,
      suppressErr
    )
  }

  return true
}
