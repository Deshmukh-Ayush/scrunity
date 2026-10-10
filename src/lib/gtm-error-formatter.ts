export interface FormattedError {
  headline: string;
  actionableStep?: string;
  formattedMessage: string;
  rawError?: string | null;
  category:
    | "invalid_contact"
    | "qualification_gate"
    | "bounce"
    | "credits_exhausted"
    | "auth_required"
    | "unapproved_draft"
    | "generic";
}

/**
 * Translates raw internal errors (exceptions, abort strings, SMTP status codes)
 * into clean, user-facing copy adhering to the Scrunity Design System standards:
 * (a) what failed, (b) the root cause, and (c) the actionable remedy.
 *
 * Keeps the raw internal error available for technical / developer inspection.
 */
export function formatErrorMessage(rawError?: string | null): FormattedError {
  if (!rawError || !rawError.trim()) {
    return {
      headline: "Unknown issue",
      actionableStep: "Check campaign settings and retry.",
      formattedMessage: "Unknown issue encountered — check campaign settings and retry.",
      rawError: rawError ?? null,
      category: "generic",
    };
  }

  const errStr = rawError.trim();
  const lower = errStr.toLowerCase();

  // 1. Invalid contact name guardrail (job title, non-person, etc.)
  if (
    lower.includes("invalid contact name") ||
    lower.includes("job title or invalid entity") ||
    lower.includes("contact name invalid") ||
    (lower.includes("hard safety abort") && lower.includes("name"))
  ) {
    return {
      headline: "Contact name could not be verified as a real person",
      actionableStep: "Needs re-discovery before this can be sent.",
      formattedMessage:
        "Contact name couldn't be verified as a real person — needs re-discovery before this can be sent.",
      rawError: errStr,
      category: "invalid_contact",
    };
  }

  // 2. Email bounce / delivery failure
  if (
    lower.includes("bounce") ||
    lower.includes("550") ||
    lower.includes("554") ||
    lower.includes("address not found") ||
    lower.includes("recipient address rejected") ||
    lower.includes("user unknown") ||
    lower.includes("mailbox unavailable")
  ) {
    return {
      headline: "Email bounced (recipient address not found)",
      actionableStep: "Needs re-discovery with a verified email.",
      formattedMessage:
        "Email bounced (recipient address not found) — needs re-discovery with a verified email.",
      rawError: errStr,
      category: "bounce",
    };
  }

  // 3. Qualification gate (MX confidence floor / LinkedIn required)
  if (
    lower.includes("email confidence too low") ||
    lower.includes("linkedin") ||
    lower.includes("disqualified contact") ||
    (lower.includes("hard safety abort") && lower.includes("disqualified"))
  ) {
    return {
      headline: "Contact disqualified by qualification gates",
      actionableStep: "Requires MX validation and a verified LinkedIn profile.",
      formattedMessage:
        "Contact disqualified by qualification gates — needs MX validation and verified LinkedIn profile.",
      rawError: errStr,
      category: "qualification_gate",
    };
  }

  // 4. Credits exhausted
  if (lower.includes("credit") || lower.includes("paused_credits_exhausted")) {
    return {
      headline: "Outreach paused: 0 AI credits remaining",
      actionableStep: "Purchase a top-up pack to resume sending.",
      formattedMessage:
        "Outreach paused: 0 AI credits remaining. Purchase a top-up pack to resume sending.",
      rawError: errStr,
      category: "credits_exhausted",
    };
  }

  // 5. Mailbox OAuth / Permissions
  if (
    lower.includes("access_token_scope_insufficient") ||
    lower.includes("invalid_grant") ||
    lower.includes("unauthorized") ||
    lower.includes("reconnect mailbox")
  ) {
    return {
      headline: "Mailbox connection requires re-authorization",
      actionableStep: "Reconnect your mailbox in Settings to grant required permissions.",
      formattedMessage:
        "Mailbox connection requires re-authorization — reconnect your mailbox to resume.",
      rawError: errStr,
      category: "auth_required",
    };
  }

  // 6. Draft status not approved
  if (
    lower.includes("hard safety abort") &&
    lower.includes("only 'approved' drafts may be sent")
  ) {
    return {
      headline: "Draft has not been approved for outreach",
      actionableStep: "Review and approve the draft before sending.",
      formattedMessage:
        "Draft has not been approved for outreach — review and approve before sending.",
      rawError: errStr,
      category: "unapproved_draft",
    };
  }

  // 7. Generic / Fallback
  return {
    headline: "Email delivery could not be completed",
    actionableStep: "Check campaign settings and retry dispatch.",
    formattedMessage:
      "Email delivery could not be completed — check campaign settings and retry dispatch.",
    rawError: errStr,
    category: "generic",
  };
}
