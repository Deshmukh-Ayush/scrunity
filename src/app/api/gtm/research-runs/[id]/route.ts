import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { db } from "@/utils/db"
import {
  gtmCompetitor,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmResearchRun,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { resolveAuthAndOrg, verifyResearchRunAccess } from "@/lib/gtm-auth"
import { inngest } from "@/inngest/client"
import { z } from "zod"

const updateResearchRunSchema = z.object({
  companyDescription: z.string().min(1),
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

    return NextResponse.json({
      success: true,
      researchRun: run,
      competitors,
      segments,
      campaigns,
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
  const [researchRun] = await db
    .update(gtmResearchRun)
    .set({
      companyDescription: parsed.data.companyDescription,
      synthesizedProfile: null,
      status: "in_progress",
      currentStage: "research_company",
    })
    .where(eq(gtmResearchRun.id, id))
    .returning()
  await inngest.send({
    name: "gtm/research.requested",
    data: { researchRunId: id },
  })
  return NextResponse.json({ success: true, researchRun })
}
