import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmCompanyProfile, user } from "@/db/schema"
import { getFallbackLogoUrl, normalizeWebsiteUrl } from "@/lib/firecrawl"
import {
  companyProfileColumns,
  toPublicCompanyProfile,
  type CompanyProfileInput,
  type PublicCompanyProfile,
  type ResearchFormMode,
} from "./input"

/** The organization's saved company profile, or null when none was saved. */
export async function getCompanyProfile(organizationId: string): Promise<PublicCompanyProfile | null> {
  const [row] = await db
    .select({ profile: gtmCompanyProfile, updatedByName: user.name })
    .from(gtmCompanyProfile)
    .leftJoin(user, eq(user.id, gtmCompanyProfile.updatedByUserId))
    .where(eq(gtmCompanyProfile.organizationId, organizationId))
    .limit(1)
  return row ? toPublicCompanyProfile(row.profile, row.updatedByName) : null
}

/**
 * Resolved once per save from the website and stored, so Settings and the New
 * research run card read it instead of calling /api/gtm/fetch-logo (and its
 * daily quota) on every page view. The same favicon-service URL that route
 * returns; no network call.
 */
function columnsFor(input: CompanyProfileInput, userId: string) {
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl)
  return {
    ...companyProfileColumns({ ...input, websiteUrl }),
    logoUrl: getFallbackLogoUrl(websiteUrl),
    updatedAt: new Date(),
    updatedByUserId: userId,
  }
}

/**
 * Saves the profile in one statement (insert or overwrite). The setting is
 * written only when given, so a run's "Also update my saved profile" keeps it.
 */
export async function saveCompanyProfile(
  organizationId: string,
  userId: string,
  input: CompanyProfileInput,
  researchFormMode?: ResearchFormMode
) {
  const columns = { ...columnsFor(input, userId), ...(researchFormMode ? { researchFormMode } : {}) }
  await db
    .insert(gtmCompanyProfile)
    .values({ organizationId, ...columns })
    .onConflictDoUpdate({ target: gtmCompanyProfile.organizationId, set: columns })
}

/** Creates the profile only when the organization has none; never overwrites. */
export async function saveCompanyProfileIfMissing(organizationId: string, userId: string, input: CompanyProfileInput) {
  await db
    .insert(gtmCompanyProfile)
    .values({ organizationId, ...columnsFor(input, userId) })
    .onConflictDoNothing({ target: gtmCompanyProfile.organizationId })
}
