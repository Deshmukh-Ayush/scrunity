import "server-only"

import DodoPayments from "dodopayments"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { organization } from "@/db/schema"

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
  environment:
    process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
      ? "live_mode"
      : "test_mode",
})

export interface InvoiceItem {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  description?: string
  downloadUrl?: string
}

/**
 * Sample invoices shown when Dodo is not configured or the org has no Dodo
 * customer yet. Kept as-is from the original route; see the cleanup report.
 */
function sampleInvoices(): InvoiceItem[] {
  return [
    {
      id: "inv_test_01",
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
      amount: 349.0,
      currency: "USD",
      status: "succeeded",
      description:
        "Scale Enterprise Platform Annual Subscription & Quota Upgrade (5,000 AI Prospect Credits + 12 Additional Team Seats)",
      downloadUrl: "https://example.com/invoice-01.pdf",
    },
    {
      id: "inv_test_02",
      date: new Date(Date.now() - 86400000 * 32).toISOString(),
      amount: 79.0,
      currency: "USD",
      status: "succeeded",
      description:
        "Starter Plan — 600 Monthly AI Prospect Credits + 2 Workspace Seats",
      downloadUrl: "https://example.com/invoice-02.pdf",
    },
    {
      id: "inv_test_03",
      date: new Date(Date.now() - 86400000 * 62).toISOString(),
      amount: 12.0,
      currency: "USD",
      status: "succeeded",
      description:
        "Top-Up Pack — 100 Instant AI Prospect Credits (No Expiration / No Renewal Shift)",
      downloadUrl: "https://example.com/invoice-03.pdf",
    },
  ]
}

/**
 * Up to 15 recent Dodo payments for the organization, mapped to invoice rows.
 * A Dodo API failure yields an empty list rather than an error.
 */
export async function getBillingInvoices(
  organizationId: string
): Promise<InvoiceItem[]> {
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
  })

  if (!org) return []

  if (!process.env.DODO_PAYMENTS_API_KEY || !org.dodoCustomerId) {
    return sampleInvoices()
  }

  try {
    const response = await dodo.payments.list({
      customer_id: org.dodoCustomerId,
      page_size: 15,
    })

    const rawItems =
      (response as any).items || (response as any).data || response || []
    return (Array.isArray(rawItems) ? rawItems : []).map((p: any) => ({
      id: p.payment_id || p.id,
      date: p.created_at || new Date().toISOString(),
      amount:
        typeof p.total_amount === "number"
          ? p.total_amount / 100
          : p.amount
            ? p.amount / 100
            : 0,
      currency: p.currency || org.globalCurrency || "USD",
      status: p.status || "succeeded",
      description: p.product_cart?.[0]?.product_id || "Scrunity Subscription",
      downloadUrl: p.invoice_url || p.receipt_url || undefined,
    }))
  } catch (apiErr) {
    console.warn("[getBillingInvoices] Dodo payments.list warning:", apiErr)
    return []
  }
}
