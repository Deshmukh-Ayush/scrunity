import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmResearchRun } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveAuthAndOrg, verifyResearchRunAccess } from "@/lib/gtm-auth";
import { inngest, isDev } from "@/inngest/client";
import { checkInngestConnectivity } from "@/lib/inngest-connectivity";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: researchRunId } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const run = await verifyResearchRunAccess(researchRunId, auth.orgId);
    if (!run) {
      return NextResponse.json(
        { error: "Forbidden: Research run not found or unauthorized" },
        { status: 403 }
      );
    }

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

    const stage = run.currentStage;
    const now = new Date();

    if (stage === "research_company") {
      await db
        .update(gtmResearchRun)
        .set({
          status: "in_progress",
          failureReason: null,
          stageStartedAt: now,
          lastProgressAt: null,
        })
        .where(eq(gtmResearchRun.id, researchRunId));

      try {
        await inngest.send({
          name: "gtm/research.requested",
          data: { researchRunId },
        });
      } catch (inngestErr) {
        console.error(
          "[POST /api/gtm/research-runs/[id]/restart-stage] inngest.send failed:",
          inngestErr
        );
        return NextResponse.json(
          { error: "Failed to dispatch stage event to Inngest runner." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restarted "Research Company" stage. Inngest event dispatched.',
        stage: "research_company",
      });
    }

    if (stage === "research_competitors") {
      await db
        .update(gtmResearchRun)
        .set({
          status: "in_progress",
          failureReason: null,
          stageStartedAt: now,
          lastProgressAt: null,
        })
        .where(eq(gtmResearchRun.id, researchRunId));

      try {
        await inngest.send({
          name: "gtm/research.explore_competitors",
          data: { researchRunId },
        });
      } catch (inngestErr) {
        console.error(
          "[POST /api/gtm/research-runs/[id]/restart-stage] inngest.send failed:",
          inngestErr
        );
        return NextResponse.json(
          { error: "Failed to dispatch stage event to Inngest runner." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restarted "Explore Competitors" stage. Inngest event dispatched.',
        stage: "research_competitors",
      });
    }

    if (stage === "define_segments") {
      await db
        .update(gtmResearchRun)
        .set({
          status: "in_progress",
          failureReason: null,
          stageStartedAt: now,
          lastProgressAt: null,
        })
        .where(eq(gtmResearchRun.id, researchRunId));

      try {
        await inngest.send({
          name: "gtm/research.define_segments",
          data: { researchRunId },
        });
      } catch (inngestErr) {
        console.error(
          "[POST /api/gtm/research-runs/[id]/restart-stage] inngest.send failed:",
          inngestErr
        );
        return NextResponse.json(
          { error: "Failed to dispatch stage event to Inngest runner." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restarted "Define Segments" stage. Inngest event dispatched.',
        stage: "define_segments",
      });
    }

    if (stage === "done") {
      return NextResponse.json({
        success: true,
        message: "Research run has already completed all stages.",
        stage: "done",
      });
    }

    return NextResponse.json(
      { error: `Cannot restart unrecognized stage "${stage}"` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/gtm/research-runs/[id]/restart-stage] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
