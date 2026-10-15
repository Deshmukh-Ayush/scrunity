/**
 * Industry names as the company database returns and filters them (Apollo's
 * lowercase LinkedIn industry list; organization search matches
 * `organization_industries[]` only on an exact name). A subset that covers the
 * segments we generate; the LLM may only pick from this list, so an unknown
 * name can never reach the provider. Names seen in recorded responses:
 * information technology & services, staffing & recruiting, e-learning,
 * media production, professional training & coaching, design, insurance,
 * computer & network security, outsourcing/offshoring, newspapers,
 * human resources, higher education.
 */
export const COMPANY_INDUSTRIES = [
  "accounting",
  "apparel & fashion",
  "architecture & planning",
  "automotive",
  "banking",
  "biotechnology",
  "building materials",
  "civil engineering",
  "commercial real estate",
  "computer & network security",
  "computer games",
  "computer hardware",
  "computer software",
  "construction",
  "consumer electronics",
  "consumer goods",
  "consumer services",
  "cosmetics",
  "design",
  "e-learning",
  "education management",
  "electrical/electronic manufacturing",
  "entertainment",
  "environmental services",
  "events services",
  "facilities services",
  "financial services",
  "food & beverages",
  "graphic design",
  "health, wellness & fitness",
  "higher education",
  "hospital & health care",
  "hospitality",
  "human resources",
  "import & export",
  "industrial automation",
  "information services",
  "information technology & services",
  "insurance",
  "internet",
  "investment management",
  "law practice",
  "legal services",
  "leisure, travel & tourism",
  "logistics & supply chain",
  "management consulting",
  "marketing & advertising",
  "market research",
  "mechanical or industrial engineering",
  "media production",
  "medical devices",
  "medical practice",
  "mental health care",
  "nonprofit organization management",
  "oil & energy",
  "online media",
  "outsourcing/offshoring",
  "pharmaceuticals",
  "printing",
  "professional training & coaching",
  "public relations & communications",
  "publishing",
  "real estate",
  "renewables & environment",
  "research",
  "restaurants",
  "retail",
  "security & investigations",
  "staffing & recruiting",
  "telecommunications",
  "translation & localization",
  "transportation/trucking/railroad",
  "venture capital & private equity",
  "wholesale",
  "writing & editing",
] as const

export type CompanyIndustry = (typeof COMPANY_INDUSTRIES)[number]

const KNOWN = new Set<string>(COMPANY_INDUSTRIES)

/** Keeps only exact, known industry names (lowercased, de-duplicated). */
export function knownIndustries(names: string[]): CompanyIndustry[] {
  const out = new Set<CompanyIndustry>()
  for (const name of names) {
    const lower = name.trim().toLowerCase()
    if (KNOWN.has(lower)) out.add(lower as CompanyIndustry)
  }
  return [...out]
}
