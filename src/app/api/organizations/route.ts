import { db } from "@/utils/db";
import { organization, member } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { putBlob } from "@/lib/blob";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    
    const ip = reqHeaders.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = rateLimit(`org_${ip}`, 10, 60 * 1000); // 10 per min
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const action = formData.get("action") || "update_branding";

      if (action === "update_branding" || formData.has("logo")) {
        const orgId = formData.get("orgId") as string;
        const file = formData.get("logo") as File | null;

        if (!orgId) return NextResponse.json({ error: "Org ID is required." }, { status: 400 });

        // Verify user is an owner of this org
        const [userMembership] = await db.select().from(member).where(
          and(
            eq(member.organizationId, orgId),
            eq(member.userId, session.user.id),
            eq(member.role, "owner")
          )
        );

        if (!userMembership) {
          return NextResponse.json({ error: "Only organization owners can update branding." }, { status: 403 });
        }

        const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
        if (!org) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

        let logoUrl = org.logoUrl;

        if (file && file.size > 0) {
          try {
            const blob = await putBlob(`logos/${orgId}-${Date.now()}-${file.name}`, file);
            logoUrl = blob.url;
          } catch (uploadError) {
            console.error("Blob upload error:", uploadError);
            return NextResponse.json({ error: "Failed to upload logo." }, { status: 500 });
          }
        }

        await db.update(organization)
          .set({
            logoUrl: logoUrl,
            updatedAt: new Date(),
          })
          .where(eq(organization.id, orgId));

        revalidatePath("/dashboard/settings");
        revalidatePath("/dashboard");

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: "Invalid form action." }, { status: 400 });
    } 
    // Handle plan / currency updates (application/json)
    else {
      const payload = await req.json();

      const patchSchema = z.object({
        orgId: z.string().min(1, "Organization ID is required"),
        plan: z.enum(["free", "freelancer", "agency", "enterprise"]).optional(),
        globalCurrency: z.enum(["USD", "INR"]).optional(),
      });

      const validationResult = patchSchema.safeParse(payload);
      if (!validationResult.success) {
        return NextResponse.json({ error: validationResult.error.issues[0].message }, { status: 400 });
      }

      const { orgId, plan, globalCurrency } = validationResult.data;

      const [orgMember] = await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)));

      if (!orgMember || orgMember.role !== "owner") {
        return NextResponse.json({ error: "Only organization owners can change settings." }, { status: 403 });
      }

      const updates: { plan?: "free" | "freelancer" | "agency" | "enterprise"; globalCurrency?: "USD" | "INR"; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (plan) updates.plan = plan;
      if (globalCurrency) updates.globalCurrency = globalCurrency;

      await db.update(organization)
        .set(updates)
        .where(eq(organization.id, orgId));

      revalidatePath("/dashboard/settings");
      revalidatePath("/dashboard");

      return NextResponse.json({ success: true });
    }

  } catch (error) {
    console.error("Update organization error:", error);
    return NextResponse.json({ error: "Failed to update organization." }, { status: 500 });
  }
}
