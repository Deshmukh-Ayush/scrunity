import { db } from "@/utils/db";
import {
  gtmEmailDraft,
  gtmContact,
  gtmProspectCompany,
  gtmOutreachCampaign,
  gtmResearchRun,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { isValidPersonName } from "./gtm-contact-matcher";
import { isAggregatorOrReviewDomain } from "./firecrawl";
import { touchCampaignProgress } from "./pipeline/stage-state";
import {
  checkSuppression,
  recordSuppressionEntry,
  getSuppressionDisqualificationMessage,
  type SuppressionReason,
} from "./gtm-suppression";

import {
  type ContactGateData,
  type GateCheckResult,
  ALLOWED_EMAIL_VERIFICATION_STATUSES,
  checkEmailConfidenceFloor,
  checkLinkedInProfileGate,
  checkLeadQualificationGates,
} from "./gtm-qualification-gates";

export {
  type ContactGateData,
  type GateCheckResult,
  ALLOWED_EMAIL_VERIFICATION_STATUSES,
  checkEmailConfidenceFloor,
  checkLinkedInProfileGate,
  checkLeadQualificationGates,
};

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
 * Contacts with lookupStatus "lookup_incomplete" are skipped (left pending).
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
  let pendingLookupCount = 0;
  const newlyDisqualified: Array<{ contactId: string; name: string; reason: string }> = [];

  const [campaignRun] = await db
    .select({
      organizationId: gtmResearchRun.organizationId,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId));
  const sourceOrgId = campaignRun?.organizationId || null;

  for (const { contact, company } of contactsWithCompany) {
    await touchCampaignProgress(outreachCampaignId);
    // A Firecrawl lookup for this contact was rate-limited, so "nothing found"
    // is unknown: neither qualify nor disqualify (and never suppress) it.
    if (contact.lookupStatus === "lookup_incomplete") {
      pendingLookupCount++;
      continue;
    }
    // 0. Platform-Wide Suppression Check (negative cache)
    const suppression = await checkSuppression({
      email: contact.email,
      domain: company.domain,
    });
    if (suppression) {
      disqualifiedCount++;
      const reason = getSuppressionDisqualificationMessage(suppression);
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

    // 1. Aggregator or directory domain check
    if (isAggregatorOrReviewDomain(company.domain)) {
      disqualifiedCount++;
      const reason = "Domain is an aggregator or review directory";
      await disqualifyContactInDb({
        contactId: contact.id,
        outreachCampaignId,
        contactName: contact.name,
        reason,
      });
      await recordSuppressionEntry({
        email: null,
        domain: company.domain,
        reason: "aggregator_domain",
        sourceOrgId,
        sourceContactId: contact.id,
        rawSnippet: `Aggregator domain ${company.domain}`,
      });
      newlyDisqualified.push({
        contactId: contact.id,
        name: contact.name,
        reason,
      });
      continue;
    }

    // 2. Valid person name check
    if (!isValidPersonName(contact.name)) {
      disqualifiedCount++;
      const reason = "contact name invalid — pending re-discovery";
      await disqualifyContactInDb({
        contactId: contact.id,
        outreachCampaignId,
        contactName: contact.name,
        reason,
      });
      await recordSuppressionEntry({
        email: contact.email,
        domain: company.domain,
        reason: "invalid_contact_name",
        sourceOrgId,
        sourceContactId: contact.id,
        rawSnippet: contact.name,
      });
      newlyDisqualified.push({
        contactId: contact.id,
        name: contact.name,
        reason,
      });
      continue;
    }

    // 3. Stage 5.5 Hard Gates Check
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

      // Record hard disqualification negative findings to platform-wide suppression
      let suppressionReason: SuppressionReason = "mx_invalid";
      if (gateCheck.failedGate === "linkedin") {
        suppressionReason = "no_linkedin_found";
      } else if (gateCheck.failedGate === "email_confidence") {
        suppressionReason = "mx_invalid";
      }

      await recordSuppressionEntry({
        email: contact.email,
        domain: company.domain,
        reason: suppressionReason,
        sourceOrgId,
        sourceContactId: contact.id,
        rawSnippet: reason,
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
    pendingLookupCount,
    newlyDisqualified,
  };
}
