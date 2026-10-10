import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmProspectCompany,
  gtmCompanyMetricSnapshot,
  gtmContact,
  gtmEmailDraft,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";
import { checkInngestConnectivity } from "@/lib/inngest-connectivity";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // IDOR check: Verify campaign belongs to caller's org
    const verified = await verifyCampaignAccess(id, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    // Fetch prospect companies
    const companies = await db
      .select()
      .from(gtmProspectCompany)
      .where(eq(gtmProspectCompany.outreachCampaignId, id));

    const companyIds = companies.map((c) => c.id);

    let snapshots: any[] = [];
    let contacts: any[] = [];
    let drafts: any[] = [];

    if (companyIds.length > 0) {
      const [allSnapshots, allContacts, allDrafts] = await Promise.all([
        db.select().from(gtmCompanyMetricSnapshot),
        db.select().from(gtmContact),
        db
          .select()
          .from(gtmEmailDraft)
          .where(eq(gtmEmailDraft.outreachCampaignId, id)),
      ]);

      const companyIdSet = new Set(companyIds);
      snapshots = allSnapshots.filter((s) => companyIdSet.has(s.prospectCompanyId));
      contacts = allContacts.filter((c) => companyIdSet.has(c.prospectCompanyId));
      drafts = allDrafts;
    }

    const inngestConnectivity = await checkInngestConnectivity();

    return NextResponse.json({
      success: true,
      campaign: verified.campaign,
      segment: verified.segment,
      researchRun: verified.researchRun,
      companies,
      snapshots,
      contacts,
      drafts,
      inngestConnectivity,
    });
  } catch (err: any) {
    console.error("[GET /api/gtm/campaigns/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}
