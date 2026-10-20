import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { QUOTAS, consumeOrgQuota } from "@/lib/org-quota"
import { connectWithKey } from "@/lib/data-sources/connect"
import { saveValidatedConnection } from "@/lib/data-sources/connections"
import { disconnectDataSource } from "@/lib/data-sources/disconnect"
import { hasConnectionEncryptionKey } from "@/lib/data-sources/secret-box"
import { validateApolloKey } from "@/lib/vendors/apollo/calls"
import { apolloDepsForNewKey } from "@/lib/vendors/apollo/runtime"

/**
 * Connect (POST) and disconnect (DELETE) the organization's Apollo account.
 * Owners and admins only (lib/api-role-policy.ts, enforced in the proxy).
 *
 * The pasted key is read from the body, checked with one free Apollo call and
 * stored encrypted. It is never logged, echoed, put in an error or returned:
 * responses carry only the public connection (status, last four, dates) or a
 * neutral error code. Errors are logged by name only, because a JSON parse
 * error can quote the request body.
 */

export async function POST(req: NextRequest) {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })

    const quota = await consumeOrgQuota(auth.orgId, QUOTAS.dataSourceConnect)
    if (!quota.allowed) return NextResponse.json({ error: quota.message, code: "data_source_rate_limited" }, { status: 429 })

    let rawKey: unknown = null
    try {
      const body: unknown = await req.json()
      rawKey = typeof body === "object" && body !== null ? (body as { apiKey?: unknown }).apiKey : null
    } catch {
      rawKey = null
    }

    const result = await connectWithKey({
      rawKey,
      encryptionAvailable: hasConnectionEncryptionKey(),
      validate: (key) => validateApolloKey(apolloDepsForNewKey(key, auth.orgId)),
      save: (key) => saveValidatedConnection({ organizationId: auth.orgId, provider: "apollo", secret: key, userId: auth.userId }),
    })
    if (!result.ok) return NextResponse.json({ code: result.code }, { status: result.httpStatus })
    return NextResponse.json({ connection: result.connection })
  } catch (err) {
    console.error("[POST /api/gtm/data-sources/apollo] failed:", err instanceof Error ? err.name : "unknown error")
    return NextResponse.json({ code: "data_source_unavailable" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    const revoked = await disconnectDataSource(auth.orgId, "apollo")
    if (!revoked) return NextResponse.json({ error: "No Apollo account is connected." }, { status: 404 })
    return NextResponse.json({ disconnected: true })
  } catch (err) {
    console.error("[DELETE /api/gtm/data-sources/apollo] failed:", err instanceof Error ? err.name : "unknown error")
    return NextResponse.json({ error: "Apollo didn't disconnect. Try again." }, { status: 500 })
  }
}
