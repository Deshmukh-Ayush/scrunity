import { z } from "zod"
import peopleSearch from "./fixtures/people-search-madhya-pradesh.json"
import workEmails from "./fixtures/work-email-results.json"
import { PEOPLE_SEARCH_CAPABILITY, PEOPLE_SEARCH_CREDITS_PER_RECORD } from "./people-search"
import { WORK_EMAIL_CAPABILITY, WORK_EMAIL_CREDITS_PER_RECORD } from "./work-email"

/**
 * A stand-in for `fetch` in GTM_PROVIDER_MODE=fixture: answers Firecrawl data
 * requests from the synthetic fixtures with zero network calls, in the
 * documented envelope, so fixture runs go through the same parsing, ledger and
 * cap code as live runs. See each fixture file's _note for what is assumed.
 */

const callSchema = z.object({
  provider: z.string(),
  capability: z.string(),
  options: z.record(z.string(), z.unknown()).default({}),
})
const bodySchema = z.object({ alexandria: z.union([callSchema, z.array(callSchema)]) })
const locationSchema = z.array(z.object({ value: z.string() })).catch([])

const PEOPLE: unknown[] = peopleSearch.people
const WORK_EMAILS: Record<string, unknown> = workEmails.results

function peopleSearchResult(options: Record<string, unknown>) {
  const locations = locationSchema.parse(options.person_locations).map((l) => l.value.toLowerCase())
  const matches = locations.some((l) => l.includes("madhya pradesh")) ? PEOPLE : []
  const offset = typeof options.offset === "number" ? options.offset : 0
  const limit = typeof options.limit === "number" ? options.limit : 6
  const people = matches.slice(offset, offset + limit)
  return {
    creditsCost: people.length * PEOPLE_SEARCH_CREDITS_PER_RECORD,
    data: { people, metadata: { total: matches.length, offset, search_after: null } },
  }
}

function workEmailResult(options: Record<string, unknown>) {
  const name = `${String(options.first_name ?? "")} ${String(options.last_name ?? "")}`.trim().toLowerCase()
  const data = z.object({ results: z.array(z.unknown()) }).catch({ results: [] }).parse(WORK_EMAILS[`${name}@${String(options.domain ?? "")}`])
  return { creditsCost: data.results.length > 0 ? WORK_EMAIL_CREDITS_PER_RECORD : 0, data }
}

export async function fixtureFetch(_url: string, init: RequestInit): Promise<Response> {
  const parsed = bodySchema.safeParse(JSON.parse(typeof init.body === "string" ? init.body : "{}"))
  if (!parsed.success) return new Response(JSON.stringify({ success: false, code: "BAD_REQUEST" }), { status: 400 })
  const calls = Array.isArray(parsed.data.alexandria) ? parsed.data.alexandria : [parsed.data.alexandria]
  const alexandria = calls.map((call) => {
    const result =
      call.capability === PEOPLE_SEARCH_CAPABILITY
        ? peopleSearchResult(call.options)
        : call.capability === WORK_EMAIL_CAPABILITY
          ? workEmailResult(call.options)
          : { creditsCost: 0, data: null }
    return { success: true, provider: call.provider, capability: call.capability, ...result }
  })
  return new Response(JSON.stringify({ success: true, data: { alexandria } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
