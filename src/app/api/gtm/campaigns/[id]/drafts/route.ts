import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmEmailDraft } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";
import { listCampaignDrafts } from "@/lib/data/campaigns";
import { getApprovalBlock } from "@/lib/send-eligibility";

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

    // IDOR protection: Verify caller's org owns this campaign
    const verified = await verifyCampaignAccess(id, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    const drafts = await listCampaignDrafts(id);

    return NextResponse.json({ success: true, drafts });
  } catch (err: any) {
    console.error("[GET /api/gtm/campaigns/[id]/drafts] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const verified = await verifyCampaignAccess(id, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    if (body.action === "approve_all") {
      // Only pending drafts whose contact may still be emailed are approved;
      // opted-out, bounced, suppressed or unqualified contacts are skipped.
      const pending = await db
        .select({ id: gtmEmailDraft.id })
        .from(gtmEmailDraft)
        .where(and(eq(gtmEmailDraft.outreachCampaignId, id), eq(gtmEmailDraft.status, "draft")));
      const approvable: string[] = [];
      for (const draft of pending) {
        if (!(await getApprovalBlock(auth.orgId, draft.id))) approvable.push(draft.id);
      }
      if (approvable.length > 0) {
        await db
          .update(gtmEmailDraft)
          .set({ status: "approved", reviewedBy: auth.userId, reviewedAt: new Date() })
          .where(and(inArray(gtmEmailDraft.id, approvable), eq(gtmEmailDraft.status, "draft")));
      }
      const skipped = pending.length - approvable.length;

      return NextResponse.json({
        success: true,
        approvedCount: approvable.length,
        skippedCount: skipped,
        message:
          skipped > 0
            ? `Approved ${approvable.length} draft(s); ${skipped} skipped because those contacts can't be emailed.`
            : "All drafts approved",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/gtm/campaigns/[id]/drafts] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}
