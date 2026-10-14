import { NextRequest, NextResponse } from "next/server";
import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exchangeMicrosoftCodeForTokens } from "@/lib/microsoft";
import { encryptToken } from "@/lib/encryption";
import { verifyMailboxOAuthState } from "@/lib/mailbox-oauth-state";

export async function GET(req: NextRequest) {
  // Feature flag gating Microsoft mailbox connection
  const isMicrosoftEnabled = process.env.MICROSOFT_MAILBOX_ENABLED === "true";
  if (!isMicrosoftEnabled) {
    return NextResponse.json(
      {
        error:
          "Microsoft 365 / Outlook mailbox connection is not yet enabled. Coming soon.",
        available: false,
      },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const msError = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const origin = process.env.BASE_URL || url.origin;
  const redirectUri = `${origin}/api/gtm/mailbox/microsoft/callback`;

  if (msError) {
    console.error("[GET /api/gtm/mailbox/microsoft/callback] Microsoft error:", msError, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/dashboard/mailbox?tab=settings&error=${encodeURIComponent(
          errorDescription || msError
        )}`,
        origin
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/mailbox?tab=settings&error=missing_code_or_state", origin)
    );
  }

  try {
    // 1. Verify the state: decrypts, at most 10 minutes old, and issued to the
    // same signed-in user and organization that is finishing the flow.
    const verifiedState = verifyMailboxOAuthState(state, req.headers);
    if (!verifiedState.ok) {
      return NextResponse.redirect(
        new URL(`/dashboard/mailbox?tab=settings&error=${verifiedState.reason}`, origin)
      );
    }

    const { orgId, userId } = verifiedState.state;

    // 2. Exchange code for Microsoft tokens
    const tokens = await exchangeMicrosoftCodeForTokens({ code, redirectUri });

    // 3. Encrypt sensitive tokens at rest
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // 4. Upsert into gtm_connected_mailbox
    const [existing] = await db
      .select()
      .from(gtmConnectedMailbox)
      .where(eq(gtmConnectedMailbox.organizationId, orgId));

    const metadata = {
      microsoftTenantId: tokens.tenantId,
      providerDisplayName: tokens.displayName || tokens.email,
    };

    if (existing) {
      await db
        .update(gtmConnectedMailbox)
        .set({
          provider: "microsoft",
          email: tokens.email,
          encryptedRefreshToken,
          encryptedAccessToken,
          accessTokenExpiresAt,
          encryptedPassword: null,
          metadata,
          status: "connected",
          connectedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(gtmConnectedMailbox.id, existing.id));
    } else {
      await db.insert(gtmConnectedMailbox).values({
        organizationId: orgId,
        provider: "microsoft",
        email: tokens.email,
        encryptedRefreshToken,
        encryptedAccessToken,
        accessTokenExpiresAt,
        metadata,
        status: "connected",
        connectedBy: userId,
      });
    }

    return NextResponse.redirect(
      new URL("/dashboard/mailbox?tab=settings&mailbox_connected=true", origin)
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to connect Microsoft mailbox";
    console.error("[GET /api/gtm/mailbox/microsoft/callback] Error:", err);
    return NextResponse.redirect(
      new URL(`/dashboard/mailbox?tab=settings&error=${encodeURIComponent(msg)}`, origin)
    );
  }
}
