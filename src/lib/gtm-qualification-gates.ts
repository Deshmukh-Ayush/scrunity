import { isVerifiedEmail } from "./email-verification";

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
 * Gate 1: Verified email only
 * Passes only an address an email vendor verified at mailbox level (see
 * lib/email-verification.ts). Pattern guesses, MX-only, catch-all, scraped and
 * company fallback addresses are all refused.
 */
export function checkEmailConfidenceFloor(contact: ContactGateData): {
  passed: boolean;
  reason?: string;
} {
  if (!contact.email?.trim()) {
    return { passed: false, reason: "No verified email address" };
  }
  if (!isVerifiedEmail(contact)) {
    return { passed: false, reason: "Email address is not verified" };
  }
  return { passed: true };
}

/** linkedin.example is the reserved host of the synthetic fixture people (fixture mode only). */
function isLinkedInProfileUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes("linkedin.com")) return true;
  return process.env.GTM_PROVIDER_MODE === "fixture" && lower.includes("linkedin.example/in/");
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
  if (!li || !isLinkedInProfileUrl(li)) {
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
  // Gate 1: Verified email
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
