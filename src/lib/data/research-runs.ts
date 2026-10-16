import "server-only"

import { db } from "@/utils/db"
import {
  gtmCompetitor,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmResearchRun,
} from "@/db/schema"
import { desc, eq, getTableColumns, sql } from "drizzle-orm"
import { verifyResearchRunAccess } from "@/lib/gtm-auth"
import { publicPipelineRow } from "./public-fields"

/** Every research run in the organization, newest first. */
export async function listOrgResearchRuns(organizationId: string) {
  const runs = await db
    .select({
      ...getTableColumns(gtmResearchRun),
      // Display-only extra for the Research table (same rows, same order). The outer
      // column is spelled out: in a one-table select Drizzle renders ${gtmResearchRun.id}
      // as a bare "id", which inside the subquery would mean gtm_icp_segment.id.
      segmentCount: sql<number>`(SELECT count(*)::int FROM gtm_icp_segment s WHERE s.research_run_id = "gtm_research_run"."id")`,
    })
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.organizationId, organizationId))
    .orderBy(desc(gtmResearchRun.createdAt))
  return runs.map(publicPipelineRow)
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

  return {
    researchRun: publicPipelineRow(researchRun),
    competitors,
    segments,
    campaigns: campaigns.map(publicPipelineRow),
  }
}
