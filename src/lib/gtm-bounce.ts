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

/**
 * Inspects a Gmail message object to determine if it represents a delivery failure (bounce) notification.
 * Checks sender (mailer-daemon/Mail Delivery Subsystem), subject patterns, SMTP 55x status codes,
 * and standard bounce failure phrases.
 */
export function isBounceMessage(msg: GmailThreadMessage): BounceDetectionResult {
  const fromHeader = (extractMessageHeader(msg, "From") || "").toLowerCase();
  const subjectHeader = (extractMessageHeader(msg, "Subject") || "").toLowerCase();
  const snippet = (msg.snippet || "").toLowerCase();
  const body = (extractMessageBody(msg) || "").toLowerCase();
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
