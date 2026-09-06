import { db } from "@/utils/db";
import { invoice } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getProjectAccess } from "@/lib/project-auth";
import { getBlobStream } from "@/lib/blob";
import { generateInvoicePdf } from "@/lib/invoices/pdf-generator";
import { InvoiceData } from "@/lib/invoices/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");
    if (!invoiceId) return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const inv = await db.query.invoice.findFirst({
      where: eq(invoice.id, invoiceId),
      with: {
        lineItems: true,
        project: true,
      },
    });

    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const access = await getProjectAccess(inv.projectId, session.user.id);
    if (!access.isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const fileName = `Invoice-${inv.invoiceNumber}.pdf`;

    // 1. If pdfUrl exists, try streaming from Blob
    if (inv.pdfUrl) {
      try {
        const stream = await getBlobStream(inv.pdfUrl);
        return new NextResponse(stream as any, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${fileName}"`,
            "X-Frame-Options": "SAMEORIGIN",
            "Content-Security-Policy": "frame-ancestors 'self'",
          },
        });
      } catch (blobErr) {
        console.warn("Falling back to on-demand PDF generation:", blobErr);
      }
    }

    // 2. Fallback: Generate PDF on demand
    const invoiceData: InvoiceData = {
      id: inv.id,
      projectId: inv.projectId,
      organizationId: inv.organizationId,
      milestoneId: inv.milestoneId,
      invoiceNumber: inv.invoiceNumber,
      prefix: inv.prefix,
      serialNumber: inv.serialNumber,
      currency: inv.currency as "USD" | "INR",
      themeColor: inv.themeColor,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms,
      companySnapshot: inv.companySnapshot as any,
      clientSnapshot: inv.clientSnapshot as any,
      billingDetails: inv.billingDetails as any,
      lineItems: inv.lineItems.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        sortOrder: item.sortOrder,
      })),
      notes: inv.notes,
      additionalTerms: inv.additionalTerms,
      paymentInformation: inv.paymentInformation as any,
      subtotal: inv.subtotal,
      total: inv.total,
      status: inv.status as any,
      sentAt: inv.sentAt,
      viewedAt: inv.viewedAt,
      paidAt: inv.paidAt,
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt,
    };

    const pdfBytes = await generateInvoicePdf(invoiceData);

    return new NextResponse(Buffer.from(pdfBytes) as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    console.error("Invoice PDF download error:", error);
    return NextResponse.json({ error: "Failed to download invoice PDF" }, { status: 500 });
  }
}
