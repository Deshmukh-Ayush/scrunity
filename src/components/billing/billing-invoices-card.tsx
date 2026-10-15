import { Receipt, Download } from "lucide-react"
import { Card, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getTenantContext } from "@/lib/tenant-context"
import { getBillingInvoices } from "@/lib/data/billing"
import { LocalDate } from "@/components/ui/local-date"
import { ManagePortalButton } from "./manage-portal-button"

/** Payment history from Dodo, rendered on the server. */
export async function BillingInvoicesCard() {
  const { organizationId } = await getTenantContext()
  const invoices = organizationId ? await getBillingInvoices(organizationId) : []

  return (
    <Card className="space-y-4 border-border/70 p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CardTitle className="text-base font-semibold break-words">
              Invoice & Payment History
            </CardTitle>
          </div>
          <CardDescription className="mt-0.5 text-xs break-words text-muted-foreground">
            Past billing statements and payment receipts issued by Dodo Payments
          </CardDescription>
        </div>
        <div className="shrink-0">
          <ManagePortalButton />
        </div>
      </div>

      <CardContent className="p-0">
        {invoices.length === 0 ? (
          <div className="rounded-lg border border-border/40 bg-muted/20 py-8 text-center text-xs text-muted-foreground">
            No payments through Dodo yet. Invoices for card payments will appear here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/50">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="border-b border-border/50 bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Invoice Date</th>
                    <th className="px-3 py-2.5 font-medium">Description</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Amount</th>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invoices.map((inv) => {
                    const desc = inv.description || "Scrunity Platform"
                    const isPaid = inv.status === "succeeded" || inv.status === "paid"

                    return (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          <LocalDate
                            value={inv.date}
                            locale="en-US"
                            options={{ month: "short", day: "numeric", year: "numeric" }}
                          />
                        </td>
                        <td
                          className="min-w-[200px] px-3 py-2.5 font-medium break-words text-foreground"
                          title={desc}
                        >
                          {desc}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge
                            data-paid={isPaid || undefined}
                            className="h-4 bg-muted text-muted-foreground data-[paid]:border-success-border data-[paid]:bg-success-tint data-[paid]:text-success">
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                          ${inv.amount.toFixed(2)} {inv.currency}
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {inv.downloadUrl ? (
                            <a
                              href={inv.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <Download className="h-3 w-3" />
                              PDF
                            </a>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
