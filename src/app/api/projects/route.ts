import { db } from "@/utils/db";
import { project, projectMember, projectInvitation, organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { sendProjectInvitationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { getProjectAccess, canManageProject } from "@/lib/project-auth";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { getTenantContext } from "@/lib/tenant-context";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const clientEmail = formData.get("clientEmail") as string;
    const rawCurrency = (formData.get("currency") as string)?.toUpperCase();

    if (!name || !clientEmail) {
      return NextResponse.json({ error: "Name and Client Email are required." }, { status: 400 });
    }

    const reqHeaders = await headers();
    
    const ip = reqHeaders.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = rateLimit(`project_${ip}`, 5, 60 * 1000); // 5 projects per minute
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const ctx = await getTenantContext(reqHeaders);

    if (ctx.error || !ctx.user || !ctx.organizationId) {
      return NextResponse.json({ error: ctx.error || "Unauthorized or no active organization." }, { status: ctx.status || 401 });
    }

    const userId = ctx.user.id;
    const orgId = ctx.organizationId;

    const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
    if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const { getPlanLimits } = await import("@/config/billing");
    const limits = getPlanLimits(org.plan as any);

    if (limits.maxProjects !== "unlimited") {
      const activeProjects = await db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.organizationId, orgId));
      
      if (activeProjects.length >= limits.maxProjects) {
        return NextResponse.json({ error: `Your ${limits.name} plan is limited to ${limits.maxProjects} project(s). Please upgrade to create more.` }, { status: 403 });
      }
    }

    // Generate token
    const token = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const projectCurrency = (rawCurrency === "INR" || rawCurrency === "USD") ? rawCurrency : (org.globalCurrency || "USD");

    await db.batch([
      db.insert(project).values({
        id: projectId,
        name,
        organizationId: orgId,
        createdBy: userId,
        status: "active",
        currency: projectCurrency,
      }),
      db.insert(projectMember).values({
        id: crypto.randomUUID(),
        projectId,
        userId,
        role: "owner",
      }),
      db.insert(projectInvitation).values({
        id: crypto.randomUUID(),
        projectId,
        email: clientEmail,
        token,
        invitedBy: userId,
        status: "pending",
        expiresAt,
      })
    ]);

    const getBaseUrl = () => {
      if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
      if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
      const forwardedHost = reqHeaders.get("x-forwarded-host");
      if (forwardedHost) return `https://${forwardedHost}`;
      const host = reqHeaders.get("host");
      if (host && !host.includes("localhost")) return `https://${host}`;
      return process.env.BASE_URL || "http://localhost:3000";
    };
    const baseUrl = getBaseUrl();
    const inviteLink = `${baseUrl}/invite/${token}`;

    await sendProjectInvitationEmail(
      clientEmail, 
      name, 
      inviteLink,
      org?.plan as "free" | "freelancer" | "agency" | undefined,
      org?.logoUrl
    );

    revalidatePath("/dashboard");
    return NextResponse.json({ success: true, projectId });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = await req.json();

    const patchSchema = z.object({
      projectId: z.string().min(1, "Project ID is required"),
      newName: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["active", "completed"]).optional(),
    });

    const validationResult = patchSchema.safeParse(payload);
    if (!validationResult.success) {
      return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 });
    }

    const { projectId, newName, description, status } = validationResult.data;

    if (newName === undefined && status === undefined && description === undefined) {
      return NextResponse.json({ error: "No update fields provided." }, { status: 400 });
    }

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getProjectAccess(projectId, session.user.id);
    if (!access.proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!access.isAuthorized || !canManageProject(access.role)) {
      return NextResponse.json({ error: "Only the project owner or agency can update the project." }, { status: 403 });
    }

    const updates: Partial<{ name: string; description: string; status: "active" | "completed" | "archived" }> = {};
    if (newName !== undefined && newName.trim() !== '') updates.name = newName.trim();
    if (description !== undefined) updates.description = description.trim();
    if (status && (status === "active" || status === "completed")) updates.status = status;

    await db.update(project).set(updates).where(eq(project.id, projectId));

    revalidatePath("/dashboard");
    revalidatePath(`/projects/${projectId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rename project error:", error);
    return NextResponse.json({ error: "Failed to rename project." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
    }

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getProjectAccess(projectId, session.user.id);
    if (!access.proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (!access.isAuthorized || !canManageProject(access.role)) {
      return NextResponse.json({ error: "Only the project owner or agency can delete the project." }, { status: 403 });
    }

    await db.delete(project).where(eq(project.id, projectId));

    revalidatePath("/dashboard");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json({ error: "Failed to delete project." }, { status: 500 });
  }
}
