import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/utils/db";
import { gtmMeeting, gtmContact, gtmProspectCompany } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signatureHeader =
      req.headers.get("x-cal-signature-256") ||
      req.headers.get("x-calcom-signature-256");

    const secret = process.env.CALCOM_WEBHOOK_SECRET;

    // Verify signature
    if (!secret || !signatureHeader) {
      console.warn("[Cal.com Webhook] Missing secret or signature header");
      return NextResponse.json(
        { error: "Invalid signature: secret or signature header missing" },
        { status: 401 }
      );
    }

    const normalizedHeader = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice(7)
      : signatureHeader;

    const computedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const sigBuffer = Buffer.from(normalizedHeader, "utf8");
    const compBuffer = Buffer.from(computedSignature, "utf8");

    if (
      sigBuffer.length !== compBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, compBuffer)
    ) {
      console.warn("[Cal.com Webhook] Signature verification failed");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse payload
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      return NextResponse.json(
        { error: "Malformed JSON payload" },
        { status: 400 }
      );
    }

    const triggerEvent: string = (
      body.triggerEvent ||
      body.type ||
      body.event ||
      ""
    ).toUpperCase();

    const payloadData = body.payload || body.data || body;
    const bookingUid: string | undefined =
      payloadData.uid || payloadData.bookingUid || payloadData.id;

    // Extract potential candidate emails
    const candidateEmails: string[] = [];
    if (Array.isArray(payloadData.attendees)) {
      for (const att of payloadData.attendees) {
        if (att && typeof att.email === "string" && att.email.trim()) {
          candidateEmails.push(att.email.trim());
        }
      }
    }
    if (payloadData.attendee?.email && typeof payloadData.attendee.email === "string") {
      candidateEmails.push(payloadData.attendee.email.trim());
    }
    if (typeof payloadData.attendeeEmail === "string" && payloadData.attendeeEmail.trim()) {
      candidateEmails.push(payloadData.attendeeEmail.trim());
    }
    if (typeof payloadData.email === "string" && payloadData.email.trim()) {
      candidateEmails.push(payloadData.email.trim());
    }

    // Handle cancellation
    if (
      triggerEvent === "BOOKING_CANCELLED" ||
      triggerEvent === "BOOKING_CANCELED" ||
      triggerEvent.includes("CANCEL")
    ) {
      if (bookingUid) {
        await db
          .update(gtmMeeting)
          .set({ status: "cancelled" })
          .where(eq(gtmMeeting.calcomBookingUid, bookingUid));
      } else if (candidateEmails.length > 0) {
        const [latestMeeting] = await db
          .select({ id: gtmMeeting.id })
          .from(gtmMeeting)
          .where(
            and(
              sql`lower(${gtmMeeting.attendeeEmail}) = lower(${candidateEmails[0]})`,
              eq(gtmMeeting.status, "booked")
            )
          )
          .orderBy(desc(gtmMeeting.createdAt))
          .limit(1);

        if (latestMeeting) {
          await db
            .update(gtmMeeting)
            .set({ status: "cancelled" })
            .where(eq(gtmMeeting.id, latestMeeting.id));
        }
      }

      return NextResponse.json({
        success: true,
        message: "Booking cancellation recorded",
      });
    }

    // Handle rescheduling
    if (triggerEvent.includes("RESCHEDULE")) {
      const rawScheduledAt =
        payloadData.startTime ||
        payloadData.start ||
        payloadData.scheduledAt;
      const scheduledDate = rawScheduledAt ? new Date(rawScheduledAt) : null;

      if (bookingUid && scheduledDate && !isNaN(scheduledDate.getTime())) {
        await db
          .update(gtmMeeting)
          .set({ scheduledAt: scheduledDate, status: "booked" })
          .where(eq(gtmMeeting.calcomBookingUid, bookingUid));
      }

      return NextResponse.json({
        success: true,
        message: "Booking reschedule recorded",
      });
    }

    // Default or BOOKING_CREATED
    if (triggerEvent === "BOOKING_CREATED" || !triggerEvent || triggerEvent.includes("BOOK")) {
      // Idempotency check if bookingUid already exists
      if (bookingUid) {
        const [existing] = await db
          .select({ id: gtmMeeting.id })
          .from(gtmMeeting)
          .where(eq(gtmMeeting.calcomBookingUid, bookingUid))
          .limit(1);

        if (existing) {
          return NextResponse.json({
            success: true,
            message: "Meeting already recorded",
            meetingId: existing.id,
          });
        }
      }

      // Look up contact by matching attendee email
      let matchedContact: {
        contactId: string;
        outreachCampaignId: string | null;
        email: string | null;
      } | null = null;

      for (const email of candidateEmails) {
        const [found] = await db
          .select({
            contactId: gtmContact.id,
            outreachCampaignId: gtmProspectCompany.outreachCampaignId,
            email: gtmContact.email,
          })
          .from(gtmContact)
          .innerJoin(
            gtmProspectCompany,
            eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
          )
          .where(sql`lower(${gtmContact.email}) = lower(${email})`)
          .limit(1);

        if (found) {
          matchedContact = found;
          break;
        }
      }

      if (!matchedContact) {
        console.warn(
          `[Cal.com Webhook] No matching gtm_contact found for attendee emails: ${candidateEmails.join(", ")}`
        );
        return NextResponse.json({
          success: true,
          matched: false,
          message: "No matching contact found; webhook acknowledged",
        });
      }

      const rawScheduledAt =
        payloadData.startTime ||
        payloadData.start ||
        payloadData.scheduledAt;
      const parsedDate = rawScheduledAt ? new Date(rawScheduledAt) : new Date();
      const scheduledAt = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

      const [newMeeting] = await db
        .insert(gtmMeeting)
        .values({
          contactId: matchedContact.contactId,
          outreachCampaignId: matchedContact.outreachCampaignId,
          scheduledAt,
          status: "booked",
          calcomBookingUid: bookingUid || null,
          attendeeEmail: matchedContact.email || candidateEmails[0],
        })
        .returning();

      return NextResponse.json({
        success: true,
        matched: true,
        message: "Meeting booked successfully",
        meetingId: newMeeting.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Ignored unhandled triggerEvent: ${triggerEvent}`,
    });
  } catch (error: any) {
    console.error("[Cal.com Webhook] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}
