/**
 * Turning a list's rows into the companies and people of one campaign. Pure.
 * People are grouped by company domain, else by company name; someone with
 * neither (a personal email and no company column) is a company of one. A
 * campaign takes the first `maxCompanies` companies in file order; the rest
 * of the list is left for the next campaign.
 */

export interface ImportRowLike {
  id: string
  rowNumber: number
  email: string | null
  firstName: string | null
  lastName: string | null
  fullName: string | null
  title: string | null
  companyName: string | null
  companyDomain: string | null
  website: string | null
  linkedinUrl: string | null
  city: string | null
  country: string | null
}

export interface ImportCompanyGroup {
  key: string
  name: string
  /** "" when the list gave no website and the email is personal. */
  domain: string
  website: string | null
  location: string
  city: string | null
  country: string | null
  people: ImportRowLike[]
}

export const UNKNOWN_COMPANY = "Company not given"

export function companyKey(row: Pick<ImportRowLike, "id" | "companyDomain" | "companyName">): string {
  if (row.companyDomain) return `domain:${row.companyDomain}`
  if (row.companyName) return `name:${row.companyName.trim().toLowerCase()}`
  return `row:${row.id}`
}

export function personName(row: Pick<ImportRowLike, "fullName" | "firstName" | "lastName">): string {
  return row.fullName ?? [row.firstName, row.lastName].filter(Boolean).join(" ")
}

export function groupImportRows(
  rows: ImportRowLike[],
  { maxCompanies, skipEmails = new Set() }: { maxCompanies: number; skipEmails?: ReadonlySet<string> }
): { companies: ImportCompanyGroup[]; skippedAlreadyUsed: number; leftForLater: number } {
  const groups = new Map<string, ImportCompanyGroup>()
  let skippedAlreadyUsed = 0
  let leftForLater = 0
  for (const row of [...rows].sort((a, b) => a.rowNumber - b.rowNumber)) {
    if (row.email && skipEmails.has(row.email)) {
      skippedAlreadyUsed++
      continue
    }
    const key = companyKey(row)
    let group = groups.get(key)
    if (!group) {
      if (groups.size >= maxCompanies) {
        leftForLater++
        continue
      }
      group = {
        key,
        name: row.companyName ?? row.companyDomain ?? UNKNOWN_COMPANY,
        domain: row.companyDomain ?? "",
        website: row.website,
        location: [row.city, row.country].filter(Boolean).join(", ") || "Unknown",
        city: row.city,
        country: row.country,
        people: [],
      }
      groups.set(key, group)
    }
    group.people.push(row)
  }
  return { companies: [...groups.values()], skippedAlreadyUsed, leftForLater }
}
