import { db } from "@/utils/db";
import { contract, deliverable, paymentMilestone, proposal, proposalLineItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { canManageProject, getProjectAccess } from "@/lib/project-auth";
import { logActivity } from "@/lib/activity";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().positive().max(100_000),
  unitPrice: z.number().int().nonnegative().max(100_000_000),
});

const proposalInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  scopeSummary: z.string().trim().max(10_000).nullable().optional(),
  price: z.number().int().nonnegative().max(1_000_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("INR"),
  validUntil: z.coerce.date().nullable().optional(),
  lineItems: z.array(lineItemSchema).min(1).max(100),
});

const proposalPatchSchema = z.discriminatedUnion("action", [
  z.object({ proposalId: z.string().min(1), action: z.literal("send") }),
  z.object({ proposalId: z.string().min(1), action: z.literal("accept") }),
  z.object({ proposalId: z.string().min(1), action: z.literal("decline") }),
  proposalInputSchema.omit({ projectId: true }).extend({
    proposalId: z.string().min(1),
    action: z.literal("update_draft"),
  }),
]);

async function currentUser() {
  const requestHeaders = await headers();
  return auth.api.getSession({ headers: requestHeaders });
}

function buildLineItems(proposalId: string, lineItems: z.infer<typeof lineItemSchema>[]) {
  return lineItems.map((item, sortOrder) => ({
    id: crypto.randomUUID(),
    proposalId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.quantity * item.unitPrice,
    sortOrder,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const input = proposalInputSchema.safeParse(await req.json());
    if (!input.success) return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 });

    const session = await currentUser();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await getProjectAccess(input.data.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role)) {
      return NextResponse.json({ error: "Only the agency can create proposals" }, { status: 403 });
    }

    const proposalId = crypto.randomUUID();
    const lineItems = buildLineItems(proposalId, input.data.lineItems);
    await db.batch([
      db.insert(proposal).values({
        id: proposalId,
        projectId: input.data.projectId,
        title: input.data.title,
        scopeSummary: input.data.scopeSummary ?? null,
        price: input.data.price,
        currency: (access.proj?.currency as "USD" | "INR") || input.data.currency || "USD",
        validUntil: input.data.validUntil ?? null,
        createdBy: session.user.id,
        status: "draft",
      }),
      db.insert(proposalLineItems).values(lineItems),
    ]);

    return NextResponse.json({ success: true, proposalId }, { status: 201 });
  } catch (error) {
    console.error("POST proposal error:", error);
    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const input = proposalPatchSchema.safeParse(await req.json());
    if (!input.success) return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 });

    const session = await currentUser();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [existing] = await db.select().from(proposal).where(eq(proposal.id, input.data.proposalId));
    if (!existing) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const access = await getProjectAccess(existing.projectId, session.user.id);
    if (!access.isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (input.data.action === "update_draft") {
      if (!canManageProject(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (existing.status !== "draft") return NextResponse.json({ error: "Only draft proposals can be updated" }, { status: 400 });
      const lineItems = buildLineItems(existing.id, input.data.lineItems);
      await db.batch([
        db.update(proposal).set({
          title: input.data.title,
          scopeSummary: input.data.scopeSummary ?? null,
          price: input.data.price,
          currency: input.data.currency,
          validUntil: input.data.validUntil ?? null,
        }).where(and(eq(proposal.id, existing.id), eq(proposal.status, "draft"))),
        db.delete(proposalLineItems).where(eq(proposalLineItems.proposalId, existing.id)),
        db.insert(proposalLineItems).values(lineItems),
      ]);
      return NextResponse.json({ success: true });
    }

    if (input.data.action === "send") {
      if (!canManageProject(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const changed = await db.update(proposal)
        .set({ status: "sent", sentAt: new Date() })
        .where(and(eq(proposal.id, existing.id), eq(proposal.status, "draft")))
        .returning({ id: proposal.id });
      if (changed.length === 0) return NextResponse.json({ error: "Only draft proposals can be sent" }, { status: 409 });
      await logActivity({ projectId: existing.projectId, userId: session.user.id, type: "proposal_sent", metadata: { proposalId: existing.id, title: existing.title } });
      return NextResponse.json({ success: true });
    }

    if (access.role !== "client") return NextResponse.json({ error: "Only the client can respond to a proposal" }, { status: 403 });
    if (input.data.action === "decline") {
      const changed = await db.update(proposal)
        .set({ status: "declined", declinedAt: new Date() })
        .where(and(eq(proposal.id, existing.id), eq(proposal.status, "sent")))
        .returning({ id: proposal.id });
      if (changed.length === 0) return NextResponse.json({ error: "Proposal must be sent first" }, { status: 409 });
      await logActivity({ projectId: existing.projectId, userId: session.user.id, type: "proposal_declined", metadata: { proposalId: existing.id, title: existing.title } });
      return NextResponse.json({ success: true });
    }

    const lineItems = await db.query.proposalLineItems.findMany({ where: eq(proposalLineItems.proposalId, existing.id) });

    // Check if an active signed contract with scope terms already exists
    const [signedContract] = await db
      .select({ id: contract.id })
      .from(contract)
      .where(and(eq(contract.projectId, existing.projectId), eq(contract.status, "signed")))
      .limit(1);

    const deliverableRows = lineItems.map((item) => ({
      id: crypto.randomUUID(), projectId: existing.projectId, title: item.description,
      description: `Auto-generated from proposal \"${existing.title}\"`, status: "pending" as const,
      createdBy: session.user.id, dueDate: null,
    }));
    const milestoneRows = lineItems.map((item, index) => ({
      id: crypto.randomUUID(), projectId: existing.projectId, proposalId: existing.id,
      deliverableId: deliverableRows[index].id, title: `${item.description} Payment`,
      description: `Payment released upon approval of "${item.description}"`, amount: Math.round(item.total * 100),
      currency: existing.currency, triggerType: "on_approval" as const, status: "upcoming" as const,
      sortOrder: item.sortOrder, createdBy: session.user.id,
    }));
    const changed = await db.update(proposal)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(and(eq(proposal.id, existing.id), eq(proposal.status, "sent")))
      .returning({ id: proposal.id });
    if (changed.length === 0) return NextResponse.json({ error: "Proposal must be sent first" }, { status: 409 });
    if (deliverableRows.length > 0) {
      await db.batch([db.insert(deliverable).values(deliverableRows), db.insert(paymentMilestone).values(milestoneRows)]);
    }

    if (signedContract) {
      try {
        const { reconcileContractDeliverables } = await import("@/lib/ai/scope-guardian");
        await reconcileContractDeliverables(existing.projectId, signedContract.id, session.user.id);
      } catch (reconErr) {
        console.error("Contract deliverable reconciliation on proposal accept notice:", reconErr);
      }
    }

    await logActivity({ projectId: existing.projectId, userId: session.user.id, type: "proposal_accepted", metadata: { proposalId: existing.id, title: existing.title } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH proposal error:", error);
    return NextResponse.json({ error: "Failed to process proposal action" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const proposalId = new URL(req.url).searchParams.get("proposalId");
    if (!proposalId) return NextResponse.json({ error: "Proposal ID is required" }, { status: 400 });
    const session = await currentUser();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [existing] = await db.select().from(proposal).where(eq(proposal.id, proposalId));
    if (!existing) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    const access = await getProjectAccess(existing.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const deleted = await db.delete(proposal).where(and(eq(proposal.id, existing.id), eq(proposal.status, "draft"))).returning({ id: proposal.id });
    if (deleted.length === 0) return NextResponse.json({ error: "Only draft proposals can be deleted" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE proposal error:", error);
    return NextResponse.json({ error: "Failed to delete proposal" }, { status: 500 });
  }
}
