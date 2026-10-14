import { NextRequest, NextResponse } from "next/server"
import { adminNotFound, requirePlatformAdmin } from "@/lib/pilot/admin-route"
import { revokeInvite } from "@/lib/pilot/invites"

/** Revokes an unclaimed pilot invite (the row is kept with status `revoked`). Platform admins only. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePlatformAdmin(req)
  if (!admin) return adminNotFound()

  const { id } = await params
  const outcome = await revokeInvite(id)
  if (outcome === "not_revocable") {
    return NextResponse.json(
      { error: "Only an invite that is still unclaimed can be revoked." },
      { status: 409 }
    )
  }
  return NextResponse.json({ status: "revoked" })
}
