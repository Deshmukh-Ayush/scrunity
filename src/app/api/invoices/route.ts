import { db } from "@/utils/db";
import {
  invoice,
  invoiceLineItem,
  invoiceDefaults,
  projectMember,
  projectInvitation,
  user as userTable,
  contractScopeTerm,
  paymentMilestone,
  payment,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getProjectAccess, canManageProject } from "@/lib/project-auth";
import { putBlob } from "@/lib/blob";
import { generateInvoicePdf } from "@/lib/invoices/pdf-generator";
import { calculateInvoiceTotals, InvoiceData } from "@/lib/invoices/types";
import { createNotification } from "@/lib/notifications";
import { sendInvoiceEmail } from "@/lib/email";
import { getUsdToInrRate } from "@/lib/currency";
import { logActivity } from "@/lib/activity";
import crypto from "crypto";
import { z } from "zod";

const customFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

const billingDetailSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["fixed", "percentage"]),
  value: z.number(),
});

const lineItemSchema = z.object({
  id: z.string().optional(),
  itemName: z.string().min(1, "Item name is required"),
  description: z.string().optional().nullable(),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0),
  lineTotal: z.number().min(0).optional(),
});

const invoicePayloadSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  milestoneId: z.string().optional().nullable(),
  prefix: z.string().min(1).default("INV-"),
  serialNumber: z.number().int().min(1),
  currency: z.enum(["USD", "INR"]).default("INR"),
  themeColor: z.string().default("#00AAF7"),
  invoiceDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  paymentTerms: z.string().optional().nullable(),
  companySnapshot: z.object({
    name: z.string().min(1, "Company name is required"),
    logoUrl: z.string().optional().nullable(),
    signatureUrl: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    customFields: z.array(customFieldSchema).optional().default([]),
  }),
  clientSnapshot: z.object({
    name: z.string().min(1, "Client name is required"),
    address: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    contactMethod: z.enum(["email", "phone"]).optional().default("email"),
    customFields: z.array(customFieldSchema).optional().default([]),
  }),
  billingDetails: z.array(billingDetailSchema).default([]),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
  notes: z.string().optional().nullable(),
  additionalTerms: z.string().optional().nullable(),
  paymentInformation: z.array(customFieldSchema).default([]),
  action: z.enum(["save_draft", "send"]).default("save_draft"),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");
    const projectId = searchParams.get("projectId");
    const getDefaults = searchParams.get("getDefaults");

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Return Invoice Defaults & Prefill Context for a project
    if (getDefaults && projectId) {
      const access = await getProjectAccess(projectId, session.user.id);
      if (!access.isAuthorized || !access.proj) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const orgId = access.proj.organizationId;
      const [defaults, clientMembers, clientInvites, paymentTerms, projectMilestones] = await Promise.all([
        orgId ? db.query.invoiceDefaults.findFirst({ where: eq(invoiceDefaults.organizationId, orgId) }) : null,
        db
          .select({
            id: userTable.id,
            name: userTable.name,
            email: userTable.email,
            image: userTable.image,
          })
          .from(projectMember)
          .innerJoin(userTable, eq(projectMember.userId, userTable.id))
          .where(and(eq(projectMember.projectId, projectId), eq(projectMember.role, "client"))),
        db
          .select({ email: projectInvitation.email })
          .from(projectInvitation)
          .where(and(eq(projectInvitation.projectId, projectId), eq(projectInvitation.role, "client"))),
        db
          .select()
          .from(contractScopeTerm)
          .where(and(eq(contractScopeTerm.projectId, projectId), eq(contractScopeTerm.termType, "payment_term"))),
        db
          .select()
          .from(paymentMilestone)
          .where(eq(paymentMilestone.projectId, projectId))
          .orderBy(desc(paymentMilestone.createdAt)),
      ]);

      const clientName = clientMembers[0]?.name || "Client";
      const clientEmail = clientMembers[0]?.email || clientInvites[0]?.email || "";
      const defaultTerms = paymentTerms.map((t) => t.description || t.title).join("\n") || defaults?.defaultTerms || "";

      return NextResponse.json({
        success: true,
        defaults: {
          defaultPrefix: defaults?.defaultPrefix || "INV-",
          nextSerial: defaults?.nextSerial || 1,
          companyName: defaults?.companyName || "",
          companyAddress: defaults?.companyAddress || "",
          companyEmail: defaults?.companyEmail || "",
          companyPhone: defaults?.companyPhone || "",
          logoUrl: defaults?.logoUrl || null,
          signatureUrl: defaults?.signatureUrl || null,
          defaultPaymentInfo: defaults?.defaultPaymentInfo || [
            { id: crypto.randomUUID(), label: "Bank Name", value: "Silicon Valley Bank" },
            { id: crypto.randomUUID(), label: "Account No", value: "•••• 8920" },
            { id: crypto.randomUUID(), label: "SWIFT / IFSC", value: "SVBKUS6S" },
          ],
          defaultNotes: defaults?.defaultNotes || "Thank you for your business. Please reach out if you have any questions regarding this invoice.",
          defaultTerms: defaultTerms,
          defaultCustomFields: defaults?.defaultCustomFields || [],
        },
        clientPrefill: {
          name: clientName,
          email: clientEmail,
          phone: "",
          address: "",
          contactMethod: "email",
        },
        milestones: projectMilestones.map((m) => ({
          id: m.id,
          title: m.title,
          amount: m.amount,
          currency: m.currency,
          dueDate: m.dueDate,
          status: m.status,
        })),
      });
    }

    // 2. Fetch single invoice
    if (invoiceId) {
      const inv = await db.query.invoice.findFirst({
        where: eq(invoice.id, invoiceId),
        with: {
          lineItems: true,
          milestone: true,
          project: true,
          organization: true,
        },
      });

      if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      const access = await getProjectAccess(inv.projectId, session.user.id);
      if (!access.isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      // Auto-update to viewed if client opens it for the first time
      if (access.role === "client" && inv.status === "sent") {
        await db.update(invoice).set({ status: "viewed", viewedAt: new Date() }).where(eq(invoice.id, inv.id));
        inv.status = "viewed";
      }

      return NextResponse.json({ success: true, invoice: inv });
    }

    // 3. Fetch all invoices for a project
    if (projectId) {
      const access = await getProjectAccess(projectId, session.user.id);
      if (!access.isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const invoices = await db.query.invoice.findMany({
        where: eq(invoice.projectId, projectId),
        with: {
          lineItems: true,
          milestone: true,
        },
        orderBy: (inv, { desc }) => [desc(inv.createdAt)],
      });

      return NextResponse.json({ success: true, invoices });
    }

    return NextResponse.json({ error: "Missing query parameters" }, { status: 400 });
  } catch (error) {
    console.error("GET invoice error:", error);
    return NextResponse.json({ error: "Failed to fetch invoice data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawPayload = await req.json();
    const parseResult = invoicePayloadSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const data = parseResult.data;
    const access = await getProjectAccess(data.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role) || !access.proj) {
      return NextResponse.json({ error: "Only project owners and agencies can create invoices" }, { status: 403 });
    }

    const organizationId = access.proj.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "Project has no linked organization" }, { status: 400 });
    }

    const cleanPrefix = data.prefix.trim() || "INV-";
    const formattedSerial = String(data.serialNumber).padStart(3, "0");
    const invoiceNumber = `${cleanPrefix}${formattedSerial}`;

    // Validate Unique Invoice Number per Organization (Step 5)
    const [existingInv] = await db
      .select({ id: invoice.id })
      .from(invoice)
      .where(and(eq(invoice.organizationId, organizationId), eq(invoice.invoiceNumber, invoiceNumber)));

    if (existingInv) {
      return NextResponse.json(
        { error: `Invoice number "${invoiceNumber}" already exists in this workspace. Please choose a different serial number or prefix.` },
        { status: 409 }
      );
    }

    // Compute Totals
    const itemsForCalc = data.lineItems.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
    const totals = calculateInvoiceTotals(itemsForCalc, data.billingDetails);

    const invoiceId = crypto.randomUUID();
    const isSending = data.action === "send";
    const now = new Date();

    const invoiceRecordData: InvoiceData = {
      id: invoiceId,
      projectId: data.projectId,
      organizationId,
      milestoneId: data.milestoneId || null,
      invoiceNumber,
      prefix: cleanPrefix,
      serialNumber: data.serialNumber,
      currency: (access.proj.currency as "USD" | "INR") || data.currency || "USD",
      themeColor: data.themeColor,
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      paymentTerms: data.paymentTerms || null,
      companySnapshot: data.companySnapshot,
      clientSnapshot: data.clientSnapshot,
      billingDetails: data.billingDetails,
      lineItems: data.lineItems.map((item, idx) => ({
        id: item.id || crypto.randomUUID(),
        itemName: item.itemName,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice,
        sortOrder: idx,
      })),
      notes: data.notes || null,
      additionalTerms: data.additionalTerms || null,
      paymentInformation: data.paymentInformation,
      subtotal: totals.subtotal,
      total: totals.total,
      status: isSending ? "sent" : "draft",
      sentAt: isSending ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    // Generate and upload PDF to Vercel Blob
    let pdfUrl: string | null = null;
    try {
      const pdfBytes = await generateInvoicePdf(invoiceRecordData);
      const blob = await putBlob(
        `invoices/${data.projectId}/${invoiceId}/${invoiceNumber}.pdf`,
        Buffer.from(pdfBytes),
        {
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/pdf",
        }
      );
      pdfUrl = blob.url;
      invoiceRecordData.pdfUrl = pdfUrl;
    } catch (pdfErr) {
      console.error("PDF generation notice:", pdfErr);
    }

    // Insert Invoice and Line Items
    const lineItemRows = invoiceRecordData.lineItems.map((item) => ({
      id: item.id!,
      invoiceId,
      itemName: item.itemName,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      sortOrder: item.sortOrder || 0,
      createdAt: now,
    }));

    await db.batch([
      db.insert(invoice).values({
        id: invoiceId,
        projectId: data.projectId,
        organizationId,
        milestoneId: data.milestoneId || null,
        invoiceNumber,
        prefix: cleanPrefix,
        serialNumber: data.serialNumber,
        currency: data.currency,
        themeColor: data.themeColor,
        invoiceDate: new Date(data.invoiceDate),
        dueDate: new Date(data.dueDate),
        paymentTerms: data.paymentTerms || null,
        companySnapshot: data.companySnapshot,
        clientSnapshot: data.clientSnapshot,
        billingDetails: data.billingDetails,
        notes: data.notes || null,
        additionalTerms: data.additionalTerms || null,
        paymentInformation: data.paymentInformation,
        subtotal: totals.subtotal,
        total: totals.total,
        status: isSending ? "sent" : "draft",
        sentAt: isSending ? now : null,
        pdfUrl,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(invoiceLineItem).values(lineItemRows),
    ]);

    // Upsert Organization Invoice Defaults & Increment Next Serial
    try {
      const [existingDefaults] = await db
        .select()
        .from(invoiceDefaults)
        .where(eq(invoiceDefaults.organizationId, organizationId));

      const nextSerial = Math.max(existingDefaults?.nextSerial || 1, data.serialNumber + 1);

      if (existingDefaults) {
        await db
          .update(invoiceDefaults)
          .set({
            defaultPrefix: cleanPrefix,
            nextSerial,
            companyName: data.companySnapshot.name,
            companyAddress: data.companySnapshot.address,
            companyEmail: data.companySnapshot.email,
            companyPhone: data.companySnapshot.phone,
            logoUrl: data.companySnapshot.logoUrl,
            signatureUrl: data.companySnapshot.signatureUrl,
            defaultPaymentInfo: data.paymentInformation,
            defaultNotes: data.notes,
            defaultTerms: data.paymentTerms,
            defaultCustomFields: data.companySnapshot.customFields,
            updatedAt: now,
          })
          .where(eq(invoiceDefaults.organizationId, organizationId));
      } else {
        await db.insert(invoiceDefaults).values({
          id: crypto.randomUUID(),
          organizationId,
          defaultPrefix: cleanPrefix,
          nextSerial,
          companyName: data.companySnapshot.name,
          companyAddress: data.companySnapshot.address,
          companyEmail: data.companySnapshot.email,
          companyPhone: data.companySnapshot.phone,
          logoUrl: data.companySnapshot.logoUrl,
          signatureUrl: data.companySnapshot.signatureUrl,
          defaultPaymentInfo: data.paymentInformation,
          defaultNotes: data.notes,
          defaultTerms: data.paymentTerms,
          defaultCustomFields: data.companySnapshot.customFields,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (defaultsErr) {
      console.error("Failed to update invoice defaults:", defaultsErr);
    }

    // If Sent: Trigger Notifications and Email
    if (isSending) {
      await logActivity({
        projectId: data.projectId,
        userId: session.user.id,
        type: "invoice_sent",
        metadata: {
          invoiceId,
          invoiceNumber,
          total: totals.total,
          currency: data.currency,
        },
      });

      // Find client recipients
      const clientMembers = await db
        .select({ id: userTable.id, email: userTable.email })
        .from(projectMember)
        .innerJoin(userTable, eq(projectMember.userId, userTable.id))
        .where(and(eq(projectMember.projectId, data.projectId), eq(projectMember.role, "client")));

      const clientEmail = data.clientSnapshot.email || clientMembers[0]?.email;
      const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/projects/${data.projectId}/payments?invoiceId=${invoiceId}`;

      for (const cm of clientMembers) {
        await createNotification(
          cm.id,
          data.projectId,
          "invoice_sent",
          `Invoice ${invoiceNumber} for ${access.proj.name} has been sent.`
        );
      }

      if (clientEmail) {
        await sendInvoiceEmail(
          clientEmail,
          access.proj.name,
          invoiceNumber,
          totals.total,
          data.currency,
          new Date(data.dueDate),
          invoiceUrl,
          access.proj.organizationId ? "free" : "free",
          data.companySnapshot.logoUrl
        );
      }
    }

    revalidatePath(`/projects/${data.projectId}`);
    revalidatePath(`/projects/${data.projectId}/payments`);
    return NextResponse.json({ success: true, invoiceId, invoiceNumber, pdfUrl });
  } catch (error) {
    console.error("POST invoice error:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await req.json();
    const { invoiceId, action } = payload;

    if (!invoiceId || !action) {
      return NextResponse.json({ error: "invoiceId and action are required" }, { status: 400 });
    }

    const [inv] = await db.select().from(invoice).where(eq(invoice.id, invoiceId));
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const access = await getProjectAccess(inv.projectId, session.user.id);
    if (!access.isAuthorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();

    // Action: Mark Paid
    if (action === "mark_paid") {
      if (!canManageProject(access.role)) {
        return NextResponse.json({ error: "Forbidden: Only agency managers can record invoice payments." }, { status: 403 });
      }

      await db.update(invoice).set({ status: "paid", paidAt: now, updatedAt: now }).where(eq(invoice.id, invoiceId));

      // Synchronize linked milestone and record auditable payment row
      const paymentMethod = typeof payload.paymentMethod === "string" ? payload.paymentMethod : "bank_transfer";
      const referenceNote = typeof payload.referenceNote === "string"
        ? payload.referenceNote
        : `Paid via Invoice ${inv.invoiceNumber}`;

      const newPaymentId = crypto.randomUUID();
      const liveFxRate = await getUsdToInrRate();
      let milestoneTitle = `Invoice ${inv.invoiceNumber}`;

      if (inv.milestoneId) {
        const [milestone] = await db
          .select()
          .from(paymentMilestone)
          .where(eq(paymentMilestone.id, inv.milestoneId));

        if (milestone) {
          milestoneTitle = milestone.title;
          if (milestone.status !== "paid") {
            await db
              .update(paymentMilestone)
              .set({ status: "paid", updatedAt: now })
              .where(eq(paymentMilestone.id, inv.milestoneId));
          }
        }
      }

      await db.insert(payment).values({
        id: newPaymentId,
        milestoneId: inv.milestoneId || null,
        invoiceId: inv.id,
        projectId: inv.projectId,
        amount: inv.total,
        currency: inv.currency,
        paymentMethod,
        referenceNote,
        fxRateAtPayment: liveFxRate.toFixed(4),
        status: "succeeded",
        paidAt: now,
      });

      await logActivity({
        projectId: inv.projectId,
        userId: session.user.id,
        type: "payment_completed",
        metadata: {
          milestoneTitle,
          amount: inv.total,
          currency: inv.currency,
          paymentMethod,
          referenceNote,
          invoiceNumber: inv.invoiceNumber,
        },
      });

      await logActivity({
        projectId: inv.projectId,
        userId: session.user.id,
        type: "invoice_paid",
        metadata: { invoiceNumber: inv.invoiceNumber, amount: inv.total, currency: inv.currency },
      });

      revalidatePath(`/projects/${inv.projectId}`);
      revalidatePath(`/projects/${inv.projectId}/payments`);
      return NextResponse.json({ success: true });
    }

    // Action: Send Draft Invoice
    if (action === "send") {
      if (!canManageProject(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      await db.update(invoice).set({ status: "sent", sentAt: now, updatedAt: now }).where(eq(invoice.id, invoiceId));

      await logActivity({
        projectId: inv.projectId,
        userId: session.user.id,
        type: "invoice_sent",
        metadata: { invoiceNumber: inv.invoiceNumber, total: inv.total, currency: inv.currency },
      });

      const clientMembers = await db
        .select({ id: userTable.id, email: userTable.email })
        .from(projectMember)
        .innerJoin(userTable, eq(projectMember.userId, userTable.id))
        .where(and(eq(projectMember.projectId, inv.projectId), eq(projectMember.role, "client")));

      for (const cm of clientMembers) {
        await createNotification(
          cm.id,
          inv.projectId,
          "invoice_sent",
          `Invoice ${inv.invoiceNumber} has been sent.`
        );
      }

      const clientSnapshot = inv.clientSnapshot as any;
      const clientEmail = clientSnapshot?.email || clientMembers[0]?.email;
      const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/projects/${inv.projectId}/payments?invoiceId=${invoiceId}`;

      if (clientEmail) {
        await sendInvoiceEmail(
          clientEmail,
          access.proj?.name || "Project",
          inv.invoiceNumber,
          inv.total,
          inv.currency,
          new Date(inv.dueDate),
          invoiceUrl,
          "free",
          (inv.companySnapshot as any)?.logoUrl
        );
      }

      revalidatePath(`/projects/${inv.projectId}/payments`);
      return NextResponse.json({ success: true });
    }

    // Action: Void Invoice
    if (action === "void") {
      if (!canManageProject(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await db.update(invoice).set({ status: "void", updatedAt: now }).where(eq(invoice.id, invoiceId));
      revalidatePath(`/projects/${inv.projectId}/payments`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("PATCH invoice error:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceId = searchParams.get("invoiceId");
    if (!invoiceId) return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });

    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [inv] = await db.select().from(invoice).where(eq(invoice.id, invoiceId));
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const access = await getProjectAccess(inv.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (inv.status === "paid") {
      return NextResponse.json({ error: "Cannot delete a paid invoice" }, { status: 400 });
    }

    await db.delete(invoice).where(eq(invoice.id, invoiceId));

    revalidatePath(`/projects/${inv.projectId}/payments`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE invoice error:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
