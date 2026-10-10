import { db } from "@/utils/db";
import {
  member,
  gtmResearchRun,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmEmailDraft,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export type AuthContext = {
  userId: string;
  orgId: string;
  role: string;
};

/**
 * Resolves the authenticated user and their active organization membership.
 * Rejects requests without a valid session or active organization.
 */
export async function resolveAuthAndOrg(
  headers: Headers
): Promise<{ auth?: AuthContext; error?: string; status: number }> {
  // Fast path: proxy already resolved and validated identity in request headers
  const proxyUserId = headers.get("x-user-id");
  const proxyOrgId = headers.get("x-org-id");
  const proxyOrgRole = headers.get("x-org-role");

  if (proxyUserId && proxyOrgId) {
    return {
      auth: {
        userId: proxyUserId,
        orgId: proxyOrgId,
        role: proxyOrgRole || "owner",
      },
      status: 200,
    };
  }

  const session = await auth.api.getSession({ headers });

  if (!session || !session.user) {
    return { error: "Unauthorized: Invalid or missing session", status: 401 };
  }

  const userId = session.user.id;
  const activeOrgId =
    session.session?.activeOrganizationId || headers.get("x-org-id");

  // Query user's memberships
  const memberships = await db
    .select({
      organizationId: member.organizationId,
      role: member.role,
    })
    .from(member)
    .where(eq(member.userId, userId));

  if (memberships.length === 0) {
    return {
      error: "Forbidden: User does not belong to any organization",
      status: 403,
    };
  }

  const matched = activeOrgId
    ? memberships.find((m) => m.organizationId === activeOrgId)
    : memberships[0];

  if (!matched) {
    return {
      error: "Forbidden: Not a member of the requested organization",
      status: 403,
    };
  }

  return {
    auth: {
      userId,
      orgId: matched.organizationId,
      role: matched.role,
    },
    status: 200,
  };
}

/**
 * Verifies that a research run belongs to the specified organization.
 * Prevents IDOR vulnerabilities.
 */
export async function verifyResearchRunAccess(
  researchRunId: string,
  organizationId: string
) {
  const [run] = await db
    .select()
    .from(gtmResearchRun)
    .where(
      and(
        eq(gtmResearchRun.id, researchRunId),
        eq(gtmResearchRun.organizationId, organizationId)
      )
    );

  return run || null;
}

/**
 * Verifies that an ICP segment belongs to the specified organization via research run.
 */
export async function verifyIcpSegmentAccess(
  icpSegmentId: string,
  organizationId: string
) {
  const [result] = await db
    .select({
      segment: gtmIcpSegment,
      researchRun: gtmResearchRun,
    })
    .from(gtmIcpSegment)
    .innerJoin(
      gtmResearchRun,
      eq(gtmIcpSegment.researchRunId, gtmResearchRun.id)
    )
    .where(
      and(
        eq(gtmIcpSegment.id, icpSegmentId),
        eq(gtmResearchRun.organizationId, organizationId)
      )
    );

  return result || null;
}

/**
 * Verifies that an outreach campaign belongs to the specified organization via research run.
 */
export async function verifyCampaignAccess(
  campaignId: string,
  organizationId: string
) {
  const [result] = await db
    .select({
      campaign: gtmOutreachCampaign,
      researchRun: gtmResearchRun,
      segment: gtmIcpSegment,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .innerJoin(
      gtmIcpSegment,
      eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
    )
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        eq(gtmResearchRun.organizationId, organizationId)
      )
    );

  return result || null;
}

/**
 * Verifies that an email draft belongs to the specified organization via campaign -> research run.
 */
export async function verifyDraftAccess(
  draftId: string,
  campaignId: string,
  organizationId: string
) {
  const [result] = await db
    .select({
      draft: gtmEmailDraft,
      campaign: gtmOutreachCampaign,
      researchRun: gtmResearchRun,
    })
    .from(gtmEmailDraft)
    .innerJoin(
      gtmOutreachCampaign,
      eq(gtmEmailDraft.outreachCampaignId, gtmOutreachCampaign.id)
    )
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(
      and(
        eq(gtmEmailDraft.id, draftId),
        eq(gtmOutreachCampaign.id, campaignId),
        eq(gtmResearchRun.organizationId, organizationId)
      )
    );

  return result || null;
}
