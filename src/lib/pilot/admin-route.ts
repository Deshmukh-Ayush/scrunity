import "server-only"
import { NextResponse } from "next/server"
import { getPlatformAdmin, type PlatformAdmin } from "@/lib/platform-admin"

/** The plain 404 every admin API answers to anyone who is not a platform admin. */
export function adminNotFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

/**
 * Resolves the platform admin for an admin API route. The proxy already
 * answers non-admins with 404; this repeats the check inside the handler.
 */
export async function requirePlatformAdmin(req: Request): Promise<PlatformAdmin | null> {
  return getPlatformAdmin(req.headers)
}
