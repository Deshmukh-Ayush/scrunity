import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/utils/db";
import { paymentMilestone, payment, invoice, paymentProof } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectAccess, canManageProject } from "@/lib/project-auth";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { z } from "zod";
import { getUsdToInrRate } from "@/lib/currency";

const reviewSchema = z.object({
  proofId: z.string().min(1),
  action: z.enum(["confirm", "reject"]),
  referenceId: z.string().trim().max(100).nullable().optional(),
  amount: z.number().positive().nullable().optional(), // Amount in major currency units if corrected
  paymentMethod: z.string().trim().max(50).nullable().optional(),
  rejectionReason: z.string().trim().max(500).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload.", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { proofId, action, referenceId, amount, paymentMethod, rejectionReason } =
      parsed.data;

    const proof = await db.query.paymentProof.findFirst({
      where: eq(paymentProof.id, proofId),
      with: {
        milestone: true,
        invoice: true,
      },
    });

    if (!proof) {
      return NextResponse.json(
        { error: "Payment proof not found." },
        { status: 404 }
      );
    }

    // Role Gating: Agency/Freelancer managers ONLY
    const access = await getProjectAccess(proof.projectId, session.user.id);
    if (!access.isAuthorized || !canManageProject(access.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only agency owners and managers can review payment proofs." },
        { status: 403 }
      );
    }

    const now = new Date();

    if (action === "confirm") {
      // 1. Mark proof confirmed
      await db
        .update(paymentProof)
        .set({
          status: "confirmed",
          reviewedBy: session.user.id,
          reviewedAt: now,
        })
        .where(eq(paymentProof.id, proofId));

      // 2. Mark milestone paid if linked
      if (proof.milestoneId) {
        await db
          .update(paymentMilestone)
          .set({
            status: "paid",
            updatedAt: now,
          })
          .where(eq(paymentMilestone.id, proof.milestoneId));
      }

      // 3. Create official payment record
      const targetCurrency = proof.milestone?.currency || proof.invoice?.currency || "INR";
      const targetAmountSubunits = amount
        ? Math.round(amount * 100)
        : proof.milestone?.amount || proof.invoice?.total || 0;

      const newPaymentId = crypto.randomUUID();
      const liveFxRate = await getUsdToInrRate();

      await db.insert(payment).values({
        id: newPaymentId,
        milestoneId: proof.milestoneId || null,
        invoiceId: proof.invoiceId || null,
        projectId: proof.projectId,
        amount: targetAmountSubunits,
        currency: targetCurrency,
        paymentMethod: paymentMethod || (proof.extractedData as any)?.paymentMethod || "bank_transfer",
        referenceNote: referenceId || (proof.extractedData as any)?.referenceId || null,
        fxRateAtPayment: liveFxRate.toFixed(4),
        status: "succeeded",
        paidAt: now,
      });

      // 4. Update linked invoice to 'paid'
      if (proof.invoiceId) {
        await db
          .update(invoice)
          .set({
            status: "paid",
            paidAt: now,
            updatedAt: now,
          })
          .where(eq(invoice.id, proof.invoiceId));
      }

      // 5. Log activity
      const title = proof.milestone?.title || (proof.invoice ? `Invoice ${proof.invoice.invoiceNumber}` : "Payment");
      await logActivity({
        projectId: proof.projectId,
        userId: session.user.id,
        type: "payment_completed",
        metadata: {
          milestoneTitle: title,
          amount: targetAmountSubunits,
          currency: targetCurrency,
          paymentMethod: paymentMethod || "bank_transfer",
          referenceNote: referenceId || null,
          confirmedProofId: proofId,
        },
      });

      revalidatePath(`/projects/${proof.projectId}`);
      revalidatePath(`/projects/${proof.projectId}/payments`);
      if (proof.invoiceId) {
        revalidatePath(`/projects/${proof.projectId}/payments/invoices/${proof.invoiceId}`);
      }

      return NextResponse.json({
        success: true,
        action: "confirmed",
        paymentId: newPaymentId,
      });
    }

    if (action === "reject") {
      const reason = rejectionReason || "Payment proof could not be verified.";

      // 1. Mark proof rejected
      await db
        .update(paymentProof)
        .set({
          status: "rejected",
          rejectionReason: reason,
          reviewedBy: session.user.id,
          reviewedAt: now,
        })
        .where(eq(paymentProof.id, proofId));

      // 2. Reset linked invoice status back from 'payment_submitted' to 'sent'
      if (proof.invoiceId && proof.invoice) {
        const isOverdue =
          proof.invoice.dueDate && new Date(proof.invoice.dueDate) < now;
        await db
          .update(invoice)
          .set({
            status: isOverdue ? "overdue" : "sent",
            updatedAt: now,
          })
          .where(eq(invoice.id, proof.invoiceId));
      }

      // 3. Log activity
      const title = proof.milestone?.title || (proof.invoice ? `Invoice ${proof.invoice.invoiceNumber}` : "Payment Proof");
      await logActivity({
        projectId: proof.projectId,
        userId: session.user.id,
        type: "payment_proof_rejected" as any,
        metadata: {
          milestoneTitle: title,
          rejectionReason: reason,
          proofId,
        },
      });

      revalidatePath(`/projects/${proof.projectId}`);
      revalidatePath(`/projects/${proof.projectId}/payments`);
      if (proof.invoiceId) {
        revalidatePath(`/projects/${proof.projectId}/payments/invoices/${proof.invoiceId}`);
      }

      return NextResponse.json({
        success: true,
        action: "rejected",
        rejectionReason: reason,
      });
    }

    return NextResponse.json({ error: "Unhandled review action." }, { status: 400 });
  } catch (error) {
    console.error("[Payment Proof Review Error]:", error);
    return NextResponse.json(
      { error: "Failed to review payment proof." },
      { status: 500 }
    );
  }
}
