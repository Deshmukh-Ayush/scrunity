import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getValidAccessToken as getGmailToken, sendGmailMessage } from "./gmail";
import {
  getValidMicrosoftAccessToken,
  sendMicrosoftMessage,
} from "./microsoft";
import { sendSmtpMessage } from "./imap-smtp";
import type { SendMailboxResult } from "./mailbox-types";

export interface SendMailboxMessageParams {
  mailbox: typeof gtmConnectedMailbox.$inferSelect;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

/**
 * Dispatches an outbound email through the configured provider (Gmail, Microsoft 365, or SMTP).
 */
export async function sendEmailThroughMailbox({
  mailbox,
  to,
  subject,
  body,
  threadId,
  inReplyTo,
  references,
}: SendMailboxMessageParams): Promise<SendMailboxResult> {
  const provider = mailbox.provider || "gmail";

  switch (provider) {
    case "gmail": {
      const accessToken = await getGmailToken(mailbox.id);
      const res = await sendGmailMessage({
        accessToken,
        to,
        subject,
        body,
        fromEmail: mailbox.email,
        threadId,
        inReplyTo,
        references,
      });
      return {
        messageId: res.messageId,
        threadId: res.threadId || threadId,
      };
    }

    case "microsoft": {
      const accessToken = await getValidMicrosoftAccessToken(mailbox.id);
      return await sendMicrosoftMessage({
        accessToken,
        to,
        subject,
        body,
        fromEmail: mailbox.email,
        threadId,
        inReplyTo,
        references,
      });
    }

    case "imap_smtp": {
      return await sendSmtpMessage({
        mailboxId: mailbox.id,
        to,
        subject,
        body,
        inReplyTo,
        references,
      });
    }

    default:
      throw new Error(`Unsupported mailbox provider: ${provider}`);
  }
}
