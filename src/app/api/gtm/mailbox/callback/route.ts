import { NextRequest, NextResponse } from "next/server";
import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { exchangeCodeForTokens } from "@/lib/gmail";
import { encryptToken, decryptToken } from "@/lib/encryption";

interface StatePayload {
  orgId: string;
  userId: string;
  ts: number;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  const origin = process.env.BASE_URL || url.origin;
  const redirectUri = `${origin}/api/gtm/mailbox/callback`;

  if (googleError) {
    console.error("[GET /api/gtm/mailbox/callback] Google error:", googleError);
    return NextResponse.redirect(
      new URL(`/dashboard/campaigns?error=${encodeURIComponent(googleError)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/campaigns?error=missing_code_or_state", origin)
    );
  }

  try {
    // 1. Verify and decrypt state token
    let stateData: StatePayload;
    try {
      const decrypted = decryptToken(state);
      stateData = JSON.parse(decrypted) as StatePayload;
    } catch {
      return NextResponse.redirect(
        new URL("/dashboard/campaigns?error=invalid_or_expired_state", origin)
      );
    }

    const { orgId, userId } = stateData;

    // 2. Exchange code for Google tokens
    const tokens = await exchangeCodeForTokens({ code, redirectUri });

    // 3. Encrypt sensitive tokens at rest
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const accessTokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // 4. Upsert into gtm_connected_mailbox for this organization
    const [existing] = await db
      .select()
      .from(gtmConnectedMailbox)
      .where(eq(gtmConnectedMailbox.organizationId, orgId));

    if (existing) {
      await db
        .update(gtmConnectedMailbox)
        .set({
          email: tokens.email,
          encryptedRefreshToken,
          encryptedAccessToken,
          accessTokenExpiresAt,
          status: "connected",
          connectedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(gtmConnectedMailbox.id, existing.id));
    } else {
      await db.insert(gtmConnectedMailbox).values({
        organizationId: orgId,
        provider: "gmail",
        email: tokens.email,
        encryptedRefreshToken,
        encryptedAccessToken,
        accessTokenExpiresAt,
        status: "connected",
        connectedBy: userId,
      });
    }

    return NextResponse.redirect(
      new URL("/dashboard/campaigns?mailbox_connected=true", origin)
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to connect mailbox";
    console.error("[GET /api/gtm/mailbox/callback] Error:", err);
    return NextResponse.redirect(
      new URL(`/dashboard/campaigns?error=${encodeURIComponent(msg)}`, origin)
    );
  }
}
