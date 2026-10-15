/**
 * Offline quality check of the company search and fit scoring, on the 15
 * companies the company database returned in the database-mode live test
 * (2026-10-15, segment "Digital Marketing Agencies", US; recorded in that
 * run's trace). No vendor calls: only the LLM (filter generation + one fit
 * scoring call per round).
 *
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-company-fit-offline.ts [rounds]
 *
 * Checks: the generated filters exclude staffing/recruiting look-alikes (from
 * the fixed exclusion list only); every staffing firm, job board, nonprofit,
 * directory and insurer scores below the pre-select threshold. Borderline
 * companies (the marketing newsletter) are reported, not asserted.
 */
import "dotenv/config"
import { FIT_PRESELECT_THRESHOLD, fitCriteria, generateCompanyFitScores } from "../src/lib/gtm-company-fit"
import { generateCompanySearchFilters, matchedExcludedTerm } from "../src/lib/gtm-company-search"
import { describeCompanySearch } from "../src/lib/company-search-text"

const SEGMENT = {
  name: "Digital Marketing Agencies",
  painPoint:
    "Need high-quality B2B leads and automated outreach to scale client campaigns, but manual prospecting consumes time and budget.",
  criteria: ["Revenue > $500K", "Serves B2B clients", "Team 5-20", "Uses multiple outreach channels"],
  targetKeywords: ["digital marketing", "agency", "b2b"],
  headcountMin: 5,
  headcountMax: 50,
}
const SELLER = "Scrunity AI: an AI outbound sales agent that finds verified B2B leads and writes outreach."

/** The live test's Apollo response (name, domain, employees, industry, HQ), and my judgement of each. */
const RECORDED: Array<{ name: string; domain: string | null; employees: number; industry: string; hq: string; kind: string }> = [
  { name: "The Marketing Millennials", domain: "themarketingmillennials.com", employees: 8, industry: "media production", hq: "Austin, Texas", kind: "media/newsletter (not an agency)" },
  { name: "Free Online Courses", domain: "onlinetutorials.org", employees: 14, industry: "e-learning", hq: "Los Alamitos, California", kind: "directory/content site" },
  { name: "Simon Sinek's The Optimism Company", domain: "simonsinek.com", employees: 30, industry: "professional training & coaching", hq: "New York, New York", kind: "author/training" },
  { name: "freeCodeCamp", domain: "freecodecamp.org", employees: 46, industry: "e-learning", hq: "San Francisco, California", kind: "nonprofit school" },
  { name: "Agency of Valor", domain: "agencyofvalor.com", employees: 21, industry: "insurance", hq: "Dallas, Texas", kind: "insurance agency" },
  { name: "Hire Resolve LLC - The Top Recruitment Agency", domain: "hireresolve.us", employees: 41, industry: "staffing & recruiting", hq: "Scottsdale, Arizona", kind: "staffing" },
  { name: "Remotivate", domain: "remotivatejobs.com", employees: 19, industry: "staffing & recruiting", hq: "Sheridan, Wyoming", kind: "staffing/job board" },
  { name: "Egger & Co", domain: null, employees: 5, industry: "information technology & services", hq: "Dover, Delaware", kind: "no website" },
  { name: "Pocketbook Agency", domain: "pocketbookagency.com", employees: 37, industry: "staffing & recruiting", hq: "Beverly Hills, California", kind: "staffing" },
  { name: "Method Recruiting, a 3x Inc. 5000 company", domain: "methodrecruiting.com", employees: 29, industry: "staffing & recruiting", hq: "San Francisco, California", kind: "staffing" },
  { name: "World Brand Design Society", domain: "worldbranddesign.com", employees: 36, industry: "design", hq: "Orlando, Florida", kind: "design community/directory" },
  { name: "Carter Murray", domain: "cartermurray.com", employees: 34, industry: "staffing & recruiting", hq: "De Pere, Wisconsin", kind: "staffing" },
  { name: "Talentoma", domain: "talentoma.com", employees: 14, industry: "staffing & recruiting", hq: "Los Angeles, California", kind: "staffing" },
  { name: "Wazaayf.com", domain: "wazaayf.com", employees: 31, industry: "staffing & recruiting", hq: "Cairo, West Virginia", kind: "job board" },
  { name: "Engtal", domain: "engtal.com", employees: 46, industry: "staffing & recruiting", hq: "Chicago, Illinois", kind: "staffing" },
]

