import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/utils/db";
import { paymentMilestone, invoice, paymentProof } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectAccess } from "@/lib/project-auth";
import { putBlob } from "@/lib/blob";
import { extractPaymentProof } from "@/lib/ai/payment-extractor";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export const maxDuration = 60;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const milestoneId = formData.get("milestoneId") as string | null;
    const invoiceId = formData.get("invoiceId") as string | null;

    if (!file || (!milestoneId && !invoiceId)) {
      return NextResponse.json(
        { error: "file and either milestoneId or invoiceId are required." },
        { status: 400 }
      );
    }

    // Verify file type and size (max 15MB)
    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PNG, JPG, JPEG, or PDF." },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds 15MB size limit." },
        { status: 400 }
      );
    }

    let targetProjectId: string;
    let targetMilestoneId: string | null = milestoneId || null;
    let targetInvoiceId: string | null = invoiceId || null;
    let activityTitle = "Payment Proof";
    let activityAmount = 0;

    if (targetMilestoneId) {
      // Find milestone
      const [milestone] = await db
        .select()
        .from(paymentMilestone)
        .where(eq(paymentMilestone.id, targetMilestoneId));

      if (!milestone) {
        return NextResponse.json(
          { error: "Milestone not found." },
          { status: 404 }
        );
      }

      if (milestone.status === "paid") {
        return NextResponse.json(
          { error: "This milestone is already marked as paid." },
          { status: 400 }
        );
      }

      targetProjectId = milestone.projectId;
      activityTitle = milestone.title;
      activityAmount = milestone.amount;

      // Find linked invoice if invoiceId not provided
      if (!targetInvoiceId) {
        const linkedInv = await db.query.invoice.findFirst({
          where: eq(invoice.milestoneId, targetMilestoneId),
        });
        if (linkedInv) {
          targetInvoiceId = linkedInv.id;
        }
      }
    } else {
      // Standalone invoice lookup
      const linkedInv = await db.query.invoice.findFirst({
        where: eq(invoice.id, targetInvoiceId!),
      });

      if (!linkedInv) {
        return NextResponse.json(
          { error: "Invoice not found." },
          { status: 404 }
        );
      }

      if (linkedInv.status === "paid") {
        return NextResponse.json(
          { error: "This invoice is already marked as paid." },
          { status: 400 }
        );
      }

      targetProjectId = linkedInv.projectId;
      targetMilestoneId = linkedInv.milestoneId || null;
      activityTitle = `Invoice ${linkedInv.invoiceNumber}`;
      activityAmount = linkedInv.total;
    }

    // Authorization: User must be an authorized member of the project
    const access = await getProjectAccess(targetProjectId, session.user.id);
    if (!access.isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized access to project." },
        { status: 403 }
      );
    }

    // Convert file to buffer for upload and OCR extraction
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 1. Upload raw proof to Vercel Blob store
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const blobPathname = `payment-proofs/${targetProjectId}/${targetMilestoneId || targetInvoiceId}/${crypto.randomUUID()}-${safeFileName}`;
    const blobResult = await putBlob(blobPathname, fileBuffer, {
      contentType: file.type,
      addRandomSuffix: false,
    });

    // 2. Run extraction pipeline (PDF text extraction or Image OCR + Groq structured AI)
    const extractedData = await extractPaymentProof(
      fileBuffer,
      file.type,
      file.name
    );

    // 3. Save payment_proof record with status 'pending_review'
    const proofId = crypto.randomUUID();
    const [savedProof] = await db
      .insert(paymentProof)
      .values({
        id: proofId,
        invoiceId: targetInvoiceId || null,
        milestoneId: targetMilestoneId || null,
        projectId: targetProjectId,
        fileUrl: blobResult.url,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        extractedData,
        status: "pending_review",
        submittedBy: session.user.id,
      })
      .returning();

    // 4. Move linked invoice status to 'payment_submitted' (NOT directly to 'paid')
    if (targetInvoiceId) {
      await db
        .update(invoice)
        .set({
          status: "payment_submitted",
          updatedAt: new Date(),
        })
        .where(eq(invoice.id, targetInvoiceId));
    }

    // 5. Log activity
    await logActivity({
      projectId: targetProjectId,
      userId: session.user.id,
      type: "payment_proof_submitted" as any,
      metadata: {
        milestoneTitle: activityTitle,
        amount: activityAmount,
        fileName: file.name,
        referenceId: extractedData.referenceId,
      },
    });

    revalidatePath(`/projects/${targetProjectId}`);
    revalidatePath(`/projects/${targetProjectId}/payments`);
    if (targetInvoiceId) {
      revalidatePath(`/projects/${targetProjectId}/payments/invoices/${targetInvoiceId}`);
    }

    return NextResponse.json({
      success: true,
      proofId: savedProof.id,
      fileUrl: blobResult.url,
      extractedData,
    });
  } catch (error) {
    console.error("[Payment Proof Upload Error]:", error);
    return NextResponse.json(
      { error: "Failed to process payment proof upload." },
      { status: 500 }
    );
  }
}
