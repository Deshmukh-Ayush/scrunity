import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { getCachedInngestConnectivity } from "@/lib/inngest-connectivity"
import { getCampaignDetail } from "@/lib/data/campaigns"

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
      getCampaignDetail(id, auth.orgId),
      getCachedInngestConnectivity(),
    ])

    if (!detail) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      )
    }

    return NextResponse.json({ success: true, ...detail, inngestConnectivity })
  } catch (err: any) {
    console.error("[GET /api/gtm/campaigns/[id]] Error:", err)
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    )
  }
}
