import "server-only"
import { eq, sql } from "drizzle-orm"
import DodoPayments from "dodopayments"
import { db } from "@/utils/db"
import { billingWebhookEvent, organization } from "@/db/schema"
import { addTopupCredits, resetCreditPeriod } from "@/lib/gtm-ai-credits"

/**
 * Dodo Payments webhooks follow Standard Webhooks: HMAC-SHA256 over
 * "{webhook-id}.{webhook-timestamp}.{raw body}" with the base64-decoded
 * `whsec_` secret, sent as "v1,<base64>" in `webhook-signature`, and
 * timestamps more than 5 minutes off are rejected. The SDK's `unwrap` does
 * exactly this (via the `standardwebhooks` package).
 */
export function getDodoWebhookKey(): string | null {
  return process.env.DODO_PAYMENTS_WEBHOOK_KEY || process.env.DODO_PAYMENTS_WEBHOOK_SECRET || null
}

/** The fields of a Dodo payment / subscription payload this handler reads. */
export interface DodoEventData {
  payment_id?: string
  subscription_id?: string
  customer_id?: string
  customer?: { customer_id?: string }
  next_billing_date?: string
  metadata?: Record<string, string | undefined>
}

export interface DodoEvent {
  type: string
  data?: DodoEventData
}

type PlanValue = typeof organization.$inferSelect.plan

/** Verifies the signature on the raw body. Throws if it is missing or invalid. */
export function verifyDodoWebhook(rawBody: string, headers: Headers, key: string): DodoEvent {
  const signatureHeaders = {
    "webhook-id": headers.get("webhook-id") ?? "",
    "webhook-signature": headers.get("webhook-signature") ?? "",
    "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
  }
  // No network call: the client is only used for its local verification helper.
  const dodo = new DodoPayments({ bearerToken: "unused-for-verification", webhookKey: key })
  return dodo.webhooks.unwrap(rawBody, { headers: signatureHeaders, key }) as DodoEvent
}

// ---------------------------------------------------------------------------
// Idempotency ledger (billing_webhook_event, keyed by webhook-id)
// ---------------------------------------------------------------------------

/** Claims an event id. Returns false if this delivery was already claimed. */
export async function claimWebhookEvent(id: string, type: string): Promise<boolean> {
  const claimed = await db
    .insert(billingWebhookEvent)
    .values({ id, type, status: "processing" })
    .onConflictDoNothing({ target: billingWebhookEvent.id })
    .returning({ id: billingWebhookEvent.id })
  return claimed.length > 0
}

export async function finishWebhookEvent(
  id: string,
  status: "processed" | "ignored",
  organizationId: string | null
) {
  await db
    .update(billingWebhookEvent)
    .set({ status, organizationId, processedAt: new Date() })
    .where(eq(billingWebhookEvent.id, id))
}

/** Releases a claim after a failure so Dodo's retry can apply the event. */
export async function releaseWebhookEvent(id: string) {
  await db.delete(billingWebhookEvent).where(eq(billingWebhookEvent.id, id))
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------

/**
 * Handled event types. Everything else is acknowledged and ignored.
 * - payment.succeeded: one-time purchases only (top-up credits, extra seats).
 *   Subscription payments are applied through the subscription events below,
 *   so a renewal resets the credit period once, not twice.
 * - subscription.active / subscription.renewed: set plan, active status, reset credits.
 * - subscription.past_due: mark past due.
 * - subscription.cancelled / subscription.canceled / subscription.expired: mark canceled.
 */
export const HANDLED_EVENT_TYPES = [
  "payment.succeeded",
  "subscription.active",
  "subscription.renewed",
  "subscription.past_due",
  "subscription.cancelled",
  "subscription.canceled",
  "subscription.expired",
] as const

const customerIdOf = (data: DodoEventData) => data.customer?.customer_id ?? data.customer_id ?? null

/** The org named in the payment metadata (set by our checkout), else the stored customer mapping. */
async function resolveOrganization(data: DodoEventData) {
  const metadataOrgId = data.metadata?.organizationId
  if (metadataOrgId) {
    const [org] = await db.select().from(organization).where(eq(organization.id, metadataOrgId))
    if (org) return org
  }
  const customerId = customerIdOf(data)
  if (customerId) {
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.dodoCustomerId, customerId))
    if (org) return org
  }
  return null
}

export type ApplyResult =
  | { outcome: "processed"; organizationId: string; effect: string }
  | { outcome: "ignored"; organizationId: string | null; reason: string }

export async function applyDodoEvent(event: DodoEvent, webhookId: string): Promise<ApplyResult> {
  const type = event.type
  const data = event.data ?? {}
  if (!(HANDLED_EVENT_TYPES as readonly string[]).includes(type)) {
    return { outcome: "ignored", organizationId: null, reason: `unhandled event type ${type}` }
  }

  const org = await resolveOrganization(data)
  if (!org) return { outcome: "ignored", organizationId: null, reason: "no matching organization" }
  const metadata = data.metadata ?? {}

  if (type === "payment.succeeded") {
    if (metadata.type === "topup") {
      const credits = Number(metadata.credits || 100)
      await addTopupCredits(
        org.id,
        credits,
        `Purchased ${credits} AI credits top-up pack (Dodo payment: ${data.payment_id ?? "unknown"}, webhook ${webhookId})`
      )
      return { outcome: "processed", organizationId: org.id, effect: `topup:${credits}` }
    }
    if (metadata.type === "extra_seat") {
      const seats = Number(metadata.seats || 1)
      await db
        .update(organization)
        .set({ extraSeats: sql`${organization.extraSeats} + ${seats}`, updatedAt: new Date() })
        .where(eq(organization.id, org.id))
      return { outcome: "processed", organizationId: org.id, effect: `extra_seat:${seats}` }
    }
    return { outcome: "ignored", organizationId: org.id, reason: "subscription payment (handled by subscription events)" }
  }

  if (type === "subscription.active" || type === "subscription.renewed") {
    const effectivePlan = (metadata.plan || org.plan || "pilot") as PlanValue
    const nextBillingDate = data.next_billing_date
      ? new Date(data.next_billing_date)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await db
      .update(organization)
      .set({
        plan: effectivePlan,
        subscriptionStatus: "active",
        dodoCustomerId: customerIdOf(data) ?? org.dodoCustomerId,
        dodoSubscriptionId: data.subscription_id ?? org.dodoSubscriptionId,
        currentPeriodEnd: nextBillingDate,
        updatedAt: new Date(),
      })
      .where(eq(organization.id, org.id))
    // On activation or renewal: reset the balance to the plan allotment, no rollover.
    await resetCreditPeriod(org.id, effectivePlan, nextBillingDate)
    return { outcome: "processed", organizationId: org.id, effect: `plan:${effectivePlan}` }
  }

  const status = type === "subscription.past_due" ? "past_due" : "canceled"
  await db
    .update(organization)
    .set({ subscriptionStatus: status, updatedAt: new Date() })
    .where(eq(organization.id, org.id))
  return { outcome: "processed", organizationId: org.id, effect: `status:${status}` }
}
