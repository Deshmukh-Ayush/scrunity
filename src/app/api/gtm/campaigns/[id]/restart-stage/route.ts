import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmConnectedMailbox,
  gtmEmailDraft,
  gtmOutreachCampaign,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";
import { dispatchCampaign, dispatchCampaignSend } from "@/lib/pipeline/dispatch";
import { campaignIsIdle, type CampaignStageValue } from "@/lib/pipeline/stage-state";

const STAGE_LABELS: Record<string, string> = {
  find_companies: "Find Companies",
  find_contacts: "Find Contacts",
  write_emails: "Write Emails",
  send_emails: "Send Emails",
};

/**
 * Resets the campaign's current stage for a fresh attempt. Refused while a live
 * executor is still heartbeating, so a restart can never run a stage twice.
 */
async function resetStage(campaignId: string, stage: CampaignStageValue) {
  const [reset] = await db
    .update(gtmOutreachCampaign)
    .set({
      currentStage: stage,
      status: "in_progress",
      failureReason: null,
      stageStartedAt: new Date(),
      lastProgressAt: null,
    })
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        eq(gtmOutreachCampaign.currentStage, stage),
        campaignIsIdle()
      )
    )
    .returning({ id: gtmOutreachCampaign.id });
  return Boolean(reset);
}

const stillRunning = (stage: string) =>
  NextResponse.json(
    {
      error: `The "${STAGE_LABELS[stage] ?? stage}" stage is still actively running (recent progress recorded). Restart is available once it stalls or fails.`,
      stillRunning: true,
    },
    { status: 409 }
  );

/**
 * Prepares Stage 7 for a restart: needs a connected mailbox, AI credits and
 * at least one approved (or retryable failed) draft. Returns a response when
 * the restart can't proceed, otherwise the number of drafts queued.
 */
async function prepareSendRestart(campaignId: string, organizationId: string) {
  const [mailbox] = await db
    .select()
    .from(gtmConnectedMailbox)
    .where(
      and(
        eq(gtmConnectedMailbox.organizationId, organizationId),
        eq(gtmConnectedMailbox.status, "connected")
      )
    );
  if (!mailbox) {
    return NextResponse.json(
      {
        error:
          "No connected Gmail mailbox found. Please connect your Gmail mailbox before sending outreach emails.",
      },
      { status: 400 }
    );
  }

  const { hasAvailableCredits } = await import("@/lib/gtm-ai-credits");
  if (!(await hasAvailableCredits(organizationId))) {
    return NextResponse.json(
      {
        error:
          "AI credits exhausted (0 remaining). Please top up credits or upgrade your plan on the Billing page to resume email dispatch.",
        creditsExhausted: true,
      },
      { status: 402 }
    );
  }

  const approvedDrafts = await db
    .select({ id: gtmEmailDraft.id })
    .from(gtmEmailDraft)
    .where(and(eq(gtmEmailDraft.outreachCampaignId, campaignId), eq(gtmEmailDraft.status, "approved")));
  if (approvedDrafts.length > 0) return approvedDrafts.length;

  // No approved drafts: retry failed ones, or finish if everything was sent.
  const failedDrafts = await db
    .select({ id: gtmEmailDraft.id })
    .from(gtmEmailDraft)
    .where(and(eq(gtmEmailDraft.outreachCampaignId, campaignId), eq(gtmEmailDraft.status, "failed")));
  if (failedDrafts.length > 0) {
    await db
      .update(gtmEmailDraft)
      .set({ status: "approved", errorMessage: null })
      .where(and(eq(gtmEmailDraft.outreachCampaignId, campaignId), eq(gtmEmailDraft.status, "failed")));
    return failedDrafts.length;
  }

  const allDrafts = await db
    .select({ status: gtmEmailDraft.status })
    .from(gtmEmailDraft)
    .where(eq(gtmEmailDraft.outreachCampaignId, campaignId));
  if (allDrafts.length > 0 && allDrafts.every((d) => d.status === "sent")) {
    await db
      .update(gtmOutreachCampaign)
      .set({ currentStage: "done", status: "done", failureReason: null })
      .where(eq(gtmOutreachCampaign.id, campaignId));
    return NextResponse.json({
      success: true,
      message: "All drafts for this campaign have already been sent.",
      allSent: true,
    });
  }

  return NextResponse.json(
    { error: "No approved or retryable drafts found for this campaign. Approve drafts before sending." },
    { status: 400 }
  );
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // Verify campaign belongs to caller's org (IDOR protection)
    const verified = await verifyCampaignAccess(campaignId, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    const stage = verified.campaign.currentStage;

    if (stage === "send_emails") {
      const prepared = await prepareSendRestart(campaignId, auth.orgId);
      if (prepared instanceof NextResponse) return prepared;
      if (!(await resetStage(campaignId, stage))) return stillRunning(stage);

      const executor = await dispatchCampaignSend(campaignId);
      return NextResponse.json({
        success: true,
        message: `Restarted "Send Emails" stage for ${prepared} draft(s).`,
        stage,
        executor,
        pendingCount: prepared,
      });
    }

    if (stage === "find_companies" || stage === "find_contacts" || stage === "write_emails") {
      if (!(await resetStage(campaignId, stage))) return stillRunning(stage);

      const executor = await dispatchCampaign(campaignId);
      return NextResponse.json({
        success: true,
        message: `Restarted "${STAGE_LABELS[stage]}" stage.`,
        stage,
        executor,
      });
    }

    if (stage === "awaiting_approval") {
      return NextResponse.json({
        success: true,
        message: "Campaign is currently awaiting human review. Please review and approve drafts to start sending.",
        stage,
      });
    }

    if (stage === "done" || stage === "done_for_now") {
      return NextResponse.json({ success: true, message: "Campaign has already completed.", stage });
    }

    return NextResponse.json(
      { error: `Cannot restart unrecognized stage "${stage}"` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/gtm/campaigns/[id]/restart-stage] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
