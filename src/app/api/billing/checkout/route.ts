import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-context";
import { headers } from "next/headers";
import DodoPayments from "dodopayments";
import {
  BILLING_CONFIG,
  TOPUP_CONFIG,
  EXTRA_SEAT_CONFIG,
  type PlanTier,
} from "@/config/billing";
import { db } from "@/utils/db";
import { organization } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { addTopupCredits } from "@/lib/gtm-ai-credits";

const environment =
  process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
    ? "live_mode"
    : "test_mode";

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment,
});

export async function POST(req: Request) {
  try {
    const reqHeaders = await headers();
    const { user, organizationId } = await getTenantContext(reqHeaders);

    if (!user || !organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action || (body.plan ? "subscribe" : "unknown");

    const org = await db.query.organization.findFirst({
      where: eq(organization.id, organizationId),
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000");

    // ==========================================
    // Dev Mode Fallback (when Dodo keys are omitted)
    // ==========================================
    const isMock = !process.env.DODO_PAYMENTS_API_KEY;

    if (action === "topup") {
      const quantity = Math.max(1, Number(body.quantity) || 1);
      const creditsToAdd = quantity * TOPUP_CONFIG.credits;

      if (isMock || !TOPUP_CONFIG.priceId) {
        // In local development, credit immediately for seamless developer experience
        await addTopupCredits(
          organizationId,
          creditsToAdd,
          `Local Dev: Top-up ${creditsToAdd} AI credits`
        );
        return NextResponse.json({
          url: `${appUrl}/dashboard/billing?success=true&topup=${creditsToAdd}`,
          devSimulated: true,
        });
      }

      const session = await dodo.checkoutSessions.create({
        billing_address: org.globalCurrency === "INR" ? { country: "IN" } : undefined,
        customer: { email: user.email, name: user.name || "" },
        product_cart: [
          {
            product_id: TOPUP_CONFIG.priceId,
            quantity,
          },
        ],
        return_url: `${appUrl}/dashboard/billing?success=true&topup=${creditsToAdd}`,
        metadata: {
          organizationId,
          type: "topup",
          credits: String(creditsToAdd),
        },
      });

      const url =
        session.checkout_url ||
        (session as any).paymentLink ||
        (session as any).payment_link ||
        (session as any).url;
      return NextResponse.json({ url });
    }

    if (action === "extra_seat") {
      const quantity = Math.max(1, Number(body.quantity) || 1);

      if (isMock || !EXTRA_SEAT_CONFIG.priceId) {
        // In local development, increment extraSeats immediately
        await db
          .update(organization)
          .set({
            extraSeats: sql`${organization.extraSeats} + ${quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(organization.id, organizationId));
        return NextResponse.json({
          url: `${appUrl}/dashboard/billing?success=true&seats_added=${quantity}`,
          devSimulated: true,
        });
      }

      const session = await dodo.checkoutSessions.create({
        billing_address: org.globalCurrency === "INR" ? { country: "IN" } : undefined,
        customer: { email: user.email, name: user.name || "" },
        product_cart: [
          {
            product_id: EXTRA_SEAT_CONFIG.priceId,
            quantity,
          },
        ],
        return_url: `${appUrl}/dashboard/billing?success=true&seats_added=${quantity}`,
        metadata: {
          organizationId,
          type: "extra_seat",
          seats: String(quantity),
        },
      });

      const url =
        session.checkout_url ||
        (session as any).paymentLink ||
        (session as any).payment_link ||
        (session as any).url;
      return NextResponse.json({ url });
    }

    if (action === "subscribe") {
      const plan = (body.plan || "pilot") as PlanTier;
      const planConfig = BILLING_CONFIG[plan];

      if (!planConfig) {
        return NextResponse.json(
          { error: `Unknown plan tier '${plan}'.` },
          { status: 400 }
        );
      }

      if (isMock || !planConfig.priceId) {
        // In local development without configured price IDs, simulate upgrade
        await db
          .update(organization)
          .set({
            plan,
            subscriptionStatus: "active",
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          })
          .where(eq(organization.id, organizationId));

        const { resetCreditPeriod } = await import("@/lib/gtm-ai-credits");
        await resetCreditPeriod(organizationId, plan);

        return NextResponse.json({
          url: `${appUrl}/dashboard/billing?success=true&upgraded=${plan}`,
          devSimulated: true,
        });
      }

      const session = await dodo.checkoutSessions.create({
        billing_address: org.globalCurrency === "INR" ? { country: "IN" } : undefined,
        customer: { email: user.email, name: user.name || "" },
        product_cart: [
          {
            product_id: planConfig.priceId,
            quantity: 1,
          },
        ],
        return_url: `${appUrl}/dashboard/billing?success=true&upgraded=${plan}`,
        metadata: {
          organizationId,
          plan,
        },
      });

      const url =
        session.checkout_url ||
        (session as any).paymentLink ||
        (session as any).payment_link ||
        (session as any).url;
      return NextResponse.json({ url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Checkout error:", error);
    const errorMessage =
      error?.message || error?.error?.message || "Failed to create checkout session";
    return NextResponse.json(
      { error: errorMessage },
      { status: error?.status || 500 }
    );
  }
}
