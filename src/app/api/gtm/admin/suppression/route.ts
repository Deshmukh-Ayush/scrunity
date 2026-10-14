import { NextRequest, NextResponse } from "next/server";
import { db } from "@/utils/db";
import { gtmSuppressionEntry } from "@/db/schema";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { eq, and, sql, desc } from "drizzle-orm";
import { normalizeEmail, normalizeDomain } from "@/lib/gtm-suppression";

/**
 * Internal Admin Inspection Endpoint for Platform-Wide Suppression Table.
 * Gated to platform admins (PLATFORM_ADMIN_EMAILS); org owners are customers and must not see it.
 * Strictly internal — not exposed to regular customer-facing navigation or APIs.
 */
export async function GET(req: NextRequest) {
  try {
    // Platform-wide data across every customer: platform admins only, 404 otherwise.
    if (!(await getPlatformAdmin(req.headers))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const domain = searchParams.get("domain");
    const reason = searchParams.get("reason");
    const isRealSendBounce = searchParams.get("isRealSendBounce");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50));

    const conditions = [];

    if (email && email.trim()) {
      const normEmail = normalizeEmail(email);
      conditions.push(sql`LOWER(${gtmSuppressionEntry.email}) LIKE ${`%${normEmail}%`}`);
    }

    if (domain && domain.trim()) {
      const normDomain = normalizeDomain(domain);
      conditions.push(sql`LOWER(${gtmSuppressionEntry.domain}) LIKE ${`%${normDomain}%`}`);
    }

    if (reason && reason.trim()) {
      conditions.push(eq(gtmSuppressionEntry.reason, reason as any));
    }

    if (isRealSendBounce !== null && isRealSendBounce !== undefined && isRealSendBounce !== "") {
      conditions.push(eq(gtmSuppressionEntry.isRealSendBounce, isRealSendBounce === "true"));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gtmSuppressionEntry)
      .where(whereClause);

    const total = Number(countResult?.count || 0);
    const offset = (page - 1) * pageSize;

    const entries = await db
      .select()
      .from(gtmSuppressionEntry)
      .where(whereClause)
      .orderBy(desc(gtmSuppressionEntry.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json({
      success: true,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      entries,
    });
  } catch (err: any) {
    console.error("[GET /api/gtm/admin/suppression] Internal error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}
