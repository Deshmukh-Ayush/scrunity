import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmOutreachCampaign, gtmResearchRun } from "@/db/schema"
import { getApolloRunCreditCap, getEmailLookupsPerCampaign } from "@/lib/providers/config"
import { getConnection } from "./connections"
import { estimateApolloRunCredits } from "./public"
import { decidePeopleProvider, parsePlatformOrgIds, platformDataMode } from "./resolve-core"
import type { DataSourceResolution, RunCreditEstimate } from "./types"

/** Where this organization's people and email data come from (see resolve-core.ts). */
export async function resolvePeopleProvider(organizationId: string): Promise<DataSourceResolution> {
  const connection = await getConnection(organizationId, "apollo")
  return decidePeopleProvider({
    organizationId,
    connection,
    platformOrgIds: parsePlatformOrgIds(),
    platformMode: platformDataMode(),
  })
}

/** The campaign's organization, then its resolution. Pipeline stages call this at the start of each step. */
export async function resolveCampaignDataSource(
  campaignId: string
): Promise<{ organizationId: string; resolution: DataSourceResolution }> {
  const [row] = await db
    .select({ organizationId: gtmResearchRun.organizationId })
    .from(gtmOutreachCampaign)
    .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
    .where(eq(gtmOutreachCampaign.id, campaignId))
    .limit(1)
  if (!row) throw new Error(`Outreach campaign ${campaignId} not found`)
  return { organizationId: row.organizationId, resolution: await resolvePeopleProvider(row.organizationId) }
}

/** The cost shown before a run starts, from the same limits the run enforces. */
export function currentRunEstimate(): RunCreditEstimate {
  return estimateApolloRunCredits({
    emailLookupsPerCampaign: getEmailLookupsPerCampaign(),
    runCap: getApolloRunCreditCap(),
  })
}
