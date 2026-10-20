/**
 * Internal data-source failure codes (stored on rows) -> the neutral codes the
 * browser receives (lib/data/public-fields.ts) and maps to copy. Pure.
 */

export const DATA_SOURCE_PUBLIC_CODES: Record<string, string> = {
  apollo_key_invalid: "data_source_key_invalid",
  apollo_plan_blocked: "data_source_plan_blocked",
  apollo_credits_exhausted: "data_source_credits_used_up",
  apollo_rate_limited: "data_source_rate_limited",
  apollo_request_failed: "data_source_request_failed",
  data_source_not_connected: "data_source_not_connected",
  data_source_run_cap: "data_source_run_cap",
  data_source_encryption_unavailable: "data_source_unavailable",
  data_source_secret_unreadable: "data_source_key_invalid",
}

export function publicDataSourceCode(internal: string): string {
  return DATA_SOURCE_PUBLIC_CODES[internal] ?? "data_source_request_failed"
}

/** Public codes after which the customer must reconnect before a retry can work. */
export const RECONNECT_CODES = new Set(["data_source_key_invalid", "data_source_not_connected"])
