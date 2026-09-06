import { db } from "@/utils/db";
import { deliverable, paymentMilestone } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { canManageProject, getProjectAccess } from "@/lib/project-auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import crypto from "crypto";
import { z } from "zod";

const milestoneFields = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).nullable().optional(),
  amount: z.number().int().positive().max(1_000_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("INR"),
  triggerType: z.enum(["upfront", "on_approval", "on_date", "manual"]).default("manual"),
  dueDate: z.coerce.date().nullable().optional(),
  deliverableId: z.string().min(1).nullable().optional(),
});

const createSchema = milestoneFields.extend({ projectId: z.string().min(1) });
const patchSchema = z.object({
  milestoneId: z.string().min(1),
  status: z.enum(["upcoming", "due", "overdue", "paid", "waived"]).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10_000).nullable().optional(),
  amount: z.number().int().positive().max(1_000_000_000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

async function currentUser() {
  return auth.api.getSession({ headers: await headers() });
}

async function ensureDeliverableBelongsToProject(deliverableId: string | null | undefined, projectId: string) {
  if (!deliverableId) return true;
  const [linkedDeliverable] = await db.select({ projectId: deliverable.projectId }).from(deliverable).where(eq(deliverable.id, deliverableId));
  return linkedDeliverable?.projectId === projectId;
}

export async function POST(req: NextRequest) {
  try {
    const input = createSchema.safeParse(await req.json());
    if (!input.success) return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 });
    const session = await currentUser();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await getProjectAccess(input.data.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role)) return NextResponse.json({ error: "Only the agency can create payment milestones" }, { status: 403 });
    if (!(await ensureDeliverableBelongsToProject(input.data.deliverableId, input.data.projectId))) {
      return NextResponse.json({ error: "The selected deliverable does not belong to this project" }, { status: 400 });
    }

    const milestoneId = crypto.randomUUID();
    const milestoneCurrency = (access.proj?.currency as "USD" | "INR") || input.data.currency || "USD";
    await db.insert(paymentMilestone).values({
      id: milestoneId, projectId: input.data.projectId, title: input.data.title,
      description: input.data.description ?? null, amount: input.data.amount,
      currency: milestoneCurrency, triggerType: input.data.triggerType,
      dueDate: input.data.dueDate ?? null, deliverableId: input.data.deliverableId ?? null,
      status: input.data.triggerType === "upfront" ? "due" : "upcoming", createdBy: session.user.id,
    });
    await logActivity({ projectId: input.data.projectId, userId: session.user.id, type: "milestone_created", metadata: { milestoneTitle: input.data.title, amount: input.data.amount, currency: milestoneCurrency } });
    revalidatePath(`/projects/${input.data.projectId}`);
    revalidatePath(`/projects/${input.data.projectId}/payments`);
    return NextResponse.json({ success: true, milestoneId }, { status: 201 });
  } catch (error) {
    console.error("POST milestone error:", error);
    return NextResponse.json({ error: "Failed to create milestone" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const input = patchSchema.safeParse(await req.json());
    if (!input.success) return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 });
    const session = await currentUser();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [existing] = await db.select().from(paymentMilestone).where(eq(paymentMilestone.id, input.data.milestoneId));
    if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    const access = await getProjectAccess(existing.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (input.data.status === "paid") return NextResponse.json({ error: "Use the payment confirmation flow to mark a milestone paid" }, { status: 400 });

    const updates = { ...input.data };
    delete (updates as { milestoneId?: string }).milestoneId;
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    await db.update(paymentMilestone).set({ ...updates, updatedAt: new Date() }).where(eq(paymentMilestone.id, existing.id));
    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/payments`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH milestone error:", error);
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const milestoneId = new URL(req.url).searchParams.get("milestoneId");
    if (!milestoneId) return NextResponse.json({ error: "Milestone ID is required" }, { status: 400 });
    const session = await currentUser();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [existing] = await db.select().from(paymentMilestone).where(eq(paymentMilestone.id, milestoneId));
    if (!existing) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    const access = await getProjectAccess(existing.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (existing.status === "paid") return NextResponse.json({ error: "Paid milestones cannot be deleted" }, { status: 400 });
    await db.delete(paymentMilestone).where(eq(paymentMilestone.id, existing.id));
    revalidatePath(`/projects/${existing.projectId}`);
    revalidatePath(`/projects/${existing.projectId}/payments`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE milestone error:", error);
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}
