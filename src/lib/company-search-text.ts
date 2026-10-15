import type { CompanySearchFilters } from "@/db/schema"

/**
 * The company search in one plain sentence, for the selection gate, e.g.
 * "Searching: digital marketing agencies, 5–50 staff, United States;
 * excluding: staffing, recruiting, job boards". Pure: safe in client components.
 */
export function describeCompanySearch(filters: CompanySearchFilters): string {
  const parts = [filters.label]
  if (filters.industries.length > 0) parts[0] += ` (${filters.industries.join(", ")})`
  if (filters.headcountMin != null && filters.headcountMax != null) {
    parts.push(`${filters.headcountMin}–${filters.headcountMax} staff`)
  }
  parts.push(filters.market)
  const excluding = filters.excludeKeywords.length > 0 ? `; excluding: ${filters.excludeKeywords.join(", ")}` : ""
  return `Searching: ${parts.join(", ")}${excluding}`
}

/** "Matched keywords: …" line for the same filters. */
export function describeSearchKeywords(filters: CompanySearchFilters): string {
  return `Keywords: ${filters.includeKeywords.join(", ")}`
}
