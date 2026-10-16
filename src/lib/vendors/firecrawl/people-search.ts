import { z } from "zod"
import { FirecrawlDataError } from "./errors"
import type { PeopleSearchFilters } from "@/lib/providers/types"
import type { AlexandriaCall } from "./client"

/**
 * FullEnrich people search through Firecrawl (capability "people/search").
 *
 * Documented: options take arrays of `{ value, exclude?, exact_match? }`
 * (person_locations, current_position_titles, current_position_seniority_level,
 * current_company_industries, ...) and `{ min?, max? }` ranges
 * (current_company_headcounts); `limit` is at most 6 records per page, `offset`
 * pages, `search_after` is needed beyond 10,000. The response is
 * `{ people: [...], metadata: { total, offset, search_after } }`; each person
 * has id, full_name, first_name, last_name, headline, location,
 * social_profiles and employment. 5 credits per returned record; an empty page
 * is free.
 *
 * NOT documented: the contents of `location`, `social_profiles` and
 * `employment`. They are read tolerantly below (several plausible key names);
 * a person whose current company or its domain cannot be read is skipped, never
 * guessed. Verify against a live response before relying on yield.
 */

export const PEOPLE_SEARCH_CAPABILITY = "people/search"
export const PEOPLE_SEARCH_PAGE_SIZE = 6
export const PEOPLE_SEARCH_CREDITS_PER_RECORD = 5

export type { PeopleSearchFilters }

export interface FoundCompany {
  id: string | null
  name: string
  domain: string | null
  linkedinUrl: string | null
  industry: string | null
  headcount: number | null
  location: string | null
}

export interface FoundPerson {
  id: string
  firstName: string
  lastName: string
  title: string | null
  linkedinUrl: string | null
  location: string | null
  company: FoundCompany | null
}

const values = (list: string[]) => list.filter(Boolean).map((value) => ({ value }))

/** Options for one page of the search. Empty filters are left out. */
export function buildPeopleSearchOptions(
  filters: PeopleSearchFilters,
  page: { limit: number; offset: number }
): Record<string, unknown> {
  const options: Record<string, unknown> = { limit: page.limit, offset: page.offset }
  if (filters.locations.length) options.person_locations = values(filters.locations)
  if (filters.titles.length) options.current_position_titles = values(filters.titles)
  if (filters.seniority.length) options.current_position_seniority_level = values(filters.seniority)
  if (filters.industries.length) options.current_company_industries = values(filters.industries)
  if (filters.headcountMin != null || filters.headcountMax != null) {
    const range: { min?: number; max?: number } = {}
    if (filters.headcountMin != null) range.min = filters.headcountMin
    if (filters.headcountMax != null) range.max = filters.headcountMax
    options.current_company_headcounts = [range]
  }
  return options
}

export function peopleSearchCall(filters: PeopleSearchFilters, page: { limit: number; offset: number }): AlexandriaCall {
  return { provider: "fullenrich", capability: PEOPLE_SEARCH_CAPABILITY, options: buildPeopleSearchOptions(filters, page) }
}

// ---- Response parsing ----------------------------------------------------

const record = z.record(z.string(), z.unknown())
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null)
const asRecord = (v: unknown) => {
  const parsed = record.safeParse(v)
  return parsed.success ? parsed.data : null
}
const firstText = (obj: Record<string, unknown> | null, keys: string[]) => {
  for (const key of keys) {
    const value = text(obj?.[key])
    if (value) return value
  }
  return null
}

/** linkedin.example is the reserved fixture host (synthetic people only). */
const LINKEDIN_PROFILE = /linkedin\.(com|example)\/in\//i

/** First LinkedIn profile URL anywhere inside a value (social_profiles' layout is undocumented). */
export function findLinkedInProfile(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null
  if (typeof value === "string") return LINKEDIN_PROFILE.test(value) ? value.trim() : null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findLinkedInProfile(item, depth + 1)
      if (found) return found
    }
    return null
  }
  const obj = asRecord(value)
  if (!obj) return null
  for (const item of Object.values(obj)) {
    const found = findLinkedInProfile(item, depth + 1)
    if (found) return found
  }
  return null
}

