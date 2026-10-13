import "server-only"

import { db } from "@/utils/db"
import {
  gtmCompetitor,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmResearchRun,
} from "@/db/schema"
import { desc, eq } from "drizzle-orm"
import { verifyResearchRunAccess } from "@/lib/gtm-auth"

/** Every research run in the organization, newest first. */
export async function listOrgResearchRuns(organizationId: string) {
  return db
    .select()
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.organizationId, organizationId))
    .orderBy(desc(gtmResearchRun.createdAt))
}

/**
 * A research run with its competitors, ICP segments and campaigns. Returns null
 * when the run does not belong to the organization (IDOR guard).
 */
export async function getResearchRunDetail(
  researchRunId: string,
  organizationId: string
) {
  const researchRun = await verifyResearchRunAccess(
    researchRunId,
    organizationId
  )
  if (!researchRun) return null

  const [competitors, segments, campaigns] = await Promise.all([
    db
      .select()
      .from(gtmCompetitor)
      .where(eq(gtmCompetitor.researchRunId, researchRunId)),
    db
      .select()
      .from(gtmIcpSegment)
      .where(eq(gtmIcpSegment.researchRunId, researchRunId)),
    db
      .select()
      .from(gtmOutreachCampaign)
      .where(eq(gtmOutreachCampaign.researchRunId, researchRunId)),
  ])

  return { researchRun, competitors, segments, campaigns }
}
