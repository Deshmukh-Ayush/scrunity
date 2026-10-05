import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const [mailbox] = await db
      .select({
        id: gtmConnectedMailbox.id,
        email: gtmConnectedMailbox.email,
        provider: gtmConnectedMailbox.provider,
        status: gtmConnectedMailbox.status,
        dailySendCount: gtmConnectedMailbox.dailySendCount,
        lastSendResetDate: gtmConnectedMailbox.lastSendResetDate,
        connectedAt: gtmConnectedMailbox.connectedAt,
      })
      .from(gtmConnectedMailbox)
      .where(eq(gtmConnectedMailbox.organizationId, auth.orgId));

    if (!mailbox || mailbox.status !== "connected") {
      return NextResponse.json({
        connected: false,
        mailbox: null,
      });
    }

    return NextResponse.json({
      connected: true,
      mailbox,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/gtm/mailbox] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const [mailbox] = await db
      .select()
      .from(gtmConnectedMailbox)
      .where(eq(gtmConnectedMailbox.organizationId, auth.orgId));

    if (!mailbox) {
      return NextResponse.json(
        { error: "No mailbox found for this organization" },
        { status: 404 }
      );
    }

    // Revoke locally and remove cached access token
    await db
      .update(gtmConnectedMailbox)
      .set({
        status: "revoked",
        encryptedAccessToken: null,
        updatedAt: new Date(),
      })
      .where(eq(gtmConnectedMailbox.id, mailbox.id));

    return NextResponse.json({
      success: true,
      message: "Mailbox disconnected successfully",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[DELETE /api/gtm/mailbox] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