export function normalizeDomain(raw: string | null): string | null {
  if (!raw) return null
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase()
    return host.replace(/^www\./, "") || null
  } catch {
    return null
  }
}

function locationText(value: unknown): string | null {
  const direct = text(value)
  if (direct) return direct
  const obj = asRecord(value)
  if (!obj) return null
  const whole = firstText(obj, ["name", "raw", "full", "formatted", "default"])
  if (whole) return whole
  const parts = ["city", "region", "state", "country"].map((k) => text(obj[k])).filter(Boolean)
  return parts.length ? parts.join(", ") : null
}

/** The current position: `employment.current`, or the employment entry flagged current. */
function currentPosition(employment: unknown): Record<string, unknown> | null {
  const obj = asRecord(employment)
  const current = obj?.current
  if (Array.isArray(current)) return asRecord(current[0])
  if (current !== undefined) return asRecord(current)
  const list = Array.isArray(employment) ? employment : Array.isArray(obj?.positions) ? obj.positions : null
  if (!list) return null
  const entries = list.map(asRecord).filter((e): e is Record<string, unknown> => e !== null)
  return entries.find((e) => e.is_current === true || e.current === true) ?? null
}

function parseCompany(position: Record<string, unknown> | null): FoundCompany | null {
  if (!position) return null
  const company = asRecord(position.company) ?? position
  const name = firstText(company, ["name", "company_name"])
  if (!name) return null
  const domain = normalizeDomain(firstText(company, ["domain", "website", "website_url", "company_domain"]))
  return {
    id: firstText(company, ["id", "company_id"]),
    name,
    domain,
    linkedinUrl: firstText(company, ["linkedin_url", "professional_network_url"]),
    industry: firstText(company, ["industry"]) ?? (Array.isArray(company.industries) ? text(company.industries[0]) : null),
    headcount: num(company.headcount) ?? num(company.employee_count) ?? num(company.employees_count),
    location: locationText(company.headquarters ?? company.location),
  }
}

const personSchema = z.looseObject({
  id: z.union([z.string(), z.number()]).nullish(),
  full_name: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  headline: z.string().nullish(),
  location: z.unknown().optional(),
  social_profiles: z.unknown().optional(),
  employment: z.unknown().optional(),
})

const dataSchema = z.looseObject({
  people: z.array(z.unknown()),
  metadata: z
    .looseObject({ total: z.number().nullish(), search_after: z.unknown().optional() })
    .nullish(),
})

function parsePerson(raw: unknown): FoundPerson | null {
  const parsed = personSchema.safeParse(raw)
  if (!parsed.success) return null
  const p = parsed.data
  const full = text(p.full_name)
  const first = text(p.first_name) ?? full?.split(/\s+/)[0] ?? null
  const last = text(p.last_name) ?? (full ? full.split(/\s+/).slice(1).join(" ") : null)
  if (!first) return null
  const linkedinUrl = findLinkedInProfile(p.social_profiles)
  const id = p.id != null ? String(p.id) : linkedinUrl
  if (!id) return null
  const position = currentPosition(p.employment)
  return {
    id,
    firstName: first,
    lastName: last ?? "",
    title: firstText(position, ["title", "job_title", "position"]) ?? text(p.headline),
    linkedinUrl,
    location: locationText(p.location),
    company: parseCompany(position),
  }
}

export interface PeopleSearchPage {
  people: FoundPerson[]
  /** Records Firecrawl returned (and billed), including any we could not read. */
  returned: number
  total: number | null
}

/** Narrows one people/search `data` payload. Throws when it has no people array. */
export function parsePeopleSearchData(data: unknown): PeopleSearchPage {
  const parsed = dataSchema.safeParse(data)
  if (!parsed.success) {
    throw new FirecrawlDataError("provider_request_failed", "people search data without a people array", null, "unknown")
  }
  const people = parsed.data.people.map(parsePerson).filter((p): p is FoundPerson => p !== null)
  return { people, returned: parsed.data.people.length, total: parsed.data.metadata?.total ?? null }
}

// ---- Pagination, grouping, dedupe ----------------------------------------

