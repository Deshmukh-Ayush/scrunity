import { loadApolloOrgSearchFixture } from "@/lib/providers/fixtures"
import { BULK_MATCH_PATH, ORG_SEARCH_PATH, PEOPLE_SEARCH_PATH } from "./constants"

/**
 * A stand-in for `fetch` in GTM_PROVIDER_MODE=fixture: answers Apollo requests
 * with zero network calls, so a connected-Apollo campaign can run end to end
 * offline. Organization search serves the recorded, sanitized responses
 * (lib/providers/fixtures); people search and bulk match are SYNTHETIC:
 * invented names, ids prefixed "fx-ap-", three people per company domain:
 *  1. a verified email at the company's domain,
 *  2. an email Apollo marks "unverified" (must never be stored),
 *  3. no match at all (free).
 * The key value is never checked except for the literal "fixture_invalid_key",
 * which answers 401 so the reconnect path can be exercised offline.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const FIRST_NAMES = ["Asha", "Ravi", "Meera"]
const LAST_NAMES = ["Fixturekar", "Testwala", "Samplerao"]

function header(init: RequestInit, name: string): string | null {
  const headers = new Headers(init.headers)
  return headers.get(name)
}

function peopleFor(domain: string) {
  return FIRST_NAMES.map((first, i) => ({
    id: `fx-ap-${domain}-${i + 1}`,
    first_name: first,
    last_name_obfuscated: `${LAST_NAMES[i].slice(0, 2)}***${LAST_NAMES[i].slice(-1)}`,
    title: i === 0 ? "Founder" : i === 1 ? "Head of Operations" : "Director",
    has_email: true,
    organization: { name: domain },
  }))
}

function matchFor(id: string) {
  const found = /^fx-ap-(.+)-(\d)$/.exec(id)
  if (!found) return null
  const [, domain, n] = found
  const i = Number(n) - 1
  if (i === 2) return null
  return {
    id,
    first_name: FIRST_NAMES[i],
    last_name: LAST_NAMES[i],
    title: i === 0 ? "Founder" : "Head of Operations",
    linkedin_url: `https://www.linkedin.example/in/${FIRST_NAMES[i].toLowerCase()}-${LAST_NAMES[i].toLowerCase()}`,
    email: `${FIRST_NAMES[i].toLowerCase()}@${domain}`,
    email_status: i === 0 ? "verified" : "unverified",
  }
}

export async function apolloFixtureFetch(url: string, init: RequestInit): Promise<Response> {
  if (header(init, "x-api-key") === "fixture_invalid_key") return json({ error: "Invalid access credentials." }, 401)
  const parsed = new URL(url)
  if (parsed.pathname === PEOPLE_SEARCH_PATH) {
    const domain = parsed.searchParams.get("q_organization_domains_list[]")
    const people = domain ? peopleFor(domain) : peopleFor("example.com").slice(0, 1)
    return json({ total_entries: people.length, people })
  }
  if (parsed.pathname === ORG_SEARCH_PATH) {
    const location = parsed.searchParams.get("organization_locations[]") ?? ""
    const country = location.split(",").pop()?.trim() ?? location
    return json(loadApolloOrgSearchFixture(country))
  }
  if (parsed.pathname === BULK_MATCH_PATH) {
    const body = JSON.parse(typeof init.body === "string" ? init.body : "{}") as { details?: Array<{ id?: string }> }
    const matches = (body.details ?? []).map((d) => (d.id ? matchFor(d.id) : null))
    return json({ matches, credits_consumed: matches.filter(Boolean).length })
  }
  return json({ error: "Not found" }, 404)
}
