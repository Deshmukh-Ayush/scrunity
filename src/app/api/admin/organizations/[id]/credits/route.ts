import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { adminNotFound, requirePlatformAdmin } from "@/lib/pilot/admin-route"
import { MAX_MANUAL_GRANT, grantManualCredits } from "@/lib/pilot/admin-actions"

const bodySchema = z.object({
  amount: z.coerce.number().int().min(1, "Amount must be at least 1").max(MAX_MANUAL_GRANT),
  reason: z.string().trim().min(3, "A reason is required").max(500),
  // Generated once per form submission so a double submit grants once.
  requestId: z.string().min(8).max(100),
})

/** Adds credits to an organization as a manual grant. Platform admins only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin(req)
  if (!admin) return adminNotFound()

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { id } = await params
  const result = await grantManualCredits({
    organizationId: id,
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    requestId: parsed.data.requestId,
    adminUserId: admin.userId,
    adminEmail: admin.email,
  })
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 })
  }
  return NextResponse.json(result)
}
