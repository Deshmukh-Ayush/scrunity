import { z } from "zod"
import { targetMarketInputSchema } from "@/lib/gtm-target-market"

/**
 * The company details a research run needs, validated the same way whether
 * they are saved as the organization's profile or sent with a new run.
 * Pure (no DB), so the client form, the API routes and the tests share it.
 */
export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "200+"] as const
export type CompanySize = (typeof COMPANY_SIZES)[number]

export const RESEARCH_FORM_MODES = ["use_saved", "ask_every_time"] as const
export type ResearchFormMode = (typeof RESEARCH_FORM_MODES)[number]

const optionalText = (max?: number) =>
  (max ? z.string().trim().max(max) : z.string().trim())
    .optional()
    .nullable()
    .transform((value) => value || null)

export const companyProfileInputSchema = z
  .object({
    websiteUrl: z.string().trim().min(1, "Website URL is required"),
    companyName: z.string().trim().min(1, "Company name is required"),
    companyDescription: z.string().trim().min(1, "Company description is required"),
    companySize: z.enum(COMPANY_SIZES),
    contextDoc: optionalText(),
    contextDocFileName: optionalText(255),
  })
  .extend(targetMarketInputSchema.shape)

export type CompanyProfileInput = z.infer<typeof companyProfileInputSchema>

/** PUT /api/gtm/company-profile: the details plus how new runs use them. */
export const saveCompanyProfileSchema = companyProfileInputSchema.extend({
  researchFormMode: z.enum(RESEARCH_FORM_MODES),
})

/**
 * The profile as the browser sees it: the saved values (website already
 * normalized to https://), its logo (resolved when saved), the setting, and
 * who last changed it.
 */
export interface PublicCompanyProfile {
  values: CompanyProfileInput
  logoUrl: string | null
  researchFormMode: ResearchFormMode
  updatedAt: string
  updatedByName: string | null
}

/** GET /api/gtm/company-profile and the server components that render it. */
export interface CompanyProfileView {
  profile: PublicCompanyProfile | null
  canEdit: boolean
}

/** The columns of a gtm_company_profile row this module reads (no DB import). */
export interface CompanyProfileRow {
  websiteUrl: string
  logoUrl: string | null
  companyName: string
  companyDescription: string
  companySize: CompanySize
  contextDoc: string | null
  contextDocFileName: string | null
  targetCountryCode: string
  targetRegion: string | null
  ownArrAmount: number | null
  ownArrCurrency: string | null
  ownTamAmount: number | null
  ownTamCurrency: string | null
  researchFormMode: ResearchFormMode
  updatedAt: Date
}

/** Money columns back to the input shape; an unknown currency drops the amount. */
function money(amount: number | null, currency: string | null) {
  const parsed = targetMarketInputSchema.shape.ownArr.safeParse(
    amount !== null && currency ? { amount, currency } : null
  )
  return parsed.success ? (parsed.data ?? null) : null
}

export function toPublicCompanyProfile(row: CompanyProfileRow, updatedByName: string | null): PublicCompanyProfile {
  return {
    values: {
      websiteUrl: row.websiteUrl,
      companyName: row.companyName,
      companyDescription: row.companyDescription,
      companySize: row.companySize,
      contextDoc: row.contextDoc,
      contextDocFileName: row.contextDocFileName,
      targetCountryCode: row.targetCountryCode,
      targetRegion: row.targetRegion,
      ownArr: money(row.ownArrAmount, row.ownArrCurrency),
      ownTam: money(row.ownTamAmount, row.ownTamCurrency),
    },
    logoUrl: row.logoUrl,
    researchFormMode: row.researchFormMode,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName,
  }
}

/** Input to the profile's columns (website normalized by the caller). */
export function companyProfileColumns(input: CompanyProfileInput) {
  return { ...researchRunSnapshot(input), contextDocFileName: input.contextDocFileName }
}

/**
 * The research run's own copy of the details it used. A new object built
 * from the input, so a later profile edit cannot reach a past run.
 */
export function researchRunSnapshot(input: CompanyProfileInput) {
  return {
    websiteUrl: input.websiteUrl,
    companyName: input.companyName,
    companyDescription: input.companyDescription,
    companySize: input.companySize,
    contextDoc: input.contextDoc,
    targetCountryCode: input.targetCountryCode,
    targetRegion: input.targetRegion,
    ownArrAmount: input.ownArr?.amount ?? null,
    ownArrCurrency: input.ownArr?.currency ?? null,
    ownTamAmount: input.ownTam?.amount ?? null,
    ownTamCurrency: input.ownTam?.currency ?? null,
  }
}

/**
 * What starting a run writes to the profile. "upsert": the user asked to
 * update the saved details (or it is the first run). "insert_if_missing":
 * nothing is overwritten; a profile is created only when none exists, so the
 * first run of an organization without one saves it.
 */
export function profileWriteForNewRun(saveToProfile: boolean | undefined): "upsert" | "insert_if_missing" {
  return saveToProfile ? "upsert" : "insert_if_missing"
}
