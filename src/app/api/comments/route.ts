import { db } from "@/utils/db";
import { comment, deliverable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { commentRateLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getProjectAccess } from "@/lib/project-auth";

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    
    const ip = reqHeaders.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = await checkRateLimit(commentRateLimiter, `comment_${ip}`);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many comments. Please try again later." }, { status: 429 });
    }

    const payload = await req.json();
    
    const commentSchema = z.object({
      projectId: z.string().min(1, "Project ID is required"),
      body: z.string().min(1, "Comment body cannot be empty"),
      deliverableId: z.string().optional().nullable(),
    });

    const validationResult = commentSchema.safeParse(payload);
    
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 });
    }
    
    const { projectId, body, deliverableId } = validationResult.data;

    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const access = await getProjectAccess(projectId, userId);
    if (!access.isAuthorized) {
      return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    }

    let contextTitle = "project";
    if (deliverableId) {
      const [deliv] = await db.select().from(deliverable).where(eq(deliverable.id, deliverableId));
      if (!deliv || deliv.projectId !== projectId) {
        return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
      }
      contextTitle = deliv.title;
    }

    const [newComment] = await db.insert(comment).values({
      id: crypto.randomUUID(),
      projectId,
      deliverableId: deliverableId || null,
      userId,
      body
    }).returning();

    await logActivity({
      projectId,
      userId,
      type: "comment_added",
      metadata: { commentId: newComment.id, contextTitle }
    });


    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/discussions`);
    revalidatePath(`/projects/${projectId}/deliverables`);

    return NextResponse.json({ success: true, commentId: newComment.id });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json({ error: "Failed to create comment." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json({ error: "Comment ID is required." }, { status: 400 });
    }

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [existingComment] = await db.select().from(comment).where(eq(comment.id, commentId));
    if (!existingComment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const projectId = existingComment.projectId;

    const access = await getProjectAccess(existingComment.projectId, userId);
    if (!access.isAuthorized) {
      return NextResponse.json({ error: "You are not a member of this project." }, { status: 403 });
    }

    if (existingComment.userId !== userId && access.role !== 'owner' && access.role !== 'agency') {
      return NextResponse.json({ error: "You can only delete your own comments." }, { status: 403 });
    }

    await db.delete(comment).where(eq(comment.id, commentId));

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/discussions`);
    revalidatePath(`/projects/${projectId}/deliverables`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json({ error: "Failed to delete comment." }, { status: 500 });
  }
}
