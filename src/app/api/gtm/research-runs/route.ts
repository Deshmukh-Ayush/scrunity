import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmResearchRun } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { inngest } from "@/inngest/client";
import { runFullResearchPipeline } from "@/lib/gtm-pipeline-runner";
import { getFallbackLogoUrl, normalizeWebsiteUrl } from "@/lib/firecrawl";
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

    const {
      websiteUrl: rawWebsiteUrl,
      companyName,
      companyDescription,
      companySize,
      contextDoc,
    } = parsed.data;

    const websiteUrl = normalizeWebsiteUrl(rawWebsiteUrl);

    // Step 1: Idempotency check - if a run for this org & website is already in progress, return it
    const [existingActiveRun] = await db
      .select()
      .from(gtmResearchRun)
      .where(
        and(
          eq(gtmResearchRun.organizationId, auth.orgId),
          eq(gtmResearchRun.websiteUrl, websiteUrl),
          eq(gtmResearchRun.status, "in_progress")
        )
      )
      .limit(1);

    if (existingActiveRun) {
      console.log(
        `[POST /api/gtm/research-runs] Duplicate execution prevented: run ${existingActiveRun.id} already in progress.`
      );
      return NextResponse.json(
        {
          success: true,
          researchRun: existingActiveRun,
          duplicatePrevented: true,
          message: "A research run for this website is already in progress.",
        },
        { status: 200 }
      );
    }

    // High quality favicon without incurring Firecrawl scrape credits before row exists
    const logoUrl = getFallbackLogoUrl(websiteUrl);

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

    // Fire Inngest event (non-blocking)
    try {
      await inngest.send({
        name: "gtm/research.requested",
        data: {
          researchRunId: run.id,
        },
      });
    } catch (inngestErr) {
      console.warn("[POST /api/gtm/research-runs] inngest.send notice:", inngestErr);
    }

    // Direct background execution guarantees completion in all environments
    setImmediate(() => {
      runFullResearchPipeline(run.id).catch((err) => {
        console.error("[POST /api/gtm/research-runs] Background pipeline error:", err);
      });
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
