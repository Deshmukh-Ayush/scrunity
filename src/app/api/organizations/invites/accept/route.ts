import { db } from "@/utils/db";
import { invitation, member, organization } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

const acceptSchema = z.object({
  inviteId: z.string().min(1, "Invite ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = acceptSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { inviteId } = parsed.data;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }

    const userId = session.user.id;

    const [invite] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, inviteId));

    if (!invite) {
      return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "This invitation is no longer active." }, { status: 400 });
    }

    if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch. This invitation was sent to a different email address." }, { status: 403 });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Invitation expired." }, { status: 400 });
    }

    // Check if org exists
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, invite.organizationId));

    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    // Check if already a member
    const [existingMember] = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, invite.organizationId),
          eq(member.userId, userId),
        ),
      );

    // Use conditional update to prevent race conditions
    const changed = await db
      .update(invitation)
      .set({ status: "accepted" })
      .where(and(eq(invitation.id, inviteId), eq(invitation.status, "pending")))
      .returning({ id: invitation.id });

    if (changed.length === 0) {
      return NextResponse.json({ error: "Invitation was already processed." }, { status: 409 });
    }

    if (!existingMember) {
      await db.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: invite.organizationId,
        userId,
        role: invite.role || "member",
      });
    }

    return NextResponse.json({
      success: true,
      organizationId: invite.organizationId,
      organizationName: org.name,
    });
  } catch (error) {
    console.error("Accept org invitation error:", error);
    return NextResponse.json({ error: "Failed to accept invitation." }, { status: 500 });
  }
}
