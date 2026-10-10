import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { db } from "@/utils/db"
import {
  gtmCompetitor,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmResearchRun,
} from "@/db/schema"
import { eq, and, ne } from "drizzle-orm"
import { resolveAuthAndOrg, verifyResearchRunAccess } from "@/lib/gtm-auth"
import { checkInngestConnectivity } from "@/lib/inngest-connectivity"
import { inngest } from "@/inngest/client"
import { runFullResearchPipeline } from "@/lib/gtm-pipeline-runner"
import { z } from "zod"

const updateResearchRunSchema = z.object({
  companyDescription: z.string().min(1),
  force: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const reqHeaders = await headers()
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders)

    if (error || !auth) {
      return NextResponse.json({ error }, { status })
    }

    // IDOR protection: Verify caller's org owns this research run
    const run = await verifyResearchRunAccess(id, auth.orgId)
    if (!run) {
      return NextResponse.json(
        { error: "Forbidden: Research run not found or unauthorized" },
        { status: 403 }
      )
    }

    // Fetch competitors, segments, and in-flight campaigns
    const [competitors, segments, campaigns] = await Promise.all([
      db
        .select()
        .from(gtmCompetitor)
        .where(eq(gtmCompetitor.researchRunId, id)),
      db
        .select()
        .from(gtmIcpSegment)
        .where(eq(gtmIcpSegment.researchRunId, id)),
      db
        .select()
        .from(gtmOutreachCampaign)
        .where(eq(gtmOutreachCampaign.researchRunId, id)),
    ])

    const inngestConnectivity = await checkInngestConnectivity()

    return NextResponse.json({
      success: true,
      researchRun: run,
      competitors,
      segments,
      campaigns,
      inngestConnectivity,
    })
  } catch (err: any) {
    console.error("[GET /api/gtm/research-runs/[id]] Error:", err)
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const reqHeaders = await headers()
  const { auth, error, status } = await resolveAuthAndOrg(reqHeaders)
  if (error || !auth) return NextResponse.json({ error }, { status })
  if (!(await verifyResearchRunAccess(id, auth.orgId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = updateResearchRunSchema.safeParse(await req.json())
  if (!parsed.success)
    return NextResponse.json(
      { error: "A company description is required" },
      { status: 400 }
    )

  const whereCondition = parsed.data.force
    ? eq(gtmResearchRun.id, id)
    : and(
        eq(gtmResearchRun.id, id),
        ne(gtmResearchRun.status, "in_progress")
      )

  // Atomic conditional check-and-set
  const [researchRun] = await db
    .update(gtmResearchRun)
    .set({
      companyDescription: parsed.data.companyDescription,
      synthesizedProfile: null,
      status: "in_progress",
      currentStage: "research_company",
      failureReason: null,
      stageStartedAt: new Date(),
      lastProgressAt: null,
    })
    .where(whereCondition)
    .returning()

  if (!researchRun) {
    const currentRun = await verifyResearchRunAccess(id, auth.orgId)
    return NextResponse.json(
      {
        error: "Research run is currently in progress",
        researchRun: currentRun,
        duplicatePrevented: true,
      },
      { status: 409 }
    )
  }

  try {
    await inngest.send({
      name: "gtm/research.requested",
      data: { researchRunId: id },
    })
  } catch (e) {
    console.warn("[PATCH /api/gtm/research-runs/[id]] inngest.send notice:", e)
  }

  setImmediate(() => {
    runFullResearchPipeline(id).catch((err) => {
      console.error("[PATCH /api/gtm/research-runs/[id]] Background pipeline error:", err)
    })
  })

  return NextResponse.json({ success: true, researchRun })
}
