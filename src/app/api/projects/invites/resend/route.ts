import { db } from "@/utils/db";
import { organization, projectInvitation } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { canManageProject, getProjectAccess } from "@/lib/project-auth";
import { headers } from "next/headers";
import { sendProjectInvitationEmail } from "@/lib/email";
import { checkRateLimit, inviteRateLimiter } from "@/lib/ratelimit";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const resendSchema = z.object({ projectId: z.string().min(1), email: z.string().trim().email().max(320) });

export async function POST(req: NextRequest) {
  try {
    const input = resendSchema.safeParse(await req.json());
    if (!input.success) return NextResponse.json({ error: input.error.issues[0].message }, { status: 400 });
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await getProjectAccess(input.data.projectId, session.user.id);
    if (!access.proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!access.isAuthorized || !canManageProject(access.role)) return NextResponse.json({ error: "Only the agency can resend invitations" }, { status: 403 });
    const rateLimitResult = await checkRateLimit(inviteRateLimiter, `invite_resend_${session.user.id}`);
    if (!rateLimitResult.success) return NextResponse.json({ error: "Too many invitations sent. Please try again later." }, { status: 429 });

    const [invitation] = await db.select().from(projectInvitation).where(and(
      eq(projectInvitation.projectId, input.data.projectId),
      eq(projectInvitation.email, input.data.email.toLowerCase()),
    ));
    if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= new Date()) {
      return NextResponse.json({ error: "No active invitation found for this email" }, { status: 404 });
    }
    const [org] = access.proj.organizationId
      ? await db.select().from(organization).where(eq(organization.id, access.proj.organizationId))
      : [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    await sendProjectInvitationEmail(invitation.email, access.proj.name, `${baseUrl}/invite/${invitation.token}`, org?.plan, org?.logoUrl);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Resend invite error:", error);
    return NextResponse.json({ error: "Failed to resend invite" }, { status: 500 });
  }
}