/** Pages (limit/offset) needed to read up to `cap` records. */
export function planPages(cap: number, pageSize = PEOPLE_SEARCH_PAGE_SIZE): Array<{ limit: number; offset: number }> {
  const pages: Array<{ limit: number; offset: number }> = []
  for (let offset = 0; offset < cap; offset += pageSize) {
    pages.push({ limit: Math.min(pageSize, cap - offset), offset })
  }
  return pages
}

/**
 * Reads pages in groups (one request each, at most `pagesPerRequest` calls)
 * until `cap` records, a short page, the reported total, or `enough` says the
 * people so far suffice. `runGroup` makes the request (and enforces credit caps
 * before it); a later group never starts once a page came back short, so the
 * search never pays for pages past the end.
 */
export async function collectPeople({
  cap,
  pagesPerRequest,
  runGroup,
  enough,
}: {
  cap: number
  pagesPerRequest: number
  runGroup: (pages: Array<{ limit: number; offset: number }>) => Promise<PeopleSearchPage[]>
  enough?: (people: FoundPerson[]) => boolean
}): Promise<{ people: FoundPerson[]; returned: number; total: number | null; requests: number }> {
  const pages = planPages(cap)
  const people: FoundPerson[] = []
  let returned = 0
  let total: number | null = null
  let requests = 0
  for (let i = 0; i < pages.length; i += pagesPerRequest) {
    const group = pages.slice(i, i + pagesPerRequest)
    const results = await runGroup(group)
    requests++
    let ended = false
    for (const [index, page] of results.entries()) {
      people.push(...page.people)
      returned += page.returned
      total = page.total ?? total
      if (page.returned < group[index].limit) ended = true
    }
    if (ended || returned >= cap || (total !== null && returned >= total) || enough?.(people)) break
  }
  return { people: people.slice(0, cap), returned, total, requests }
}

const normalizeLinkedIn = (url: string) =>
  url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "")

/** Keys that identify the same person: LinkedIn profile, or name at company domain. */
export function personKeys(p: { firstName: string; lastName: string; linkedinUrl: string | null; domain: string | null }): string[] {
  const keys: string[] = []
  if (p.linkedinUrl) keys.push(`li:${normalizeLinkedIn(p.linkedinUrl)}`)
  const name = `${p.firstName} ${p.lastName}`.trim().toLowerCase().replace(/\s+/g, " ")
  if (name && p.domain) keys.push(`name:${name}@${p.domain}`)
  return keys
}

/**
 * Drops repeats within the run (same id or same keys) and people already known
 * to the organization (`existing`, from personKeys of stored contacts).
 */
export function dedupePeople(
  people: FoundPerson[],
  existing: ReadonlySet<string> = new Set()
): { kept: FoundPerson[]; duplicates: number; alreadyKnown: number } {
  const seen = new Set<string>()
  const kept: FoundPerson[] = []
  let duplicates = 0
  let alreadyKnown = 0
  for (const person of people) {
    const keys = [`id:${person.id}`, ...personKeys({ ...person, domain: person.company?.domain ?? null })]
    if (keys.some((k) => seen.has(k))) {
      duplicates++
      continue
    }
    keys.forEach((k) => seen.add(k))
    if (keys.some((k) => existing.has(k))) {
      alreadyKnown++
      continue
    }
    kept.push(person)
  }
  return { kept, duplicates, alreadyKnown }
}

export interface CompanyGroup {
  company: FoundCompany & { domain: string }
  people: FoundPerson[]
}

/** Groups people by current company domain, in first-seen order. People without a domain are counted, not grouped. */
export function groupByCompany(people: FoundPerson[]): { groups: CompanyGroup[]; withoutDomain: number } {
  const groups = new Map<string, CompanyGroup>()
  let withoutDomain = 0
  for (const person of people) {
    const domain = person.company?.domain
    if (!person.company || !domain) {
      withoutDomain++
      continue
    }
    const group = groups.get(domain)
    if (group) {
      group.people.push(person)
      group.company.headcount ??= person.company.headcount
      group.company.industry ??= person.company.industry
    } else {
      groups.set(domain, { company: { ...person.company, domain }, people: [person] })
    }
  }
  return { groups: [...groups.values()], withoutDomain }
}
