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

  // No Dodo customer (e.g. pilot access granted by an admin): no invoices to show.
  if (!process.env.DODO_PAYMENTS_API_KEY || !org.dodoCustomerId) {
    return []
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
