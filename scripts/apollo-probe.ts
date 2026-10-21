/**
 * Manual probe: which Apollo endpoints does YOUR key (e.g. a free plan) allow?
 * Run it yourself; nothing in the app calls it. It makes at most three
 * requests and prints only the endpoint, the HTTP status and the FIELD NAMES
 * of each response body (nested, e.g. "people[].organization.name"), never a
 * value, so the output can be shared.
 *
 *   npx tsx scripts/apollo-probe.ts --yes-spend-credits \
 *     --name "First Last" --domain company.com --org-domain company.com
 *
 * 1. POST /api/v1/mixed_people/api_search, one result per page (0 credits).
 * 2. POST /api/v1/people/match for --name at --domain (at most 1 credit;
 *    personal emails and phone numbers are not requested).
 * 3. GET  /api/v1/organizations/enrich for --org-domain (at most 1 credit).
 *
 * The key is read from .env.local (then .env): APOLLO_PROBE_API_KEY, else
 * APOLLO_API_KEY. It is sent only to api.apollo.io and never printed.
 * Without --yes-spend-credits the script exits before any request.
 * Steps 2 and 3 are skipped when their arguments are missing.
 */
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

const BASE = "https://api.apollo.io"
const TIMEOUT_MS = 20_000

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  const value = i >= 0 ? process.argv[i + 1] : undefined
  return value && !value.startsWith("--") ? value.trim() : null
}

/** Every key path in a JSON value; arrays are read through their first 3 items. Values are never kept. */
export function fieldNames(value: unknown, prefix = "", out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    if (value.length === 0) out.add(`${prefix}[]`)
    for (const item of value.slice(0, 3)) fieldNames(item, `${prefix}[]`, out)
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (child && typeof child === "object") fieldNames(child, path, out)
      else out.add(path)
    }
  }
  return out
}

async function probe(label: string, method: "GET" | "POST", path: string, apiKey: string, body?: unknown) {
  console.log(`\n${label}\n  ${method} ${path.split("?")[0]}`)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": apiKey },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    console.log(`  no response (${err instanceof Error ? err.name : "error"})`)
    return
  }
  console.log(`  HTTP ${res.status}`)
  const parsed: unknown = await res.json().catch(() => null)
  const fields = [...fieldNames(parsed)].sort()
  console.log(fields.length ? `  fields (${fields.length}):\n${fields.map((f) => `    ${f}`).join("\n")}` : "  no JSON fields")
}

async function main() {
  if (!process.argv.includes("--yes-spend-credits")) {
    console.error("Refusing to run: this can spend up to 2 Apollo credits. Re-run with --yes-spend-credits.")
    process.exit(1)
  }
  const apiKey = process.env.APOLLO_PROBE_API_KEY?.trim() || process.env.APOLLO_API_KEY?.trim()
  if (!apiKey) {
    console.error("No key: set APOLLO_PROBE_API_KEY (or APOLLO_API_KEY) in .env.local.")
    process.exit(1)
  }
  const name = arg("name")
  const domain = arg("domain")
  const orgDomain = arg("org-domain")

  await probe("1. People API search (0 credits)", "POST", "/api/v1/mixed_people/api_search", apiKey, {
    page: 1,
    per_page: 1,
    person_seniorities: ["owner", "founder", "c_suite"],
  })

  if (name && domain) {
    const [first, ...rest] = name.split(/\s+/)
    await probe("2. People match (at most 1 credit)", "POST", "/api/v1/people/match", apiKey, {
      first_name: first,
      last_name: rest.join(" ") || undefined,
      domain,
      reveal_personal_emails: false,
      reveal_phone_number: false,
    })
  } else {
    console.log("\n2. People match: skipped (pass --name \"First Last\" --domain company.com)")
  }

  if (orgDomain) {
    await probe("3. Organization enrichment (at most 1 credit)", "GET", `/api/v1/organizations/enrich?domain=${encodeURIComponent(orgDomain)}`, apiKey)
  } else {
    console.log("\n3. Organization enrichment: skipped (pass --org-domain company.com)")
  }
}

main().catch((err) => {
  console.error(`Probe failed: ${err instanceof Error ? err.name : "error"}`)
  process.exit(1)
})
