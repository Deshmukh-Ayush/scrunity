import { NextResponse } from "next/server";
import { db } from "@/utils/db";
import { organization } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
// Dodo uses standardwebhooks for verification
import { Webhook } from "standardwebhooks";
import {
  addTopupCredits,
  resetCreditPeriod,
} from "@/lib/gtm-ai-credits";

const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  try {
    const payload = await req.text();
    const headers = {
      "webhook-id": req.headers.get("webhook-id") || "",
      "webhook-signature": req.headers.get("webhook-signature") || "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") || "",
    };

    // Verify webhook signature if secret is configured
    let event: any;
    if (webhookSecret) {
      const wh = new Webhook(webhookSecret);
      try {
        event = wh.verify(payload, headers as any);
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    } else {
      // In dev mode when secret not set
      event = JSON.parse(payload);
    }

    const { type, data } = event;
    const metadata = data?.metadata || {};
    const orgId = metadata.organizationId;

    // 1. Handle one-time top-up credit purchases
    if (metadata.type === "topup" && orgId) {
      const credits = Number(metadata.credits || 100);
      await addTopupCredits(
        orgId,
        credits,
        `Purchased ${credits} AI credits top-up pack (Dodo payment: ${data?.payment_id || data?.id || "direct"})`
      );
      return NextResponse.json({ success: true, handled: "topup" });
    }

    // 2. Handle extra seat add-on purchases
    if (metadata.type === "extra_seat" && orgId) {
      const seats = Number(metadata.seats || 1);
      await db
        .update(organization)
        .set({
          extraSeats: sql`${organization.extraSeats} + ${seats}`,
          updatedAt: new Date(),
        })
        .where(eq(organization.id, orgId));
      return NextResponse.json({ success: true, handled: "extra_seat" });
    }

    // 3. Handle subscription creation, activation, and renewals (Step 1.5 - No rollover)
    if (
      type === "payment.succeeded" ||
      type === "subscription.active" ||
      type === "subscription.renewed"
    ) {
      const plan = metadata.plan;
      const nextBillingDate = data.next_billing_date
        ? new Date(data.next_billing_date)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      if (orgId) {
        const [org] = await db
          .select()
          .from(organization)
          .where(eq(organization.id, orgId));

        const effectivePlan = plan || org?.plan || "pilot";

        await db
          .update(organization)
          .set({
            plan: effectivePlan as any,
            subscriptionStatus: "active",
            dodoCustomerId: data.customer?.customer_id || data.customer_id,
            dodoSubscriptionId: data.subscription_id || data.payment_id,
            currentPeriodEnd: nextBillingDate,
            updatedAt: new Date(),
          })
          .where(eq(organization.id, orgId));

        // On renewal or activation: reset the balance to the plan allotment with NO rollover (Step 1.5)
        await resetCreditPeriod(orgId, effectivePlan, nextBillingDate);
      }
    }

    // 4. Handle dunning / past-due warning
    if (type === "subscription.past_due") {
      const customerId = data.customer?.customer_id || data.customer_id;
      if (customerId) {
        await db
          .update(organization)
          .set({ subscriptionStatus: "past_due", updatedAt: new Date() })
          .where(eq(organization.dodoCustomerId, customerId));
      } else if (orgId) {
        await db
          .update(organization)
          .set({ subscriptionStatus: "past_due", updatedAt: new Date() })
          .where(eq(organization.id, orgId));
      }
    }

    // 5. Handle subscription cancellation / expiration
    if (
      type === "subscription.canceled" ||
      type === "subscription.cancelled" ||
      type === "subscription.expired"
    ) {
      const customerId = data.customer?.customer_id || data.customer_id;
      if (customerId) {
        await db
          .update(organization)
          .set({ subscriptionStatus: "canceled", updatedAt: new Date() })
          .where(eq(organization.dodoCustomerId, customerId));
      } else if (orgId) {
        await db
          .update(organization)
          .set({ subscriptionStatus: "canceled", updatedAt: new Date() })
          .where(eq(organization.id, orgId));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
