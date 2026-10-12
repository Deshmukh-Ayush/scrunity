import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { testImapSmtpConnection, type ImapSmtpConnectionInput } from "@/lib/imap-smtp";
import { encryptToken } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    const body = (await req.json()) as ImapSmtpConnectionInput;

    if (!body?.email || !body.email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (!body?.smtp?.host || !body.smtp.port || !body.smtp.user || !body.smtp.pass) {
      return NextResponse.json(
        {
          error:
            "Complete SMTP configuration required (host, port, username, and password). Outbound sending cannot be enabled without SMTP.",
        },
        { status: 400 }
      );
    }

    if (!body?.imap?.host || !body.imap.port || !body.imap.user || !body.imap.pass) {
      return NextResponse.json(
        {
          error:
            "Complete IMAP configuration required (host, port, username, and password). Both IMAP and SMTP must be configured so replies can be monitored.",
        },
        { status: 400 }
      );
    }

    // 1. Verify credentials against both live servers
    const testResult = await testImapSmtpConnection(body);
    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.error || "Failed to connect to email servers" },
        { status: 400 }
      );
    }

    // 2. Encrypt passwords using existing AES-256-GCM mechanism
    const encryptedPassword = encryptToken(body.smtp.pass);

    const metadata = {
      smtp: {
        host: body.smtp.host.trim(),
        port: Number(body.smtp.port),
        secure: Boolean(body.smtp.secure),
        user: body.smtp.user.trim(),
      },
      imap: {
        host: body.imap.host.trim(),
        port: Number(body.imap.port),
        secure: Boolean(body.imap.secure),
        user: body.imap.user.trim(),
      },
      providerDisplayName: body.displayName?.trim() || body.email.trim(),
    };

    // 3. Upsert into gtm_connected_mailbox
    const [existing] = await db
      .select()
      .from(gtmConnectedMailbox)
      .where(eq(gtmConnectedMailbox.organizationId, auth.orgId));

    if (existing) {
      await db
        .update(gtmConnectedMailbox)
        .set({
          provider: "imap_smtp",
          email: body.email.trim().toLowerCase(),
          encryptedRefreshToken: null,
          encryptedAccessToken: null,
          accessTokenExpiresAt: null,
          encryptedPassword,
          metadata,
          status: "connected",
          connectedBy: auth.userId,
          updatedAt: new Date(),
        })
        .where(eq(gtmConnectedMailbox.id, existing.id));
    } else {
      await db.insert(gtmConnectedMailbox).values({
        organizationId: auth.orgId,
        provider: "imap_smtp",
        email: body.email.trim().toLowerCase(),
        encryptedPassword,
        metadata,
        status: "connected",
        connectedBy: auth.userId,
      });
    }

    return NextResponse.json({
      success: true,
      mailbox: {
        email: body.email.trim().toLowerCase(),
        provider: "imap_smtp",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/gtm/mailbox/imap-smtp/connect] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
