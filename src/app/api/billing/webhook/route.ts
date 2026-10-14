import { NextResponse } from "next/server";
import {
  applyDodoEvent,
  claimWebhookEvent,
  finishWebhookEvent,
  getDodoWebhookKey,
  releaseWebhookEvent,
  verifyDodoWebhook,
  type DodoEvent,
} from "@/lib/dodo-webhook";

/**
 * Dodo Payments webhook. Exempt from session auth in src/proxy.ts (Dodo sends
 * no cookie); authenticated here by the Standard Webhooks signature on the raw
 * body instead. Each `webhook-id` is applied at most once.
 */
export async function POST(req: Request) {
  const key = getDodoWebhookKey();
  if (!key) {
    console.error("[Dodo webhook] DODO_PAYMENTS_WEBHOOK_KEY is not configured; rejecting.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Raw body: the signature covers the exact bytes Dodo sent.
  const rawBody = await req.text();
  const webhookId = req.headers.get("webhook-id");
  if (!webhookId || !req.headers.get("webhook-signature") || !req.headers.get("webhook-timestamp")) {
    return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 401 });
  }

  let event: DodoEvent;
  try {
    event = verifyDodoWebhook(rawBody, req.headers, key);
  } catch (err) {
    console.warn("[Dodo webhook] Signature verification failed:", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const type = typeof event?.type === "string" ? event.type : "unknown";
  if (!(await claimWebhookEvent(webhookId, type))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const result = await applyDodoEvent(event, webhookId);
    await finishWebhookEvent(webhookId, result.outcome, result.organizationId);
    if (result.outcome === "ignored") {
      console.info(`[Dodo webhook] Ignored ${type} (${webhookId}): ${result.reason}`);
    }
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (err) {
    // Release the claim so Dodo's retry applies the event; nothing was marked done.
    console.error(`[Dodo webhook] Failed to apply ${type} (${webhookId}):`, err);
    await releaseWebhookEvent(webhookId).catch(() => {});
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
