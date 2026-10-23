/**
 * The fields a list column can map to, and header auto-detection. Pure and
 * client-safe: the mapping step uses the same definitions as the server.
 */

export const IMPORT_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "title",
  "company",
  "website",
  "linkedinUrl",
  "phone",
  "city",
  "country",
  "notes",
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

/** One entry per file column: the field it fills, or null to ignore the column. */
export type ColumnMapping = Array<ImportField | null>

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email",
  title: "Job title",
  company: "Company",
  website: "Website or domain",
  linkedinUrl: "LinkedIn URL",
  phone: "Phone",
  city: "City",
  country: "Country",
  notes: "Notes",
}

/** Header spellings seen in CRM, Apollo, LinkedIn Sales Navigator, Excel and Sheets exports. */
const ALIASES: Record<ImportField, string[]> = {
  firstName: ["first name", "firstname", "first", "given name", "forename", "prenom", "vorname"],
  lastName: ["last name", "lastname", "last", "surname", "family name", "nom", "nachname"],
  fullName: ["full name", "fullname", "name", "contact name", "contact", "person", "person name"],
  email: ["email", "e-mail", "email address", "e-mail address", "work email", "business email", "mail", "contact email"],
  title: ["job title", "title", "position", "role", "job", "designation", "job role"],
  company: ["company", "company name", "organization", "organisation", "account", "account name", "employer", "firma"],
  website: ["website", "domain", "company domain", "company website", "url", "web", "site", "company url", "website url"],
  linkedinUrl: ["linkedin", "linkedin url", "linkedin profile", "person linkedin url", "linkedin profile url", "profile url"],
  phone: ["phone", "phone number", "mobile", "mobile phone", "telephone", "tel", "work phone", "direct phone"],
  city: ["city", "town", "location city"],
  country: ["country", "country name", "nation", "location country"],
  notes: ["notes", "note", "comments", "comment", "description", "remarks"],
}

/** Lowercase, no punctuation, single spaces; "(2)" duplicate suffixes removed. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(\d+\)$/, "")
    .replace(/[_\-./:]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const LOOKUP: Map<string, ImportField> = new Map(
  IMPORT_FIELDS.flatMap((field) => ALIASES[field].map((alias) => [normalizeHeader(alias), field] as const))
)

/** The field a header most likely means, or null. */
export function detectField(header: string): ImportField | null {
  const key = normalizeHeader(header)
  if (!key) return null
  const exact = LOOKUP.get(key)
  if (exact) return exact
  // Prefixed forms such as "Contact Email" or "Person First Name".
  if (/\bemail\b/.test(key) && !/\b(status|verified|opt|secondary|personal)\b/.test(key)) return "email"
  if (/\blinkedin\b/.test(key) && !/\bcompany\b/.test(key)) return "linkedinUrl"
  if (/\bfirst name\b/.test(key)) return "firstName"
  if (/\blast name\b/.test(key)) return "lastName"
  return null
}

/**
 * Auto-mapping for a file's headers: each field goes to the first column that
 * matches it; later columns that match an already-used field stay ignored, so
 * the user decides between duplicates.
 */
export function autoMapping(headers: string[]): ColumnMapping {
  const used = new Set<ImportField>()
  return headers.map((h) => {
    const field = detectField(h)
    if (!field || used.has(field)) return null
    used.add(field)
    return field
  })
}

/** What a mapping lacks for the required-field rule, or null when it can work. */
export function mappingProblem(mapping: ColumnMapping): "missing_identity" | "duplicate_field" | null {
  const fields = mapping.filter((f): f is ImportField => f !== null)
  if (new Set(fields).size !== fields.length) return "duplicate_field"
  const has = (f: ImportField) => fields.includes(f)
  const hasName = has("fullName") || (has("firstName") && has("lastName"))
  if (has("email")) return null
  if (hasName && has("website")) return null
  return "missing_identity"
}

/** Zod-free runtime check for a mapping that came from the browser. */
export function isColumnMapping(value: unknown, columnCount: number): value is ColumnMapping {
  return (
    Array.isArray(value) &&
    value.length === columnCount &&
    value.every((v) => v === null || (typeof v === "string" && (IMPORT_FIELDS as readonly string[]).includes(v)))
  )
}
