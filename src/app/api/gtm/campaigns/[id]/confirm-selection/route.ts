import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmProspectCompany } from "@/db/schema"
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth"
import { confirmCompanySelection } from "@/lib/pipeline/company-selection"
import { dispatchCampaign } from "@/lib/pipeline/dispatch"

const bodySchema = z.object({
  companyIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one company")
    .max(100),
})

/**
 * Passes the company-selection gate: the listed companies continue to
 * decision-maker discovery, the rest are excluded. Idempotent: a repeat after
 * the gate is passed returns 200 with `alreadyConfirmed` and changes nothing.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const reqHeaders = await headers()
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders)
    if (error || !auth) {
      return NextResponse.json({ error }, { status })
    }

    // Verify campaign belongs to caller's org (IDOR protection)
    const verified = await verifyCampaignAccess(campaignId, auth.orgId)
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      )
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      )
    }
    const selectedIds = [...new Set(parsed.data.companyIds)]

    // Every id must be a company of this campaign; anything else (another
    // campaign's or another org's company) rejects the whole request.
    const campaignCompanyIds = new Set(
      (
        await db
          .select({ id: gtmProspectCompany.id })
          .from(gtmProspectCompany)
          .where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
      ).map((c) => c.id)
    )
    if (selectedIds.some((id) => !campaignCompanyIds.has(id))) {
      return NextResponse.json(
        { error: "One or more companies do not belong to this campaign" },
        { status: 400 }
      )
    }

    const outcome = await confirmCompanySelection(campaignId, selectedIds)
    if (outcome === "already_confirmed") {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        message: "This selection was already confirmed.",
      })
    }
    if (outcome === "not_at_gate") {
      return NextResponse.json(
        { error: "This campaign is not waiting for a company selection." },
        { status: 409 }
      )
    }

    const executor = await dispatchCampaign(campaignId)
    return NextResponse.json({
      success: true,
      alreadyConfirmed: false,
      selected: selectedIds.length,
      excluded: campaignCompanyIds.size - selectedIds.length,
      executor,
      message: `Finding decision makers at ${selectedIds.length} ${selectedIds.length === 1 ? "company" : "companies"}.`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error(
      "[POST /api/gtm/campaigns/[id]/confirm-selection] Error:",
      err
    )
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
