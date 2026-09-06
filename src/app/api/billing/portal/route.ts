import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { headers } from "next/headers";
import DodoPayments from "dodopayments";
import { db } from "@/utils/db";
import { organization } from "@/db/schema";
import { eq } from "drizzle-orm";

const environment =
  process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "live_mode"
    : "test_mode";

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment,
});

export async function POST() {
  try {
    const reqHeaders = await headers();
    const { user, organizationId } = await getTenantContext(reqHeaders);

    if (!user || !organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await db.query.organization.findFirst({
      where: eq(organization.id, organizationId),
    });

    if (!org || !org.dodoCustomerId) {
      return NextResponse.json({ error: "No billing profile found" }, { status: 404 });
    }

    // Attempt to generate a customer portal link
    // The SDK method name might vary slightly (e.g. customerPortalLinks, portalSessions)
    // We try the common patterns
    let url = "";
    try {
      // Current standard for Dodo
      const session = await (dodo as any).customerPortalSessions?.create({
        customer_id: org.dodoCustomerId,
      }) || await (dodo as any).customers?.createPortalSession({
        customerId: org.dodoCustomerId
      });
      url = session?.url || session?.portal_url;
    } catch (e) {
      console.warn("Could not generate portal session automatically, falling back:", e);
      // Fallback: If there's no native SDK method exposed yet, provide the Dodo URL
      url = `https://checkout.dodopayments.com/p/${org.dodoCustomerId}`;
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json({ error: "Failed to load portal" }, { status: 500 });
  }
}
