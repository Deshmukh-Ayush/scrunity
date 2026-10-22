/** Every string the company profile adds, in one place for review. */
export const COMPANY_PROFILE_COPY = {
  // Settings page
  pageTitle: "Company profile",
  pageDescription: "The details research uses to find your competitors and the customers most likely to buy.",
  modeLegend: "New research runs",
  modeUseSaved: "Use my saved details",
  modeUseSavedText: "Each run starts from these details. You can change them for one run.",
  modeAsk: "Ask every time",
  modeAskText: "Useful for agencies running research for clients. Each run starts with an empty form.",
  save: "Save changes",
  saved: "Saved",
  noProfileYet: "No details saved yet. Save them here, or start a research run and they're saved for next time.",
  membersReadOnly: "Only owners and admins can change the company profile.",
  unsavedLeave: "You have unsaved changes. Leave without saving?",
  loadFailed: "The company profile didn't load. Refresh the page to try again.",
  saveFailed: "Changes weren't saved. Check your connection and try again.",
  invalid: "Some details are missing or not valid. Check the highlighted fields.",

  // Onboarding step
  onboardingStep: "Step 2 of 2",
  onboardingTitle: "Tell us about your company",
  onboardingDescription:
    "Research uses these details to find your competitors and the customers most likely to buy. We save them, so you don't type them again.",
  onboardingSave: "Save and continue",
  onboardingSkip: "Skip for now",
  onboardingSkipNote: "You can add them later in Settings or on your first research run.",

  // New research run
  savedForNextTime: "We'll save these details for your next run. You can change them in Settings.",
  summaryTitle: "Your saved details",
  changeForRun: "Change for this run",
  useSavedDetails: "Use saved details",
  fillWithSaved: "Fill with saved details",
  alsoUpdate: "Also update my saved profile",
  alsoUpdateText: "Otherwise these changes apply to this run only.",
  editInSettings: "Edit in Settings",
  summaryCompany: "Company",
  summaryWebsite: "Website",
  summaryReach: "Who you reach",
  summaryRegion: "Region",
  wholeCountry: "Whole country",
  profileNotSaved: "Research started, but your details weren't saved. Save them in Settings.",
} as const

/** "Last updated by Ayush on 21 Oct 2026": the date part is rendered by <LocalDate>. */
export const lastUpdatedBy = (name: string | null) => (name ? `Last updated by ${name} on` : "Last updated on")