/** The new query's response (dbtest-006478 trace); `agency` = my judgement: a digital marketing agency. */
const NEW_QUERY: Array<{ name: string; employees: number; industry: string; hq: string; agency: boolean }> = [
  { name: "Performance Marketing Association", employees: 8, industry: "information technology & services", hq: "Middletown, Delaware", agency: false },
  { name: "Search Engine Journal", employees: 40, industry: "information technology & services", hq: "Boca Raton, Florida", agency: false },
  { name: "Jordan Digital Marketing", employees: 43, industry: "marketing & advertising", hq: "San Francisco, California", agency: true },
  { name: "Mainland", employees: 30, industry: "marketing & advertising", hq: "Chicago, Illinois", agency: true },
  { name: "Attrock - Digital Marketing Agency", employees: 44, industry: "marketing & advertising", hq: "Florida", agency: true },
  { name: "Pixelo Digital", employees: 45, industry: "marketing & advertising", hq: "San Francisco, California", agency: true },
  { name: "ShoutVox", employees: 19, industry: "marketing & advertising", hq: "New York, New York", agency: true },
  { name: "8 Digital Marketing Agency", employees: 17, industry: "marketing & advertising", hq: "Los Angeles, California", agency: true },
  { name: "Helium SEO", employees: 50, industry: "marketing & advertising", hq: "Cincinnati, Ohio", agency: true },
  { name: "Search Engine Land", employees: 25, industry: "information technology & services", hq: "Edgartown, Massachusetts", agency: false },
  { name: "Fluxe Digital Marketing", employees: 8, industry: "marketing & advertising", hq: "Dallas, Texas", agency: true },
  { name: "Webiance - Digital Marketing for Travel Agencies", employees: 13, industry: "marketing & advertising", hq: "Kentucky", agency: true },
  { name: "Boot Camp Digital - Digital Marketing Training", employees: 19, industry: "education management", hq: "Miami, Florida", agency: false },
  { name: "Bad Rhino Digital Marketing", employees: 9, industry: "marketing & advertising", hq: "West Chester, Pennsylvania", agency: true },
  { name: "Syed Ramish Ali", employees: 14, industry: "management consulting", hq: "Davie, Florida", agency: false },
]

let failures = 0
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures++
}

