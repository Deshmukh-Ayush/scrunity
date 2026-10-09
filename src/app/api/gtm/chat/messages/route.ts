import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmConversation, gtmMessage } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const body = await req.json().catch(() => ({}));
    const {
      conversationId,
      role,
      content,
      toolCalls,
      id: clientMessageId,
    } = body;

    if (!conversationId || !role || content === undefined) {
      return NextResponse.json(
        { error: "conversationId, role, and content are required." },
        { status: 400 }
      );
    }

    const [conv] = await db
      .select()
      .from(gtmConversation)
      .where(
        and(
          eq(gtmConversation.id, conversationId),
          eq(gtmConversation.organizationId, auth.orgId)
        )
      )
      .limit(1);

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found or unauthorized." },
        { status: 404 }
      );
    }

    const messageId = clientMessageId || nanoid();

    const [savedMsg] = await db
      .insert(gtmMessage)
      .values({
        id: messageId,
        conversationId,
        role,
        content: content || "",
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
      })
      .returning();

    // Update conversation updatedAt & title if needed
    const updateData: { updatedAt: Date; title?: string } = {
      updatedAt: new Date(),
    };

    if (
      (!conv.title || conv.title === "New conversation") &&
      role === "user" &&
      content
    ) {
      const cleanTitle = content.trim().replace(/\n+/g, " ").slice(0, 50);
      updateData.title =
        cleanTitle.length === 50 ? `${cleanTitle}…` : cleanTitle;
    }

    await db
      .update(gtmConversation)
      .set(updateData)
      .where(eq(gtmConversation.id, conversationId));

    return NextResponse.json({ message: savedMsg }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/gtm/chat/messages] Error:", err);
    return NextResponse.json(
      { error: "Failed to persist message", message: err.message },
      { status: 500 }
    );
  }
}
