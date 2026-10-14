import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { adminNotFound, requirePlatformAdmin } from "@/lib/pilot/admin-route"
import { GRANTABLE_PLANS, parseEmailList, upsertInvites } from "@/lib/pilot/invites"

const bodySchema = z.object({
  emails: z.string().min(1, "Enter at least one email"),
  plan: z.enum(GRANTABLE_PLANS),
  credits: z.coerce.number().int().min(0).max(100_000).default(0),
  note: z.string().trim().max(500).optional(),
})

/** Adds (or updates) pilot invites for one or several emails. Platform admins only. */
export async function POST(req: NextRequest) {
  const admin = await requirePlatformAdmin(req)
  if (!admin) return adminNotFound()

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { valid, invalid } = parseEmailList(parsed.data.emails)
  if (valid.length === 0) {
    return NextResponse.json({ error: "No valid email addresses found.", invalid }, { status: 400 })
  }
  if (valid.length > 50) {
    return NextResponse.json({ error: "Add at most 50 emails at a time." }, { status: 400 })
  }

  const results = await upsertInvites({
    emails: valid,
    plan: parsed.data.plan,
    credits: parsed.data.credits,
    note: parsed.data.note || null,
    createdByUserId: admin.userId,
  })
  return NextResponse.json({ results, invalid })
}
