import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { adminNotFound, requirePlatformAdmin } from "@/lib/pilot/admin-route"
import { setOrganizationPlan } from "@/lib/pilot/admin-actions"
import { GRANTABLE_PLANS } from "@/lib/pilot/invites"

const bodySchema = z.object({ plan: z.enum(GRANTABLE_PLANS) })

/**
 * Sets an organization's plan through the Dodo activation path: plan, active
 * status, a new 30-day period and a credit reset to the plan allotment.
 * Platform admins only.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin(req)
  if (!admin) return adminNotFound()

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { id } = await params
  const result = await setOrganizationPlan(id, parsed.data.plan)
  if (result.status === "not_found") {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 })
  }
  console.info(`[admin] ${admin.email} set plan ${parsed.data.plan} on organization ${id}`)
  return NextResponse.json(result)
}
