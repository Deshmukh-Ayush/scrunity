import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/utils/db";
import { gtmResearchRun } from "@/db/schema";
import { resolveAuthAndOrg, verifyResearchRunAccess } from "@/lib/gtm-auth";
import { dispatchResearchRun } from "@/lib/pipeline/dispatch";
import { researchRunIsIdle } from "@/lib/pipeline/stage-state";

const STAGE_LABELS: Record<string, string> = {
  research_company: "Research Company",
  research_competitors: "Explore Competitors",
  define_segments: "Define Segments",
};

/**
 * Re-runs the research run's current stage. Works whichever executor is in use
 * (Inngest or in-process); refused only while a live executor is still
 * heartbeating, so a restart can never run a stage twice.
 */
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

    const stage = run.currentStage;

    if (stage === "done") {
      return NextResponse.json({
        success: true,
        message: "Research run has already completed all stages.",
        stage,
      });
    }

    const label = STAGE_LABELS[stage];
    if (!label) {
      return NextResponse.json(
        { error: `Cannot restart unrecognized stage "${stage}"` },
        { status: 400 }
      );
    }

    const [reset] = await db
      .update(gtmResearchRun)
      .set({
        status: "in_progress",
        failureReason: null,
        stageStartedAt: new Date(),
        lastProgressAt: null,
      })
      .where(
        and(
          eq(gtmResearchRun.id, researchRunId),
          eq(gtmResearchRun.currentStage, stage),
          researchRunIsIdle()
        )
      )
      .returning({ id: gtmResearchRun.id });

    if (!reset) {
      return NextResponse.json(
        {
          error: `The "${label}" stage is still actively running (recent progress recorded). Restart is available once it stalls or fails.`,
          stillRunning: true,
        },
        { status: 409 }
      );
    }

    const executor = await dispatchResearchRun(researchRunId);

    return NextResponse.json({
      success: true,
      message: `Restarted "${label}" stage.`,
      stage,
      executor,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/gtm/research-runs/[id]/restart-stage] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
