import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { deleteImport } from "@/lib/contact-import/store"

/**
 * Deletes one imported list (owners and admins, enforced in the proxy): its
 * rows, its people who were never emailed and their unsent drafts. People
 * already emailed stay (lib/contact-import/delete-plan.ts).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    const { id } = await params
    const result = await deleteImport(auth.orgId, id, auth.userId)
    if (!result) return NextResponse.json({ error: "List not found" }, { status: 404 })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[DELETE /api/gtm/data-sources/imports/:id] failed:", err instanceof Error ? err.name : "unknown error")
    return NextResponse.json({ error: "The list wasn't deleted. Try again." }, { status: 500 })
  }
}
