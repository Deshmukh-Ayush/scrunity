import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { getGoogleOAuthUrl } from "@/lib/gmail";
import { encryptToken } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // Determine base redirect URI
    const url = new URL(req.url);
    const origin = process.env.BASE_URL || url.origin;
    const redirectUri = `${origin}/api/gtm/mailbox/callback`;

    // Secure state payload containing orgId and userId, encrypted with AES-256-GCM
    const statePayload = JSON.stringify({
      orgId: auth.orgId,
      userId: auth.userId,
      ts: Date.now(),
    });
    const state = encryptToken(statePayload);

    const googleAuthUrl = getGoogleOAuthUrl({ state, redirectUri });

    return NextResponse.redirect(googleAuthUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/gtm/mailbox/connect] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
