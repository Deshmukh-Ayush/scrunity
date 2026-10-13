import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmConversation } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { getConversationWithMessages } from "@/lib/data/chat";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const result = await getConversationWithMessages(id, auth.orgId);
    if (!result) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[GET /api/gtm/chat/conversations/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    await db
      .delete(gtmConversation)
      .where(
        and(
          eq(gtmConversation.id, id),
          eq(gtmConversation.organizationId, auth.orgId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/gtm/chat/conversations/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}
