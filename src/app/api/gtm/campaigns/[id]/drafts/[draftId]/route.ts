import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmEmailDraft } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveAuthAndOrg, verifyDraftAccess } from "@/lib/gtm-auth";
import { z } from "zod";

const updateDraftSchema = z.object({
  action: z.enum(["approve", "reject"]),
  edits: z
    .object({
      subject: z.string().optional(),
      body: z.string().optional(),
    })
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; draftId: string }> }
) {
  try {
    const { id: campaignId, draftId } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // IDOR protection: Verify draft belongs to campaign and caller's org
    const verified = await verifyDraftAccess(draftId, campaignId, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Draft not found or unauthorized" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateDraftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { action, edits } = parsed.data;
    const newStatus = action === "approve" ? "approved" : "rejected";

    const updateFields: any = {
      status: newStatus,
      reviewedBy: auth.userId,
      reviewedAt: new Date(),
    };

    if (edits?.subject !== undefined) {
      updateFields.subject = edits.subject;
    }
    if (edits?.body !== undefined) {
      updateFields.body = edits.body;
    }

    const [updatedDraft] = await db
      .update(gtmEmailDraft)
      .set(updateFields)
      .where(eq(gtmEmailDraft.id, draftId))
      .returning();

    return NextResponse.json({ success: true, draft: updatedDraft });
  } catch (err: any) {
    console.error(
      "[POST /api/gtm/campaigns/[id]/drafts/[draftId]] Error:",
      err
    );
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}
