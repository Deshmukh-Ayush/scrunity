import { db } from "@/utils/db";
import { deliverable, paymentMilestone } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import crypto from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { NextRequest, NextResponse } from "next/server";
import { getProjectAccess, canManageProject } from "@/lib/project-auth";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const postSchema = z.object({
      projectId: z.string().min(1, "Project ID is required"),
      data: z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().optional().nullable(),
        dueDate: z.string().optional().nullable(),
      }),
    });

    const validationResult = postSchema.safeParse(payload);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 });
    }

    const { projectId, data } = validationResult.data;

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const access = await getProjectAccess(projectId, userId);
    if (!access.proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!access.isAuthorized || !canManageProject(access.role)) {
      return NextResponse.json({ error: "Only the agency can create deliverables." }, { status: 403 });
    }
    if (access.proj.status === 'completed') {
      return NextResponse.json({ error: "Cannot create deliverables on a completed project." }, { status: 400 });
    }

    const deliverableId = crypto.randomUUID();

    await db.insert(deliverable).values({
      id: deliverableId,
      projectId,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: "pending",
      createdBy: userId,
    });

    let scopeEvaluation = null;
    try {
      const { evaluateDeliverableScope } = await import("@/lib/ai/scope-guardian");
      scopeEvaluation = await evaluateDeliverableScope(projectId, data.title, data.description);
    } catch (e) {
      console.error("Scope evaluation on create deliverable notice:", e);
    }

    await logActivity({
      projectId,
      userId,
      type: "deliverable_created",
      metadata: {
        deliverableId,
        title: data.title,
        isScopeCreep: scopeEvaluation?.isScopeCreep ?? false,
        scopeStatus: scopeEvaluation?.status ?? "within_scope",
      }
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/deliverables`);
    return NextResponse.json({ success: true, deliverableId, scopeEvaluation });
  } catch (error) {
    console.error("Create deliverable error:", error);
    return NextResponse.json({ error: "Failed to create deliverable." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();

    const patchSchema = z.object({
      deliverableId: z.string().min(1, "Deliverable ID is required"),
      status: z.enum(["pending", "in_review", "approved", "revision_requested"]),
      comment: z.string().optional().nullable(),
    });

    const validationResult = patchSchema.safeParse(payload);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 });
    }

    const { deliverableId, status, comment } = validationResult.data;

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;

    const [deliv] = await db.select().from(deliverable).where(eq(deliverable.id, deliverableId));
    if (!deliv) return NextResponse.json({ error: "Deliverable not found." }, { status: 404 });

    const access = await getProjectAccess(deliv.projectId, userId);
    if (!access.proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!access.isAuthorized) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    if (access.proj.status === 'completed') {
      return NextResponse.json({ error: "Cannot modify deliverables on a completed project." }, { status: 400 });
    }

    if (access.role === 'client') {
      if (status !== 'approved' && status !== 'revision_requested') {
        return NextResponse.json({ error: "Clients can only approve or request revisions." }, { status: 403 });
      }
      if (deliv.status !== 'in_review') {
        return NextResponse.json({ error: "Deliverable must be in review before action." }, { status: 400 });
      }
    } else if (!canManageProject(access.role)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    await db.update(deliverable).set({ status, updatedAt: new Date() }).where(eq(deliverable.id, deliverableId));

    let activityType: "deliverable_in_review" | "deliverable_approved" | "revision_requested" = "deliverable_in_review";
    if (status === 'approved') activityType = "deliverable_approved";
    if (status === 'revision_requested') activityType = "revision_requested";

    await logActivity({
      projectId: deliv.projectId,
      userId,
      type: activityType,
      metadata: { deliverableId, title: deliv.title, comment: comment || null }
    });

    // Auto-trigger linked payment milestone to "due" upon deliverable approval
    if (status === 'approved') {
      const linkedMilestones = await db
        .select()
        .from(paymentMilestone)
        .where(eq(paymentMilestone.deliverableId, deliverableId));

      for (const m of linkedMilestones) {
        if (m.status === 'upcoming') {
          await db.update(paymentMilestone)
            .set({ status: 'due', updatedAt: new Date() })
            .where(eq(paymentMilestone.id, m.id));

          await logActivity({
            projectId: deliv.projectId,
            userId,
            type: "payment_requested",
            metadata: { milestoneTitle: m.title, amount: m.amount, reason: "deliverable_approved" }
          });
        }
      }
      revalidatePath(`/projects/${deliv.projectId}/payments`);
    }

    revalidatePath(`/projects/${deliv.projectId}`);
    revalidatePath(`/projects/${deliv.projectId}/deliverables`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update deliverable error:", error);
    return NextResponse.json({ error: "Failed to update deliverable status." }, { status: 500 });
  }
}
