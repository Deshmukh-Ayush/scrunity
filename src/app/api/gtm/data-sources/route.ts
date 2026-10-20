import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { getDataSourcesStatus } from "@/lib/data/data-sources"

/** The organization's data sources: status, last four characters, dates and the run estimate. Never the secret. */
export async function GET() {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    return NextResponse.json(await getDataSourcesStatus(auth.orgId, auth.role))
  } catch (err) {
    console.error("[GET /api/gtm/data-sources] failed:", err instanceof Error ? err.name : "unknown error")
    return NextResponse.json({ error: "Data sources didn't load. Try again." }, { status: 500 })
  }
}
