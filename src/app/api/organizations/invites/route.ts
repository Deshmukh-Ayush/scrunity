import { db } from "@/utils/db";
import { organization, member, invitation, user } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sendProjectInvitationEmail } from "@/lib/email";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    
    const postSchema = z.object({
      email: z.string().email("Valid email is required"),
    });

    const validationResult = postSchema.safeParse(payload);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 });
    }

    const { email } = validationResult.data;

    const reqHeaders = await headers();
    
    const ip = reqHeaders.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = rateLimit(`org_invite_${ip}`, 5, 60 * 1000); // 5 per min
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many invitations. Please try again later." }, { status: 429 });
    }

    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user || !session.session.activeOrganizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.session.activeOrganizationId;
    
    const [orgMember] = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)));

    if (!orgMember || orgMember.role !== "owner") {
      return NextResponse.json({ error: "Only organization owners can invite teammates." }, { status: 403 });
    }

    const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    // Use our new billing configuration helper
    const { getPlanLimits, getTotalAllowedSeats } = await import("@/config/billing");
    const limits = getPlanLimits(org.plan as any);
    const totalAllowedSeats = getTotalAllowedSeats(org.plan as any, (org as any).extraSeats || 0);

    if (totalAllowedSeats <= 1) {
      return NextResponse.json({ error: `Your current plan (${limits.name}) does not support additional teammates. Please upgrade or add an extra teammate seat.` }, { status: 403 });
    }

    const existingMembers = await db.select({ id: member.id }).from(member).where(eq(member.organizationId, orgId));
    const pendingInvites = await db.select({ id: invitation.id }).from(invitation).where(and(eq(invitation.organizationId, orgId), eq(invitation.status, "pending")));
    
    if (existingMembers.length + pendingInvites.length >= totalAllowedSeats) {
      return NextResponse.json({ error: `Your organization is limited to ${totalAllowedSeats} seats (${limits.includedSeats} included + ${(org as any).extraSeats || 0} extra). You have reached the limit.` }, { status: 403 });
    }

    const [existingMember] = await db
      .select()
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(and(eq(member.organizationId, orgId), eq(user.email, email.trim().toLowerCase())));
      
    if (existingMember) {
      return NextResponse.json({ error: "User is already a member of this organization." }, { status: 400 });
    }

    const inviteId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(invitation).values({
      id: inviteId,
      email: email.trim().toLowerCase(),
      inviterId: session.user.id,
      organizationId: orgId,
      role: "member",
      status: "pending",
      expiresAt,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteLink = `${baseUrl}/invite/org/${inviteId}`;
    
    // Send email using the project invite template for now
    await sendProjectInvitationEmail(email.trim().toLowerCase(), org.name, inviteLink, org.plan);

    revalidatePath("/dashboard/settings");
    
    return NextResponse.json({ success: true, token: inviteId });
  } catch (error) {
    console.error("Create org invite error:", error);
    return NextResponse.json({ error: "Failed to create invitation." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get("inviteId");

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required." }, { status: 400 });
    }

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user || !session.session.activeOrganizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.session.activeOrganizationId;

    const [orgMember] = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)));

    if (!orgMember || orgMember.role !== "owner") {
      return NextResponse.json({ error: "Only organization owners can revoke invites." }, { status: 403 });
    }

    await db.delete(invitation).where(and(eq(invitation.id, inviteId), eq(invitation.organizationId, orgId)));

    revalidatePath("/dashboard/settings");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Revoke org invite error:", error);
    return NextResponse.json({ error: "Failed to revoke invitation." }, { status: 500 });
  }
}
