/**
 * Verifies the Dodo Payments webhook against `npm run dev` with locally signed
 * payloads and a TEST secret. No call is made to Dodo.
 *
 *   # start the dev server with the same test secret, e.g.
 *   #   DODO_PAYMENTS_WEBHOOK_KEY=whsec_<random base64> npm run dev
 *   DODO_PAYMENTS_WEBHOOK_KEY=whsec_<same> npx tsx scripts/test-dodo-webhook.ts
 *
 * Creates a throwaway organization and deletes it (and its ledger rows) at the end.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { Webhook } from "standardwebhooks"
import { db } from "../src/utils/db"
import {
  billingWebhookEvent,
  gtmAiCreditPeriod,
  gtmAiCreditTransaction,
  organization,
} from "../src/db/schema"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY
if (!secret?.startsWith("whsec_")) throw new Error("Set DODO_PAYMENTS_WEBHOOK_KEY to the dev server's test secret")
const signer = new Webhook(secret)
const tag = crypto.randomBytes(4).toString("hex")
const orgId = `webhook-test-org-${tag}`
const customerId = `cus_test_${tag}`
const sentIds: string[] = []

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

function signed(event: object, opts: { id?: string; at?: Date; path?: string } = {}) {
  const id = opts.id ?? `msg_test_${crypto.randomBytes(6).toString("hex")}`
  sentIds.push(id)
  const at = opts.at ?? new Date()
  const body = JSON.stringify(event)
  return {
    id,
    send: () =>
      fetch(`${BASE_URL}${opts.path ?? "/api/billing/webhook"}`, {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/json",
          "webhook-id": id,
          "webhook-timestamp": String(Math.floor(at.getTime() / 1000)),
          "webhook-signature": signer.sign(id, at, body),
        },
        body,
      }),
  }
}

async function topupState() {
  const tx = await db
    .select({ amount: gtmAiCreditTransaction.amount, type: gtmAiCreditTransaction.type })
    .from(gtmAiCreditTransaction)
    .where(eq(gtmAiCreditTransaction.organizationId, orgId))
  const periods = await db
    .select({ id: gtmAiCreditPeriod.id, remaining: gtmAiCreditPeriod.creditsRemaining })
    .from(gtmAiCreditPeriod)
    .where(eq(gtmAiCreditPeriod.organizationId, orgId))
  return {
    topups: tx.filter((t) => t.type === "topup").length,
    periods: periods.length,
    remaining: periods.reduce((n, p) => Math.max(n, p.remaining), 0),
  }
}

const topupEvent = (type: string) => ({
  business_id: "bus_test",
  type,
  timestamp: new Date().toISOString(),
  data: {
    payment_id: `pay_test_${tag}`,
    customer: { customer_id: customerId },
    metadata: { organizationId: orgId, type: "topup", credits: "100" },
  },
})

async function main() {
  await db.insert(organization).values({ id: orgId, name: "Webhook Test Org", slug: `webhook-test-${tag}`, dodoCustomerId: customerId })

  console.log("\n1. Rejections")
  const noHeaders = await fetch(`${BASE_URL}/api/billing/webhook`, { method: "POST", body: JSON.stringify(topupEvent("payment.succeeded")) })
  check("no signature headers -> 401 (and no session cookie needed to reach the route)", noHeaders.status === 401, `${noHeaders.status}`)

  const body = JSON.stringify(topupEvent("payment.succeeded"))
  const forged = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "webhook-id": "msg_forged",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": new Webhook(`whsec_${crypto.randomBytes(24).toString("base64")}`).sign("msg_forged", new Date(), body),
    },
    body,
  })
  check("signature from a different secret -> 401", forged.status === 401, `${forged.status}`)

  // Valid headers for `body`, but different bytes sent: the signature must not match.
  const signedAt = new Date()
  const tampered = await fetch(`${BASE_URL}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "webhook-id": "msg_tampered",
      "webhook-timestamp": String(Math.floor(signedAt.getTime() / 1000)),
      "webhook-signature": signer.sign("msg_tampered", signedAt, body),
    },
    body: body.replace('"100"', '"100000"'),
  })
  check("body changed after signing -> 401", tampered.status === 401, `${tampered.status}`)

  const stale = await signed(topupEvent("payment.succeeded"), { at: new Date(Date.now() - 10 * 60 * 1000) }).send()
  check("correctly signed but 10 minutes old -> 401", stale.status === 401, `${stale.status}`)
  check("no rejected request changed credits", (await topupState()).topups === 0)

  console.log("\n2. Valid top-up, then the same delivery retried")
  const delivery = signed(topupEvent("payment.succeeded"))
  const first = await delivery.send()
  const firstBody = await first.json()
  const afterFirst = await topupState()
  check("valid signature -> 200 processed", first.status === 200 && firstBody.outcome === "processed", `${first.status} ${JSON.stringify(firstBody)}`)
  check("one top-up applied", afterFirst.topups === 1, JSON.stringify(afterFirst))
  const retry = await delivery.send()
  const retryBody = await retry.json()
  const afterRetry = await topupState()
  check("retry of the same webhook-id -> 200 duplicate", retry.status === 200 && retryBody.duplicate === true, JSON.stringify(retryBody))
  check("still exactly one top-up, same balance", afterRetry.topups === 1 && afterRetry.remaining === afterFirst.remaining, JSON.stringify(afterRetry))
  const viaAlias = await signed(topupEvent("payment.succeeded"), { id: delivery.id, path: "/api/webhooks/dodo" }).send()
  check("same webhook-id via the /api/webhooks/dodo alias -> duplicate", viaAlias.status === 200 && (await viaAlias.json()).duplicate === true)

  console.log("\n3. Events that must have no effect")
  const failed = await signed(topupEvent("payment.failed")).send()
  check("payment.failed with top-up metadata -> 200 ignored", failed.status === 200 && (await failed.json()).outcome === "ignored")
  const unknown = await signed({ type: "dispute.opened", data: { metadata: { organizationId: orgId } } }).send()
  check("unknown event type -> 200 ignored", unknown.status === 200 && (await unknown.json()).outcome === "ignored")
  check("top-ups unchanged", (await topupState()).topups === 1)

  console.log("\n4. Subscription activation found by the stored customer mapping (no org in metadata)")
  const activation = signed({
    type: "subscription.active",
    data: { subscription_id: `sub_test_${tag}`, customer: { customer_id: customerId }, metadata: { plan: "starter" }, next_billing_date: new Date(Date.now() + 30 * 864e5).toISOString() },
  })
  const act1 = await activation.send()
  const periodsAfterFirst = (await topupState()).periods
  const act2 = await activation.send()
  const [org] = await db.select().from(organization).where(eq(organization.id, orgId))
  check("activation processed", act1.status === 200 && (await act1.json()).outcome === "processed")
  check("org plan and status updated", org.plan === "starter" && org.subscriptionStatus === "active", `${org.plan}/${org.subscriptionStatus}`)
  check("retried activation is a duplicate and creates no extra credit period", act2.status === 200 && (await act2.json()).duplicate === true && (await topupState()).periods === periodsAfterFirst)

  console.log("\n5. Exemption is exact; every other API route still needs a session")
  for (const path of ["/api/gtm/campaigns", "/api/billing/usage", "/api/billing/checkout", "/api/billing/webhookx", "/api/onboarding"]) {
    const res = await fetch(`${BASE_URL}${path}`, { method: path.endsWith("usage") || path.endsWith("campaigns") ? "GET" : "POST", redirect: "manual" })
    check(`${path} without a session -> 401`, res.status === 401, `${res.status}`)
  }

  const ledger = await db.select().from(billingWebhookEvent).where(inArray(billingWebhookEvent.id, sentIds))
  console.log("\nLedger rows:", ledger.map((r) => `${r.type}:${r.status}`).join(", "))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.delete(organization).where(eq(organization.id, orgId))
    if (sentIds.length) await db.delete(billingWebhookEvent).where(inArray(billingWebhookEvent.id, sentIds))
    console.log("Cleaned up test org and ledger rows.")
  })
