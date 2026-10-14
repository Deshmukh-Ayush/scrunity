import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { ensureOnboardingOrganization } from "@/lib/onboarding"

const ERRORS = {
  unauthorized: { status: 401, error: "Please sign in again to continue." },
  invalid_name: { status: 400, error: "Please enter your organization's name." },
  slug_unavailable: {
    status: 409,
    error: "That name is already taken. Try a slightly different name.",
  },
} as const

/**
 * Creates the signed-in user's organization (or returns the one they already
 * have). Idempotent: repeating the request never creates a second organization.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown }
    const name = typeof body.name === "string" ? body.name : ""
    const result = await ensureOnboardingOrganization(await headers(), name)

    if ("organizationId" in result) {
      return NextResponse.json(result, { status: result.status === "created" ? 201 : 200 })
    }
    const { status, error } = ERRORS[result.status]
    return NextResponse.json({ error }, { status })
  } catch (err) {
    console.error("[POST /api/onboarding] Error:", err)
    return NextResponse.json(
      { error: "We couldn't finish setting up your organization. Please try again." },
      { status: 500 }
    )
  }
}
