import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { getTenantContext } from "@/lib/tenant-context"
import { getBillingInvoices } from "@/lib/data/billing"

export async function GET() {
  try {
    const reqHeaders = await headers()
    const { user, organizationId } = await getTenantContext(reqHeaders)

    if (!user || !organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoices = await getBillingInvoices(organizationId)
    return NextResponse.json({ invoices })
  } catch (err: any) {
    console.error("[GET /api/billing/invoices] Error:", err)
    return NextResponse.json(
      { error: err?.message || "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}
