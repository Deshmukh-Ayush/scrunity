export interface ContactGateData {
  id?: string;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  verificationStatus?: string | null;
  emailSource?: string | null;
  linkedinUrl?: string | null;
}

export interface GateCheckResult {
  qualified: boolean;
  reason?: string;
  failedGate?: "email_confidence" | "linkedin" | "title_score";
  titleMatch?: {
    score: number;
    matchedRole: string;
    reason: string;
  };
}

/**
 * Permitted verification statuses that pass the email confidence floor.
 * Must be at least MX-validated or provider/enrich verified.
 */
export const ALLOWED_EMAIL_VERIFICATION_STATUSES = new Set([
  "pattern_guessed_mx_valid",
  "enrich_verified",
  "verified",
  "provider_verified",
]);

/**
 * Gate 1: Email Confidence Floor
 * Rejects unverified, plain pattern_guessed (without MX check), company fallback, or missing email.
 */
export function checkEmailConfidenceFloor(contact: ContactGateData): {
  passed: boolean;
  reason?: string;
} {
  const email = contact.email?.trim();
  if (!email) {
    return {
      passed: false,
      reason: "Email confidence too low — unverified",
    };
  }

  const vStatus = (contact.verificationStatus || contact.emailSource || "unverified").trim();

  if (!ALLOWED_EMAIL_VERIFICATION_STATUSES.has(vStatus)) {
    if (
      vStatus === "pattern_guessed_unverified" ||
      vStatus === "pattern_guessed" ||
      vStatus === "company_fallback"
    ) {
      return {
        passed: false,
        reason: "Email confidence too low — pattern-guessed with no MX validation",
      };
    }

    return {
      passed: false,
      reason: "Email confidence too low — unverified",
    };
  }

  return { passed: true };
}

/**
 * Gate 2: LinkedIn Profile Required
 * Requires a real LinkedIn profile URL captured during Stage 5 discovery.
 */
export function checkLinkedInProfileGate(contact: ContactGateData): {
  passed: boolean;
  reason?: string;
} {
  const li = contact.linkedinUrl?.trim();
  if (!li || !li.toLowerCase().includes("linkedin.com")) {
    return {
      passed: false,
      reason: "No LinkedIn profile found",
    };
  }

  return { passed: true };
}

/**
 * Evaluates the two hard gates ahead of stage 5.5 qualification scoring.
 * Pure validation function with zero database or server dependencies.
 */
export function checkLeadQualificationGates(contact: ContactGateData): GateCheckResult {
  // Gate 1: Email Confidence Floor
  const emailCheck = checkEmailConfidenceFloor(contact);
  if (!emailCheck.passed) {
    return {
      qualified: false,
      reason: emailCheck.reason,
      failedGate: "email_confidence",
    };
  }

  // Gate 2: LinkedIn Required
  const liCheck = checkLinkedInProfileGate(contact);
  if (!liCheck.passed) {
    return {
      qualified: false,
      reason: liCheck.reason,
      failedGate: "linkedin",
    };
  }

  return { qualified: true };
}
