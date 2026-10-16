import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmContact, gtmOutreachCampaign, gtmProspectCompany, gtmResearchRun } from "@/db/schema"
import { personKeys } from "@/lib/vendors/firecrawl/people-search"

/**
 * personKeys (LinkedIn profile, name at company domain) of every contact the
 * organization already has, across all its campaigns, so a new people search
 * does not bring the same person back.
 */
export async function loadKnownPersonKeys(organizationId: string): Promise<Set<string>> {
  const rows = await db
    .select({ name: gtmContact.name, linkedinUrl: gtmContact.linkedinUrl, domain: gtmProspectCompany.domain })
    .from(gtmContact)
    .innerJoin(gtmProspectCompany, eq(gtmContact.prospectCompanyId, gtmProspectCompany.id))
    .innerJoin(gtmOutreachCampaign, eq(gtmProspectCompany.outreachCampaignId, gtmOutreachCampaign.id))
    .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
    .where(eq(gtmResearchRun.organizationId, organizationId))
  const keys = new Set<string>()
  for (const row of rows) {
    const [firstName, ...rest] = row.name.trim().split(/\s+/)
    for (const key of personKeys({ firstName, lastName: rest.join(" "), linkedinUrl: row.linkedinUrl, domain: row.domain })) {
      keys.add(key)
    }
  }
  return keys
}
