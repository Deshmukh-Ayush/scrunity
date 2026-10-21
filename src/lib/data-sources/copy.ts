/**
 * Every customer-facing string about data sources, in one place for review.
 * Pure and client-safe. Apollo is named on purpose: it is the customer's own
 * account, and they need to know where to act (reconnect, add credits).
 * Never claims Scrunity does not read the data: the agent reads leads to
 * write emails.
 */

const pluralRules = new Intl.PluralRules("en")
const credits = (n: number) => `${n} Apollo ${pluralRules.select(n) === "one" ? "credit" : "credits"}`

export const DATA_SOURCE_COPY = {
  pageTitle: "Data sources",
  pageDescription: "Campaigns find companies and decision makers with your own Apollo account, or use people from a list you import.",
  apolloName: "Apollo",
  apolloDescription: "Finds companies, decision makers and verified work emails.",

  statusNotConnected: "Not connected",
  statusConnecting: "Checking key",
  statusConnected: "Connected",
  statusNeedsReconnect: "Needs reconnect",
  statusError: "Check failed",

  notConnectedText: "Connect Apollo to start campaigns.",
  connectingText: "Checking your key with Apollo. This takes a few seconds.",
  needsReconnectText: "Apollo rejected the saved key, so campaigns can't search. Connect a new key to continue.",
  managerOnly: "Only owners and admins can connect or disconnect data sources.",
  connectedMeta: (last4: string | null) => (last4 ? `Key ending in ${last4}` : "Key saved"),
  connectedSince: "Connected on",
  lastChecked: "Last checked",

  disclosureTitle: "How your key is used",
  disclosure: [
    "Your key is used only to run your campaigns.",
    "It is stored encrypted.",
    "Apollo's terms limit how tools like Scrunity may use customer keys. We have asked Apollo to approve this integration. Until they do, Apollo could restrict your account.",
  ],

  connectAction: "Connect Apollo",
  reconnectAction: "Reconnect Apollo",
  disconnectAction: "Disconnect Apollo",
  cancelAction: "Cancel",
  showKey: "Show key",

  dialogTitle: "Connect Apollo",
  dialogDescription: "Paste an API key from your Apollo account. Scrunity checks it with one free search before saving it.",
  keyLabel: "Apollo API key",
  keyHint: "Use a master key, or a key with access to People API Search, Organization Search and Bulk People Enrichment.",
  keyMissing: "Paste your Apollo API key.",

  disconnectTitle: "Disconnect Apollo?",
  disconnectBody:
    "Your key is deleted from Scrunity right away. Campaigns can't find new contacts until you connect Apollo again. Contacts already found stay in your campaigns.",

  connectedToast: "Apollo connected",
  disconnectedToast: "Apollo disconnected",

  startBlocked: "Connect your Apollo account to start campaigns. Campaigns use your Apollo credits to find contacts.",
  startBlockedReconnect: "Apollo rejected your saved key. Reconnect Apollo to start campaigns.",
  unavailable: "Data sources aren't available right now. Contact support.",

  loadErrorStatus: "Didn't load",
  loadErrorText: "Your data sources didn't load, so we can't show whether Apollo is connected. Try again in a moment.",
  loadErrorTimeoutText: "Your data sources are taking too long to load. Try again in a moment.",
  retryAction: "Try again",

  /** The estimate on the segment step, before "Start". */
  estimate: (perCampaign: number, count: number) =>
    count > 1
      ? `Uses up to ${credits(perCampaign * count)}, ${perCampaign} per campaign.`
      : `Uses up to ${credits(perCampaign)}.`,
  estimateDetail: "A campaign stops before it uses more.",
} as const

/** Connect errors, by public code (lib/data-sources/codes.ts). */
export const CONNECT_ERROR_COPY: Record<string, string> = {
  data_source_key_invalid: "Apollo didn't accept this key. Check that you copied the whole key, then try again.",
  data_source_plan_blocked:
    "Your Apollo plan does not allow search through the API. Use a key from an Apollo plan with API access.",
  data_source_credits_used_up: "Your Apollo credits are used up. Add credits in Apollo, then try again.",
  data_source_rate_limited: "Apollo is limiting requests right now. Wait a minute, then try again.",
  data_source_request_failed: "Apollo didn't respond. Try again in a minute.",
  data_source_unavailable: DATA_SOURCE_COPY.unavailable,
}

export const connectErrorText = (code: string | null | undefined) =>
  (code && CONNECT_ERROR_COPY[code]) || CONNECT_ERROR_COPY.data_source_request_failed

/** Campaign failures, by public code (shown on the campaign page's process card). */
export const CAMPAIGN_DATA_SOURCE_FAILURE_TEXT: Record<string, string> = {
  data_source_key_invalid: "Apollo rejected your key, so the campaign stopped. Reconnect Apollo, then retry the campaign.",
  data_source_not_connected: "No Apollo account is connected, so the campaign stopped. Connect Apollo, then retry the campaign.",
  data_source_plan_blocked:
    "Your Apollo plan does not allow search through the API, so nothing more was searched. Use a key from an Apollo plan with API access, then retry the campaign.",
  data_source_credits_used_up: "Your Apollo credits are used up, so the search stopped. Add credits in Apollo, then retry the campaign.",
  data_source_rate_limited: "Apollo is limiting requests from your account right now. Retry the campaign in a few minutes.",
  data_source_request_failed: "Apollo returned an error. Retry the campaign.",
  data_source_run_cap:
    "This campaign reached its Apollo credit limit, which protects your credits. Start a new campaign from the same research to search again.",
  data_source_unavailable: DATA_SOURCE_COPY.unavailable,
}
