import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth"
import { removeBouncedAndResume } from "@/lib/contact-import/bounce-pause"
import { dispatchCampaignSend } from "@/lib/pipeline/dispatch"

/**
 * POST: for a campaign paused by the bounce-rate rule, removes the bounced
 * addresses (from the campaign and its imported list) and resumes: sending
 * starts again when approved emails remain. Owners and admins only
 * (lib/api-role-policy.ts, enforced in the proxy). A repeat answers 409.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    const { id: campaignId } = await params
    if (!(await verifyCampaignAccess(campaignId, auth.orgId))) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }
    const result = await removeBouncedAndResume(campaignId)
    if (!result.ok) {
      return NextResponse.json({ error: "This campaign isn't paused for bounces any more. Refresh the page." }, { status: 409 })
    }
    if (result.next === "send") await dispatchCampaignSend(campaignId)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[POST /api/gtm/campaigns/:id/bounces] failed:", err instanceof Error ? err.name : "unknown error")
    return NextResponse.json({ error: "Sending didn't resume. Try again." }, { status: 500 })
  }
}
