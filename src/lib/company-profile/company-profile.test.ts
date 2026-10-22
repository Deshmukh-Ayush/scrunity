import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { requiresManagerRole, MANAGER_ROLES } from "@/lib/api-role-policy"
import {
  EMPTY_COMPANY_FORM,
  companyFormToInput,
  companyFormsEqual,
  companyInputToForm,
  validateCompanyForm,
  type CompanyFormValues,
} from "./form"
import {
  companyProfileColumns,
  profileWriteForNewRun,
  researchRunSnapshot,
  saveCompanyProfileSchema,
  toPublicCompanyProfile,
  type CompanyProfileRow,
  type PublicCompanyProfile,
} from "./input"
import { initialNewRunState, newRunReducer, savesProfileOnStart } from "./new-run"

const FILLED: CompanyFormValues = {
  ...EMPTY_COMPANY_FORM,
  websiteUrl: "routewise.example",
  companyName: "Routewise",
  companyDescription: "Route-planning software that cuts fuel costs for mid-size logistics firms.",
  companySize: "51-200",
  targetCountry: "India",
  targetRegion: "Maharashtra",
  arrAmount: "1800000",
  arrCurrency: "INR",
}

const row = (overrides: Partial<CompanyProfileRow> = {}): CompanyProfileRow => {
  const input = companyFormToInput(FILLED)
  assert.ok(input)
  return {
    ...companyProfileColumns(input),
    researchFormMode: "use_saved",
    updatedAt: new Date("2026-10-21T09:30:00.000Z"),
    ...overrides,
  } as CompanyProfileRow
}

const saved = (mode: PublicCompanyProfile["researchFormMode"] = "use_saved") =>
  toPublicCompanyProfile(row({ researchFormMode: mode }), "Priya Shah")

describe("company profile save and load", () => {
  it("round-trips the form through the saved row and back", () => {
    const profile = saved()
    assert.equal(profile.values.websiteUrl, "https://routewise.example")
    assert.deepEqual(profile.values.ownArr, { amount: 1800000, currency: "INR" })
    assert.equal(profile.values.ownTam, null)
    assert.ok(companyFormsEqual(companyInputToForm(profile.values), FILLED))
    assert.equal(profile.updatedByName, "Priya Shah")
    assert.equal(profile.updatedAt, "2026-10-21T09:30:00.000Z")
  })

  it("accepts the PUT body the Settings form sends and refuses a missing field", () => {
    const input = companyFormToInput(FILLED)
    assert.ok(saveCompanyProfileSchema.safeParse({ ...input, researchFormMode: "ask_every_time" }).success)
    assert.equal(saveCompanyProfileSchema.safeParse({ ...input, companyName: " ", researchFormMode: "use_saved" }).success, false)
    assert.equal(saveCompanyProfileSchema.safeParse({ ...input, researchFormMode: "sometimes" }).success, false)
  })

  it("flags the required fields and returns no payload until they are filled", () => {
    assert.deepEqual(Object.keys(validateCompanyForm(EMPTY_COMPANY_FORM)).sort(), [
      "companyDescription",
      "companyName",
      "targetCountry",
      "websiteUrl",
    ])
    assert.equal(companyFormToInput(EMPTY_COMPANY_FORM), null)
  })
})

describe("research run snapshot", () => {
  it("is independent of later profile edits", () => {
    const profile = saved()
    const snapshot = researchRunSnapshot(profile.values)
    const before = structuredClone(snapshot)
    profile.values.companyName = "Routewise Labs"
    profile.values.targetRegion = "Karnataka"
    if (profile.values.ownArr) profile.values.ownArr.amount = 1
    assert.deepEqual(snapshot, before)
    assert.equal(snapshot.companyName, "Routewise")
    assert.equal(snapshot.ownArrAmount, 1800000)
  })
})

describe("new research run form", () => {
  it("first run without a profile shows the full, empty form and saves it", () => {
    const state = initialNewRunState(null)
    assert.equal(state.view, "first_run")
    assert.ok(companyFormsEqual(state.form, EMPTY_COMPANY_FORM))
    assert.equal(savesProfileOnStart(state), true)
  })

  it("use_saved shows the summary and leaves the profile unchanged without the tick", () => {
    let state = initialNewRunState(saved())
    assert.equal(state.view, "summary")
    assert.equal(savesProfileOnStart(state), false)

    state = newRunReducer(state, { type: "change_for_run" })
    state = newRunReducer(state, { type: "edit", patch: { targetRegion: "Karnataka" } })
    assert.equal(state.view, "editing")
    assert.equal(state.form.targetRegion, "Karnataka")
    assert.equal(savesProfileOnStart(state), false)
    assert.equal(profileWriteForNewRun(savesProfileOnStart(state)), "insert_if_missing")
    assert.equal(state.saved?.values.targetRegion, "Maharashtra")

    state = newRunReducer(state, { type: "set_also_update", checked: true })
    assert.equal(profileWriteForNewRun(savesProfileOnStart(state)), "upsert")
  })

  it("use_saved: going back to the saved details drops this run's edits", () => {
    let state = newRunReducer(initialNewRunState(saved()), { type: "change_for_run" })
    state = newRunReducer(state, { type: "edit", patch: { companyName: "Other" } })
    state = newRunReducer(state, { type: "set_also_update", checked: true })
    state = newRunReducer(state, { type: "use_saved" })
    assert.equal(state.view, "summary")
    assert.equal(state.form.companyName, "Routewise")
    assert.equal(state.alsoUpdate, false)
  })

  it("ask_every_time starts empty and Fill with saved details fills it", () => {
    let state = initialNewRunState(saved("ask_every_time"))
    assert.equal(state.view, "ask")
    assert.ok(companyFormsEqual(state.form, EMPTY_COMPANY_FORM))
    assert.equal(savesProfileOnStart(state), false)
    state = newRunReducer(state, { type: "fill_saved" })
    assert.ok(companyFormsEqual(state.form, FILLED))
    assert.equal(savesProfileOnStart(state), false)
  })

  it("saves nothing when the profile didn't load", () => {
    const state = initialNewRunState(null, false)
    assert.equal(state.view, "unavailable")
    assert.equal(savesProfileOnStart(state), false)
  })
})

describe("who can save the profile", () => {
  it("the proxy refuses a member's PUT and lets members read", () => {
    assert.equal(requiresManagerRole("PUT", "/api/gtm/company-profile"), true)
    assert.equal(requiresManagerRole("GET", "/api/gtm/company-profile"), false)
    assert.equal(MANAGER_ROLES.has("member"), false)
    assert.equal(MANAGER_ROLES.has("admin"), true)
  })
})
