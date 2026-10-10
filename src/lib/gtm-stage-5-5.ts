import { db } from "@/utils/db";
import { gtmEmailDraft, gtmContact, gtmProspectCompany, gtmOutreachCampaign } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { scoreTitleMatch, TitleMatchResult, isValidPersonName } from "./gtm-contact-matcher";

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
  titleMatch?: TitleMatchResult;
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

/**
 * Full Stage 5.5 Qualification Evaluation:
 * Evaluates the two hard gates FIRST. Only contacts passing both hard gates
 * proceed to the existing 0-100 title match qualification score.
 */
export function evaluateContactQualification(
  contact: ContactGateData,
  targetRoles?: string[]
): GateCheckResult {
  // 1. Hard Gate 1 & 2 Check
  const hardGatesResult = checkLeadQualificationGates(contact);
  if (!hardGatesResult.qualified) {
    return hardGatesResult;
  }

  // 2. Existing 0-100 title qualification scoring (if target roles provided)
  if (targetRoles && targetRoles.length > 0 && contact.title) {
    const match = scoreTitleMatch(contact.title, targetRoles);
    if (match.score < 70) {
      return {
        qualified: false,
        reason: match.reason || `Title match score (${match.score}) below qualification threshold (70)`,
        failedGate: "title_score",
        titleMatch: match,
      };
    }
    return {
      qualified: true,
      titleMatch: match,
    };
  }

  return { qualified: true };
}

/**
 * Marks a contact as disqualified in the database by creating/updating a rejected email draft.
 * Preserves existing disqualification schema and reason display.
 */
export async function disqualifyContactInDb({
  contactId,
  outreachCampaignId,
  contactName,
  reason,
  reviewedBy,
}: {
  contactId: string;
  outreachCampaignId: string;
  contactName: string;
  reason: string;
  reviewedBy?: string | null;
}) {
  const [existingDraft] = await db
    .select()
    .from(gtmEmailDraft)
    .where(eq(gtmEmailDraft.contactId, contactId))
    .orderBy(desc(gtmEmailDraft.createdAt));

  if (existingDraft) {
    // If draft already exists, update to rejected with disqualification reason
    await db
      .update(gtmEmailDraft)
      .set({
        status: "rejected",
        errorMessage: reason,
        subject: `[Disqualified] ${contactName}`,
        body: `Contact disqualified: ${reason}`,
        reviewedBy: reviewedBy || existingDraft.reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(gtmEmailDraft.id, existingDraft.id));
    return existingDraft.id;
  } else {
    // Insert new rejected draft to mark contact disqualified
    const [inserted] = await db
      .insert(gtmEmailDraft)
      .values({
        contactId,
        outreachCampaignId,
        subject: `[Disqualified] ${contactName}`,
        body: `Contact disqualified: ${reason}`,
        status: "rejected",
        errorMessage: reason,
        reviewedBy: reviewedBy || null,
        reviewedAt: new Date(),
      })
      .returning();
    return inserted.id;
  }
}

/**
 * Stage 5.5 Execution: Qualifies all contacts belonging to an outreach campaign.
 * Evaluates the two hard gates and disqualifies any failing contacts.
 */
export async function executeQualifyCampaignContacts(outreachCampaignId: string) {
  const contactsWithCompany = await db
    .select({
      contact: gtmContact,
      company: gtmProspectCompany,
    })
    .from(gtmContact)
    .innerJoin(
      gtmProspectCompany,
      eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
    )
    .where(eq(gtmProspectCompany.outreachCampaignId, outreachCampaignId));

  let qualifiedCount = 0;
  let disqualifiedCount = 0;
  const newlyDisqualified: Array<{ contactId: string; name: string; reason: string }> = [];

  for (const { contact } of contactsWithCompany) {
    // 1. Valid person name check
    if (!isValidPersonName(contact.name)) {
      disqualifiedCount++;
      await disqualifyContactInDb({
        contactId: contact.id,
        outreachCampaignId,
        contactName: contact.name,
        reason: "contact name invalid — pending re-discovery",
      });
      newlyDisqualified.push({
        contactId: contact.id,
        name: contact.name,
        reason: "contact name invalid — pending re-discovery",
      });
      continue;
    }

    // 2. Stage 5.5 Hard Gates Check
    const gateCheck = checkLeadQualificationGates(contact);
    if (!gateCheck.qualified) {
      disqualifiedCount++;
      const reason = gateCheck.reason || "Disqualified by stage 5.5 qualification gate";
      await disqualifyContactInDb({
        contactId: contact.id,
        outreachCampaignId,
        contactName: contact.name,
        reason,
      });
      newlyDisqualified.push({
        contactId: contact.id,
        name: contact.name,
        reason,
      });
      continue;
    }

    qualifiedCount++;
  }

  return {
    totalContacts: contactsWithCompany.length,
    qualifiedCount,
    disqualifiedCount,
    newlyDisqualified,
  };
}
