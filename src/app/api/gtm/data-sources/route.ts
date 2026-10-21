import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { getDataSourcesStatus } from "@/lib/data/data-sources"
import { loadWithTimeout } from "@/lib/data-sources/load-status"

/** The organization's data sources: status, last four characters, dates and the run estimate. Never the secret. */
export async function GET() {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    const result = await loadWithTimeout(() => getDataSourcesStatus(auth.orgId, auth.role))
    if (result.ok) return NextResponse.json(result.value)
    console.error(`[GET /api/gtm/data-sources] failed: ${result.reason}, ${result.detail}`)
    return NextResponse.json(
      { error: "Data sources didn't load. Try again." },
      { status: result.reason === "timeout" ? 503 : 500 }
    )
  } catch (err) {
    console.error("[GET /api/gtm/data-sources] failed:", err instanceof Error ? err.name : "unknown error")
    return NextResponse.json({ error: "Data sources didn't load. Try again." }, { status: 500 })
  }
}
