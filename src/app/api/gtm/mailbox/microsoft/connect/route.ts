import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { getMicrosoftOAuthUrl } from "@/lib/microsoft";
import { encryptToken } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  // Feature flag gating Microsoft mailbox connection
  const isMicrosoftEnabled = process.env.MICROSOFT_MAILBOX_ENABLED === "true";
  if (!isMicrosoftEnabled) {
    return NextResponse.json(
      {
        error:
          "Microsoft 365 / Outlook mailbox connection is coming soon. In the meantime, please connect using Google Workspace or Generic IMAP/SMTP.",
        available: false,
      },
      { status: 503 }
    );
  }

  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const url = new URL(req.url);
    const origin = process.env.BASE_URL || url.origin;
    const redirectUri = `${origin}/api/gtm/mailbox/microsoft/callback`;

    // Secure state token containing orgId and userId
    const statePayload = JSON.stringify({
      orgId: auth.orgId,
      userId: auth.userId,
      ts: Date.now(),
    });
    const state = encryptToken(statePayload);

    const microsoftAuthUrl = getMicrosoftOAuthUrl({ state, redirectUri });

    return NextResponse.redirect(microsoftAuthUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/gtm/mailbox/microsoft/connect] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
