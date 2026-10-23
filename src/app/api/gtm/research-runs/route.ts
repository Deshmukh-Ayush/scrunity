import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmResearchRun } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { dispatchResearchRun } from "@/lib/pipeline/dispatch";
import { getFallbackLogoUrl, normalizeWebsiteUrl } from "@/lib/firecrawl";
import { listOrgResearchRuns } from "@/lib/data/research-runs";
import { z } from "zod";
import { hasSpendAccess, noAccessMessage } from "@/lib/pilot/access";
import { QUOTAS, consumeOrgQuota } from "@/lib/org-quota";
import {
  companyProfileInputSchema,
  profileWriteForNewRun,
  researchRunSnapshot,
} from "@/lib/company-profile/input";
import { saveCompanyProfile, saveCompanyProfileIfMissing } from "@/lib/company-profile/store";

// saveToProfile: "Also update my saved profile" was ticked. Without it the
// profile is only created when the organization has none (its first run).
const createResearchRunSchema = companyProfileInputSchema.extend({
  saveToProfile: z.boolean().optional(),
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

    const { saveToProfile, ...input } = parsed.data;
    const websiteUrl = normalizeWebsiteUrl(input.websiteUrl);

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

    // Spend guard: research runs use web search and LLM calls, so they need an
    // active plan or credits, and each organization has a daily run quota.
    if (!(await hasSpendAccess(auth.orgId, auth.userId))) {
      return NextResponse.json({ error: noAccessMessage(), noAccess: true }, { status: 403 });
    }
    const quota = await consumeOrgQuota(auth.orgId, QUOTAS.researchRun);
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.message, quotaExceeded: true }, { status: 429 });
    }

    // High quality favicon without incurring Firecrawl scrape credits before row exists
    const logoUrl = getFallbackLogoUrl(websiteUrl);

    // Insert research run row with its own copy of the details (later profile
    // edits never change it).
    const [run] = await db
      .insert(gtmResearchRun)
      .values({
        organizationId: auth.orgId,
        createdBy: auth.userId,
        ...researchRunSnapshot({ ...input, websiteUrl }),
        logoUrl,
        status: "in_progress",
        currentStage: "research_company",
        stageStartedAt: new Date(),
        lastProgressAt: null,
      })
      .returning();

    // The run has started either way; a profile that didn't save is reported, not fatal.
    let profileSaved = true;
    try {
      if (profileWriteForNewRun(saveToProfile) === "upsert") {
        await saveCompanyProfile(auth.orgId, auth.userId, input);
      } else {
        await saveCompanyProfileIfMissing(auth.orgId, auth.userId, input);
      }
    } catch (profileErr) {
      profileSaved = false;
      console.error("[POST /api/gtm/research-runs] Company profile not saved:", profileErr);
    }

    // Exactly one executor (Inngest or in-process) picks the run up.
    await dispatchResearchRun(run.id);

    return NextResponse.json({ success: true, researchRun: run, profileSaved }, { status: 201 });
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

    const runs = await listOrgResearchRuns(auth.orgId);

    return NextResponse.json({ success: true, runs });
  } catch (err: any) {
    console.error("[GET /api/gtm/research-runs] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}
