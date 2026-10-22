import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { MANAGER_ROLES } from "@/lib/api-role-policy"
import { saveCompanyProfileSchema } from "@/lib/company-profile/input"
import { saveCompanyProfile } from "@/lib/company-profile/store"
import { getCompanyProfileView } from "@/lib/data/company-profile"
import { COMPANY_PROFILE_COPY } from "@/lib/company-profile/copy"

/** The organization's company profile and whether this member can edit it. */
export async function GET() {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    return NextResponse.json(await getCompanyProfileView(auth.orgId, auth.role))
  } catch (err) {
    console.error("[GET /api/gtm/company-profile] Error:", err)
    return NextResponse.json({ error: COMPANY_PROFILE_COPY.loadFailed }, { status: 500 })
  }
}

/**
 * Saves the whole profile and the research form setting. Owners and admins
 * only: the proxy refuses members (api-role-policy), and so does this handler.
 */
export async function PUT(req: NextRequest) {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    if (!MANAGER_ROLES.has(auth.role)) {
      return NextResponse.json({ error: COMPANY_PROFILE_COPY.membersReadOnly }, { status: 403 })
    }

    const parsed = saveCompanyProfileSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: COMPANY_PROFILE_COPY.invalid, details: parsed.error.issues }, { status: 400 })
    }

    const { researchFormMode, ...input } = parsed.data
    await saveCompanyProfile(auth.orgId, auth.userId, input, researchFormMode)
    return NextResponse.json(await getCompanyProfileView(auth.orgId, auth.role))
  } catch (err) {
    console.error("[PUT /api/gtm/company-profile] Error:", err)
    return NextResponse.json({ error: COMPANY_PROFILE_COPY.saveFailed }, { status: 500 })
  }
}
