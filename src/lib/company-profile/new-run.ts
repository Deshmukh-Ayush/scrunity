import { EMPTY_COMPANY_FORM, companyInputToForm, type CompanyFormValues } from "./form"
import type { PublicCompanyProfile } from "./input"

/**
 * The New research run form step, as a small state machine. Pure, so the
 * testing route and the unit tests drive the same transitions.
 * - first_run: no profile saved yet. Full form; starting the run saves it.
 * - summary: use_saved. A card of the saved details, no form.
 * - editing: use_saved after "Change for this run". The form, prefilled.
 * - ask: ask_every_time. The form, empty, with "Fill with saved details".
 * - unavailable: the profile didn't load. Full form, nothing is saved.
 */
export type NewRunView = "first_run" | "summary" | "editing" | "ask" | "unavailable"

export interface NewRunState {
  view: NewRunView
  form: CompanyFormValues
  /** "Also update my saved profile" (editing and ask only). */
  alsoUpdate: boolean
  saved: PublicCompanyProfile | null
}

export type NewRunAction =
  | { type: "edit"; patch: Partial<CompanyFormValues> }
  | { type: "change_for_run" }
  | { type: "use_saved" }
  | { type: "fill_saved" }
  | { type: "set_also_update"; checked: boolean }

export function initialNewRunState(saved: PublicCompanyProfile | null, loaded = true): NewRunState {
  const base = { form: EMPTY_COMPANY_FORM, alsoUpdate: false, saved }
  if (!loaded) return { ...base, view: "unavailable", saved: null }
  if (!saved) return { ...base, view: "first_run" }
  if (saved.researchFormMode === "ask_every_time") return { ...base, view: "ask" }
  return { ...base, view: "summary", form: companyInputToForm(saved.values) }
}

export function newRunReducer(state: NewRunState, action: NewRunAction): NewRunState {
  const savedForm = state.saved ? companyInputToForm(state.saved.values) : null
  switch (action.type) {
    case "edit":
      // Any view: after the run starts, the profile confirmation step edits the description.
      return { ...state, form: { ...state.form, ...action.patch } }
    case "change_for_run":
      return state.view === "summary" ? { ...state, view: "editing" } : state
    case "use_saved":
      // Back to the card: this run's edits are dropped.
      return state.view === "editing" && savedForm
        ? { ...state, view: "summary", form: savedForm, alsoUpdate: false }
        : state
    case "fill_saved":
      return state.view === "ask" && savedForm ? { ...state, form: savedForm } : state
    case "set_also_update":
      return state.view === "editing" || state.view === "ask" ? { ...state, alsoUpdate: action.checked } : state
  }
}

/** Whether starting the run also writes these details to the saved profile. */
export function savesProfileOnStart(state: NewRunState): boolean {
  if (state.view === "first_run") return true
  if (state.view === "editing" || state.view === "ask") return state.alsoUpdate
  return false
}

/** Whether the step shows the form (every view but the summary card). */
export const showsForm = (view: NewRunView) => view !== "summary"
