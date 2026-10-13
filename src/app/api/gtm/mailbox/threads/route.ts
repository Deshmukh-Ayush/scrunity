import { NextRequest, NextResponse } from "next/server"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { getMailboxThreads } from "@/lib/data/mailbox"

export async function GET(req: NextRequest) {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(req.headers)

    if (error || !auth) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: status || 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const result = await getMailboxThreads(auth.orgId, {
      search: searchParams.get("search") ?? undefined,
      intent: searchParams.get("intent"),
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error("[GET /api/gtm/mailbox/threads] Error:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
