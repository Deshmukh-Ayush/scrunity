import {
  extractMessageBody,
  extractMessageHeader,
  type GmailThreadMessage,
} from "./gmail";

export interface BounceDetectionResult {
  isBounce: boolean;
  reason?: string;
  statusCode?: string;
}

export interface InspectableMessage {
  id?: string;
  from?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  payload?: any;
  headers?: Record<string, string>;
}

/**
 * Inspects an email message object to determine if it represents a delivery failure (bounce) notification.
 * Works across Gmail, Microsoft 365, and IMAP/SMTP messages.
 * Checks sender (mailer-daemon/Mail Delivery Subsystem/postmaster), subject patterns, SMTP 55x status codes,
 * and standard bounce failure phrases.
 */
export function isBounceMessage(msg: InspectableMessage | GmailThreadMessage): BounceDetectionResult {
  const fromHeader = (
    ("from" in msg && typeof msg.from === "string" && msg.from) ||
    extractMessageHeader(msg as GmailThreadMessage, "From") ||
    ""
  ).toLowerCase();

  const subjectHeader = (
    ("subject" in msg && typeof msg.subject === "string" && msg.subject) ||
    extractMessageHeader(msg as GmailThreadMessage, "Subject") ||
    ""
  ).toLowerCase();

  const snippet = (msg.snippet || "").toLowerCase();
  const body = (
    ("body" in msg && typeof msg.body === "string" && msg.body) ||
    extractMessageBody(msg as GmailThreadMessage) ||
    ""
  ).toLowerCase();

  const combinedText = `${fromHeader} ${subjectHeader} ${snippet} ${body}`;

  // 1. Sender indicators
  const isSenderDaemon =
    fromHeader.includes("mailer-daemon") ||
    fromHeader.includes("mail delivery subsystem") ||
    fromHeader.includes("postmaster@");

  // 2. Subject indicators
  const isSubjectFailure =
    subjectHeader.includes("delivery status notification") ||
    subjectHeader.includes("undeliver") ||
    subjectHeader.includes("failure notice") ||
    subjectHeader.includes("mail delivery failed") ||
    subjectHeader.includes("returned to sender");

  // 3. Status codes (SMTP 55x or 5.x.x)
  const statusCodeMatch = combinedText.match(/\b(55[0-9]|5\.[0-7]\.[0-9])\b/);
  const statusCode = statusCodeMatch ? statusCodeMatch[1] : undefined;

  // 4. Content indicators
  const hasBounceKeywords =
    combinedText.includes("address not found") ||
    combinedText.includes("recipient address rejected") ||
    combinedText.includes("user unknown") ||
    combinedText.includes("mailbox unavailable") ||
    combinedText.includes("does not exist") ||
    combinedText.includes("no such user") ||
    combinedText.includes("couldn't be found") ||
    combinedText.includes("mailbox not found") ||
    combinedText.includes("quota exceeded");

  if (
    isSenderDaemon ||
    (isSubjectFailure && (statusCode || hasBounceKeywords)) ||
    (statusCode && hasBounceKeywords)
  ) {
    let reason = "Email bounced: Recipient address not found or mailbox unavailable";
    if (
      combinedText.includes("address not found") ||
      combinedText.includes("does not exist") ||
      combinedText.includes("no such user") ||
      combinedText.includes("user unknown") ||
      combinedText.includes("couldn't be found")
    ) {
      reason = "Email bounced: Recipient address does not exist (550)";
    } else if (
      combinedText.includes("quota exceeded") ||
      combinedText.includes("mailbox full")
    ) {
      reason = "Email bounced: Recipient mailbox is full";
    } else if (statusCode) {
      reason = `Email bounced: Delivery rejected by server (${statusCode})`;
    }

    return {
      isBounce: true,
      reason,
      statusCode,
    };
  }

  return { isBounce: false };
}