async function main() {
  const rounds = Number(process.argv[2] ?? 2)
  console.log("1. Search filters generated from the segment")
  const filters = await generateCompanySearchFilters({ segment: SEGMENT, sellerDescription: SELLER, market: "United States" })
  console.log(`  gate line: "${describeCompanySearch(filters)}"`)
  console.log(`  include: ${filters.includeKeywords.join(", ")} | industries: ${filters.industries.join(", ") || "none"}`)
  check("no bare generic keyword ('agency', 'b2b') in the include list", !filters.includeKeywords.some((k) => ["agency", "b2b", "services"].includes(k)), filters.includeKeywords.join(", "))
  check("staffing/recruiting look-alikes are excluded", filters.excludeKeywords.some((k) => /staffing|recruit/.test(k)), filters.excludeKeywords.join(", "))

  const withDomain = RECORDED.filter((c) => c.domain)
  const excluded = withDomain.filter((c) => matchedExcludedTerm({ name: c.name, industry: c.industry, description: "" }, filters.excludeKeywords))
  console.log(`  locally excluded by those terms (name/industry only; the recording has no keyword tags): ${excluded.map((c) => c.name).join(", ") || "none"}`)

  console.log(`\n2. Fit scores for the ${withDomain.length} stored companies (threshold ${FIT_PRESELECT_THRESHOLD}), ${rounds} round(s)`)
  for (let round = 1; round <= rounds; round++) {
    const fits = await generateCompanyFitScores({
      segment: SEGMENT,
      companies: withDomain.map((c, i) => ({
        id: String(i), name: c.name, industry: c.industry, headcount: c.employees, revenueRange: null,
        location: `${c.hq}, United States`, description: "",
      })),
    })
    console.log(`  round ${round}:`)
    console.table(withDomain.map((c, i) => ({
      company: c.name.slice(0, 34), kind: c.kind, score: fits.get(String(i))?.score ?? null,
      preselected: (fits.get(String(i))?.score ?? -1) >= FIT_PRESELECT_THRESHOLD, reason: fits.get(String(i))?.reason.slice(0, 70),
    })))
    check(`round ${round}: every company was scored`, fits.size === withDomain.length, `${fits.size}/${withDomain.length}`)
    const preselected = withDomain.filter((_, i) => (fits.get(String(i))?.score ?? -1) >= FIT_PRESELECT_THRESHOLD)
    const junk = preselected.filter((c) => /staffing|job board|nonprofit|directory|insurance/.test(c.kind))
    check(`round ${round}: no staffing firm, job board, nonprofit, directory or insurer is pre-selected`, junk.length === 0, junk.map((c) => c.name).join(", "))
    console.log(`  round ${round}: pre-selected ${preselected.length} of ${withDomain.length}: ${preselected.map((c) => `${c.name} (${c.kind})`).join(", ") || "none"}`)
    const staffing = withDomain.map((c, i) => ({ c, s: fits.get(String(i))?.score ?? 100 })).filter(({ c }) => /staffing|job board/.test(c.kind))
    check(`round ${round}: staffing firms and job boards score under 40`, staffing.every(({ s }) => s < 40), staffing.map(({ c, s }) => `${c.name.split(" ")[0]} ${s}`).join(", "))
  }

  console.log(`\n3. The new query's 15 (live Stage 4, 2026-10-15, 36,671 matches), ${rounds} round(s)`)
  console.log(`  scorer criteria: ${fitCriteria(SEGMENT).join(", ")} (the segment's "Team 5-20" is dropped; band ${SEGMENT.headcountMin}-${SEGMENT.headcountMax})`)
  check("the free-text size criterion that contradicts the band is not sent to the scorer", !fitCriteria(SEGMENT).some((c) => /team/i.test(c)))
  for (let round = 1; round <= rounds; round++) {
    const fits = await generateCompanyFitScores({
      segment: SEGMENT,
      companies: NEW_QUERY.map((c, i) => ({
        id: String(i), name: c.name, industry: c.industry, headcount: c.employees, revenueRange: null,
        location: `${c.hq}, United States`, description: "",
      })),
    })
    const scoreOf = (i: number) => fits.get(String(i))?.score ?? -1
    console.table(NEW_QUERY.map((c, i) => ({
      company: c.name.slice(0, 34), staff: c.employees, agency: c.agency, score: scoreOf(i),
      preselected: scoreOf(i) >= FIT_PRESELECT_THRESHOLD, reason: fits.get(String(i))?.reason.slice(0, 64),
    })))
    const agencies = NEW_QUERY.map((c, i) => ({ c, i })).filter(({ c }) => c.agency)
    const picked = agencies.filter(({ i }) => scoreOf(i) >= FIT_PRESELECT_THRESHOLD)
    const wrong = NEW_QUERY.filter((c, i) => !c.agency && scoreOf(i) >= FIT_PRESELECT_THRESHOLD)
    console.log(`  round ${round}: ${picked.length} of ${agencies.length} real agencies pre-selected; ${wrong.length} non-agencies pre-selected`)
    check(`round ${round}: at least 9 of the 10 real agencies (8-50 staff) are pre-selected`, picked.length >= 9,
      agencies.filter(({ i }) => scoreOf(i) < FIT_PRESELECT_THRESHOLD).map(({ c, i }) => `${c.name} ${scoreOf(i)}`).join(", ") || "all")
    // The training firm and the consultancy carry a clear signal (industry, name) and must never be
    // pre-selected. The two SEO publications and the trade association are recorded here as only
    // "information technology & services" without the description the live search provides (live,
    // with it, they scored 30-40), so they are reported, not asserted.
    const clear = wrong.filter((c) => /training|ramish/i.test(c.name))
    check(`round ${round}: the training firm and the consultancy are not pre-selected`, clear.length === 0, clear.map((c) => c.name).join(", "))
    if (wrong.length) console.log(`  round ${round}: borderline non-agencies pre-selected (no description in this recording): ${wrong.map((c) => c.name).join(", ")}`)
  }
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
