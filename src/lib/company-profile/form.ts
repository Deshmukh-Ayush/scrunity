import { countryCodeFromName, countryNameFromCode, type Currency } from "@/lib/geo/countries"
import type { CompanyProfileInput, CompanySize } from "./input"

/**
 * The company form as typed: the same fields, defaults and validation in
 * onboarding, New research run and Settings. Pure, so it is unit tested.
 */
export interface CompanyFormValues {
  /** Without the scheme, as typed ("acme.com"). */
  websiteUrl: string
  companyName: string
  companyDescription: string
  companySize: CompanySize
  contextDoc: string
  fileName: string
  /** Country name as typed or picked; mapped to its ISO code on submit. */
  targetCountry: string
  targetRegion: string
  /** Kept as typed so the input can be cleared; parsed on submit. */
  arrAmount: string
  arrCurrency: Currency
  tamAmount: string
  tamCurrency: Currency
}

/** Inline errors keyed by field id; shown after a submit attempt. */
export type CompanyFormErrors = Partial<
  Record<"websiteUrl" | "companyName" | "companyDescription" | "targetCountry", string>
>

export const EMPTY_COMPANY_FORM: CompanyFormValues = {
  websiteUrl: "",
  companyName: "",
  companyDescription: "",
  companySize: "11-50",
  contextDoc: "",
  fileName: "",
  targetCountry: "",
  targetRegion: "",
  arrAmount: "",
  arrCurrency: "USD",
  tamAmount: "",
  tamCurrency: "USD",
}

/** "https://https://acme.com/" or "acme.com" -> "acme.com". */
export function websiteForDisplay(url: string) {
  return url.trim().replace(/^(?:https?:\/*)+/i, "").replace(/\/+$/, "")
}

/** Inline errors for the required fields; empty when the form can be sent. */
export function validateCompanyForm(form: CompanyFormValues): CompanyFormErrors {
  const errors: CompanyFormErrors = {}
  if (!form.websiteUrl.trim()) errors.websiteUrl = "Enter your website, for example acme.com."
  if (!form.companyName.trim()) errors.companyName = "Enter your company name."
  if (!countryCodeFromName(form.targetCountry)) errors.targetCountry = "Choose a country from the list."
  if (!form.companyDescription.trim())
    errors.companyDescription = "Describe what your company does in a sentence or two."
  return errors
}

/** "" -> null, otherwise { amount, currency } for the API. */
function money(amount: string, currency: Currency) {
  const parsed = parseInt(amount, 10)
  return Number.isFinite(parsed) && parsed > 0 ? { amount: parsed, currency } : null
}

/** The API payload for a valid form; null when a required field is missing. */
export function companyFormToInput(form: CompanyFormValues): CompanyProfileInput | null {
  const targetCountryCode = countryCodeFromName(form.targetCountry)
  if (Object.keys(validateCompanyForm(form)).length > 0 || !targetCountryCode) return null
  return {
    websiteUrl: `https://${websiteForDisplay(form.websiteUrl)}`,
    companyName: form.companyName.trim(),
    companyDescription: form.companyDescription.trim(),
    companySize: form.companySize,
    contextDoc: form.contextDoc.trim() || null,
    contextDocFileName: form.contextDoc.trim() ? form.fileName.trim() || null : null,
    targetCountryCode,
    targetRegion: form.targetRegion.trim() || null,
    ownArr: money(form.arrAmount, form.arrCurrency),
    ownTam: money(form.tamAmount, form.tamCurrency),
  }
}

/** Saved values back into the form, ready to edit. */
export function companyInputToForm(input: CompanyProfileInput): CompanyFormValues {
  return {
    websiteUrl: websiteForDisplay(input.websiteUrl),
    companyName: input.companyName,
    companyDescription: input.companyDescription,
    companySize: input.companySize,
    contextDoc: input.contextDoc ?? "",
    fileName: input.contextDoc ? (input.contextDocFileName ?? "") : "",
    targetCountry: countryNameFromCode(input.targetCountryCode) ?? "",
    targetRegion: input.targetRegion ?? "",
    arrAmount: input.ownArr ? String(input.ownArr.amount) : "",
    arrCurrency: input.ownArr?.currency ?? "USD",
    tamAmount: input.ownTam ? String(input.ownTam.amount) : "",
    tamCurrency: input.ownTam?.currency ?? "USD",
  }
}

const FORM_KEYS = Object.keys(EMPTY_COMPANY_FORM) as Array<keyof CompanyFormValues>

/** Same values field by field (Settings' Save changes is enabled only when not). */
export function companyFormsEqual(a: CompanyFormValues, b: CompanyFormValues) {
  return FORM_KEYS.every((key) => a[key] === b[key])
}

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  "1-10": "1–10 people",
  "11-50": "11–50 people",
  "51-200": "51–200 people",
  "200+": "More than 200 people",
}

/** The website and logo stored with the saved profile. */
export interface SavedLogo {
  websiteUrl: string
  logoUrl: string | null
}

/**
 * The stored logo while the typed website is still the saved one, else null.
 * useLogoPreview shows it without calling /api/gtm/fetch-logo, so loading
 * Settings or the New research run card never uses the daily logo quota.
 */
export function savedLogoFor(websiteUrl: string, saved: SavedLogo | null | undefined): string | null {
  if (!saved?.logoUrl || !websiteUrl.trim()) return null
  const same = websiteForDisplay(websiteUrl).toLowerCase() === websiteForDisplay(saved.websiteUrl).toLowerCase()
  return same ? saved.logoUrl : null
}
