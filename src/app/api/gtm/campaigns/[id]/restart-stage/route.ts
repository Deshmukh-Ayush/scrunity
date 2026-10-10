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
import { inngest, isDev } from "@/inngest/client";
import { checkInngestConnectivity } from "@/lib/inngest-connectivity";

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

    const campaign = verified.campaign;

    // Check Inngest connectivity upfront in development
    const inngestStatus = await checkInngestConnectivity();
    if (isDev && !inngestStatus.connected) {
      return NextResponse.json(
        {
          error:
            "Inngest dev server is not running. Please start it using 'npm run inngest:dev' in your terminal before restarting stages.",
          inngestOffline: true,
        },
        { status: 503 }
      );
    }

    const stage = campaign.currentStage;

    if (stage === "send_emails") {
      // 1. Mailbox verification
      const [mailbox] = await db
        .select()
        .from(gtmConnectedMailbox)
        .where(
          and(
            eq(gtmConnectedMailbox.organizationId, auth.orgId),
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

      // 2. AI Credit verification
      const { hasAvailableCredits } = await import("@/lib/gtm-ai-credits");
      const hasCredits = await hasAvailableCredits(auth.orgId);
      if (!hasCredits) {
        return NextResponse.json(
          {
            error:
              "AI credits exhausted (0 remaining). Please top up credits or upgrade your plan on the Billing page to resume email dispatch.",
            creditsExhausted: true,
          },
          { status: 402 }
        );
      }

      // 3. Draft verification - check for approved or failed drafts
      let approvedDrafts = await db
        .select({ id: gtmEmailDraft.id, status: gtmEmailDraft.status })
        .from(gtmEmailDraft)
        .where(
          and(
            eq(gtmEmailDraft.outreachCampaignId, campaignId),
            eq(gtmEmailDraft.status, "approved")
          )
        );

      // If no approved drafts exist, check if there are failed drafts to retry
      if (approvedDrafts.length === 0) {
        const failedDrafts = await db
          .select({ id: gtmEmailDraft.id })
          .from(gtmEmailDraft)
          .where(
            and(
              eq(gtmEmailDraft.outreachCampaignId, campaignId),
              eq(gtmEmailDraft.status, "failed")
            )
          );

        if (failedDrafts.length > 0) {
          // Reset failed drafts back to approved for this restart
          await db
            .update(gtmEmailDraft)
            .set({ status: "approved", errorMessage: null })
            .where(
              and(
                eq(gtmEmailDraft.outreachCampaignId, campaignId),
                eq(gtmEmailDraft.status, "failed")
              )
            );
          approvedDrafts = failedDrafts.map((d) => ({ ...d, status: "approved" }));
        } else {
          // Check if all drafts are already sent
          const allDrafts = await db
            .select({ id: gtmEmailDraft.id, status: gtmEmailDraft.status })
            .from(gtmEmailDraft)
            .where(eq(gtmEmailDraft.outreachCampaignId, campaignId));

          const sentCount = allDrafts.filter((d) => d.status === "sent").length;
          if (allDrafts.length > 0 && sentCount === allDrafts.length) {
            await db
              .update(gtmOutreachCampaign)
              .set({
                currentStage: "done",
                status: "done",
                failureReason: null,
              })
              .where(eq(gtmOutreachCampaign.id, campaignId));

            return NextResponse.json({
              success: true,
              message: "All drafts for this campaign have already been sent.",
              allSent: true,
            });
          }

          return NextResponse.json(
            {
              error:
                "No approved or retryable drafts found for this campaign. Approve drafts before sending.",
            },
            { status: 400 }
          );
        }
      }

      // Update campaign state for fresh stage execution
      const now = new Date();
      await db
        .update(gtmOutreachCampaign)
        .set({
          currentStage: "send_emails",
          status: "in_progress",
          failureReason: null,
          stageStartedAt: now,
          lastProgressAt: null, // Null indicates dispatched; Inngest function will update upon pickup
        })
        .where(eq(gtmOutreachCampaign.id, campaignId));

      // Dispatch fresh Inngest event
      try {
        await inngest.send({
          name: "gtm/campaign.send_emails",
          data: { outreachCampaignId: campaignId },
        });
      } catch (inngestErr) {
        console.error(
          "[POST /api/gtm/campaigns/[id]/restart-stage] inngest.send failed:",
          inngestErr
        );
        return NextResponse.json(
          {
            error:
              "Failed to dispatch stage event to Inngest runner. Please verify Inngest is running.",
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Restarted "Send Emails" stage for ${approvedDrafts.length} draft(s). Inngest event dispatched.`,
        stage: "send_emails",
        pendingCount: approvedDrafts.length,
      });
    }

    if (stage === "find_companies") {
      const now = new Date();
      await db
        .update(gtmOutreachCampaign)
        .set({
          currentStage: "find_companies",
          status: "in_progress",
          failureReason: null,
          stageStartedAt: now,
          lastProgressAt: null,
        })
        .where(eq(gtmOutreachCampaign.id, campaignId));

      try {
        await inngest.send({
          name: "gtm/campaign.find_companies",
          data: { outreachCampaignId: campaignId },
        });
      } catch (inngestErr) {
        console.error(
          "[POST /api/gtm/campaigns/[id]/restart-stage] inngest.send failed:",
          inngestErr
        );
        return NextResponse.json(
          { error: "Failed to dispatch stage event to Inngest runner." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restarted "Find Companies" stage. Inngest event dispatched.',
        stage: "find_companies",
      });
    }

    if (stage === "find_contacts") {
      const now = new Date();
      await db
        .update(gtmOutreachCampaign)
        .set({
          currentStage: "find_contacts",
          status: "in_progress",
          failureReason: null,
          stageStartedAt: now,
          lastProgressAt: null,
        })
        .where(eq(gtmOutreachCampaign.id, campaignId));

      try {
        await inngest.send({
          name: "gtm/campaign.find_contacts",
          data: { outreachCampaignId: campaignId },
        });
      } catch (inngestErr) {
        console.error(
          "[POST /api/gtm/campaigns/[id]/restart-stage] inngest.send failed:",
          inngestErr
        );
        return NextResponse.json(
          { error: "Failed to dispatch stage event to Inngest runner." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restarted "Find Decision-Makers" stage. Inngest event dispatched.',
        stage: "find_contacts",
      });
    }

    if (stage === "write_emails") {
      const now = new Date();
      await db
        .update(gtmOutreachCampaign)
        .set({
          currentStage: "write_emails",
          status: "in_progress",
          failureReason: null,
          stageStartedAt: now,
          lastProgressAt: null,
        })
        .where(eq(gtmOutreachCampaign.id, campaignId));

      try {
        await inngest.send({
          name: "gtm/campaign.write_emails",
          data: { outreachCampaignId: campaignId },
        });
      } catch (inngestErr) {
        console.error(
          "[POST /api/gtm/campaigns/[id]/restart-stage] inngest.send failed:",
          inngestErr
        );
        return NextResponse.json(
          { error: "Failed to dispatch stage event to Inngest runner." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restarted "Write Emails" stage. Inngest event dispatched.',
        stage: "write_emails",
      });
    }

    if (stage === "awaiting_approval") {
      return NextResponse.json({
        success: true,
        message: "Campaign is currently awaiting human review. Please review and approve drafts to start sending.",
        stage: "awaiting_approval",
      });
    }

    if (stage === "done" || stage === "done_for_now") {
      return NextResponse.json({
        success: true,
        message: "Campaign has already completed.",
        stage,
      });
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
