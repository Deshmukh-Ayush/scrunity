import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmResearchRun } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { inngest } from "@/inngest/client";
import { scrapeUrl, getFallbackLogoUrl } from "@/lib/firecrawl";
import { z } from "zod";

const createResearchRunSchema = z.object({
  websiteUrl: z.string().min(1, "Website URL is required"),
  companyName: z.string().min(1, "Company name is required"),
  companyDescription: z.string().min(1, "Company description is required"),
  companySize: z.enum(["1-10", "11-50", "51-200", "200+"]),
  contextDoc: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const body = await req.json();
    const parsed = createResearchRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { websiteUrl, companyName, companyDescription, companySize, contextDoc } =
      parsed.data;

    // Fetch logo automatically from site's favicon or og:image (not user-uploaded)
    let logoUrl = getFallbackLogoUrl(websiteUrl);
    try {
      const scraped = await scrapeUrl(websiteUrl);
      if (scraped.ogImage) logoUrl = scraped.ogImage;
      else if (scraped.favicon) logoUrl = scraped.favicon;
    } catch (e) {
      console.warn("Logo auto-fetch skipped:", e);
    }

    // Insert research run row
    const [run] = await db
      .insert(gtmResearchRun)
      .values({
        organizationId: auth.orgId,
        createdBy: auth.userId,
        websiteUrl,
        companyName,
        companyDescription,
        companySize,
        contextDoc: contextDoc || null,
        logoUrl,
        status: "in_progress",
        currentStage: "research_company",
      })
      .returning();

    // Fire Inngest event and return immediately (non-blocking)
    await inngest.send({
      name: "gtm/research.requested",
      data: {
        researchRunId: run.id,
      },
    });

    return NextResponse.json({ success: true, researchRun: run }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/gtm/research-runs] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const runs = await db
      .select()
      .from(gtmResearchRun)
      .where(eq(gtmResearchRun.organizationId, auth.orgId))
      .orderBy(desc(gtmResearchRun.createdAt));

    return NextResponse.json({ success: true, runs });
  } catch (err: any) {
    console.error("[GET /api/gtm/research-runs] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}
