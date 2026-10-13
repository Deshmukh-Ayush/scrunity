import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { db } from "@/utils/db"
import { gtmResearchRun } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { resolveAuthAndOrg, verifyResearchRunAccess } from "@/lib/gtm-auth"
import { getCachedInngestConnectivity } from "@/lib/inngest-connectivity"
import { getResearchRunDetail } from "@/lib/data/research-runs"
import { dispatchResearchRun } from "@/lib/pipeline/dispatch"
import { researchRunIsIdle } from "@/lib/pipeline/stage-state"
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

    // The connectivity check is independent of the DB work, so run both at once.
    const [detail, inngestConnectivity] = await Promise.all([
      getResearchRunDetail(id, auth.orgId),
      getCachedInngestConnectivity(),
    ])

    if (!detail) {
      return NextResponse.json(
        { error: "Forbidden: Research run not found or unauthorized" },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      ...detail,
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

  // Allowed unless a live executor is still working on the run (in_progress
  // with a fresh heartbeat), so a stalled run can be retried but never doubled.
  const whereCondition = and(eq(gtmResearchRun.id, id), researchRunIsIdle())

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
        error: "Research run is still actively running. Try again once it finishes or stalls.",
        researchRun: currentRun,
        duplicatePrevented: true,
      },
      { status: 409 }
    )
  }

  await dispatchResearchRun(id)

  return NextResponse.json({ success: true, researchRun })
}
