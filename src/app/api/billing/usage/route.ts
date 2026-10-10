import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getTenantContext } from "@/lib/tenant-context";
import { getCreditUsageAnalytics } from "@/lib/gtm-ai-credits";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { user, organizationId } = await getTenantContext(reqHeaders);

    if (!user || !organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get("range") || "daily";
    const range = (["daily", "weekly", "monthly"].includes(rangeParam)
      ? rangeParam
      : "daily") as "daily" | "weekly" | "monthly";

    const data = await getCreditUsageAnalytics(organizationId, range);

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("[GET /api/billing/usage] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load usage data" },
      { status: 500 }
    );
  }
}
