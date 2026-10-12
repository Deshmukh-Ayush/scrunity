import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptToken } from "./encryption";
import type { NormalizedMailMessage, SendMailboxResult } from "./mailbox-types";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface ImapSmtpConnectionInput {
  email: string;
  displayName?: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  imap: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

/**
 * Formats low-level transport errors into clear, actionable messages for the user.
 */
function formatTransportError(err: any, service: "SMTP" | "IMAP"): string {
  const msg = err?.message || String(err);
  const code = err?.code || "";

  if (code === "ECONNREFUSED" || msg.includes("ECONNREFUSED")) {
    return `${service} connection refused. Please verify the host address and port number.`;
  }
  if (code === "ENOTFOUND" || msg.includes("ENOTFOUND")) {
    return `${service} host could not be resolved. Please double-check the server domain name.`;
  }
  if (
    code === "EAUTH" ||
    msg.includes("535") ||
    msg.includes("Authentication failed") ||
    msg.includes("Invalid credentials") ||
    msg.includes("LOGIN failed")
  ) {
    return `${service} authentication failed. Check your username and password. For services like Gmail, iCloud, or Fastmail, an App-Specific Password is required.`;
  }
  if (code === "ETIMEDOUT" || msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
    return `${service} connection timed out. Ensure the port and SSL/TLS settings match your provider's requirements.`;
  }
  if (msg.includes("certificate") || msg.includes("self-signed")) {
    return `${service} SSL/TLS certificate validation failed. Ensure the server has a valid certificate or TLS is properly configured.`;
  }

  return `${service} error: ${msg}`;
}

/**
 * Verifies SMTP connection and authentication credentials.
 */
export async function verifySmtpConnection(config: SmtpConfig): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 12000,
    greetingTimeout: 8000,
  });

  try {
    await transporter.verify();
  } catch (err: any) {
    throw new Error(formatTransportError(err, "SMTP"));
  }
}

/**
 * Verifies IMAP connection and authentication credentials.
 */
export async function verifyImapConnection(config: ImapConfig): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
    connectionTimeout: 12000,
    greetingTimeout: 8000,
  });

  try {
    await client.connect();
    // Test mailbox access (INBOX)
    const lock = await client.getMailboxLock("INBOX");
    lock.release();
    await client.logout();
  } catch (err: any) {
    try {
      await client.logout();
    } catch {}
    throw new Error(formatTransportError(err, "IMAP"));
  }
}

/**
 * Validates both SMTP and IMAP configurations simultaneously.
 * Fails if either one cannot connect or authenticate.
 */
export async function testImapSmtpConnection(
  input: ImapSmtpConnectionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Verify SMTP
    await verifySmtpConnection(input.smtp);

    // 2. Verify IMAP
    await verifyImapConnection(input.imap);

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Sends an email using SMTP via Nodemailer.
 */
export async function sendSmtpMessage({
  mailboxId,
  to,
  subject,
  body,
  inReplyTo,
  references,
}: {
  mailboxId: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): Promise<SendMailboxResult> {
  const [mailbox] = await db
    .select()
    .from(gtmConnectedMailbox)
    .where(eq(gtmConnectedMailbox.id, mailboxId));

  if (!mailbox) {
    throw new Error(`Connected mailbox ${mailboxId} not found`);
  }

  if (mailbox.status === "revoked") {
    throw new Error(`Connected mailbox (${mailbox.email}) is revoked`);
  }

  const smtpMeta = mailbox.metadata?.smtp;
  if (!smtpMeta) {
    throw new Error(`Mailbox ${mailbox.email} is missing SMTP configuration`);
  }

  if (!mailbox.encryptedPassword) {
    throw new Error(`Mailbox ${mailbox.email} is missing encrypted password`);
  }

  const plainPassword = decryptToken(mailbox.encryptedPassword);

  const transporter = nodemailer.createTransport({
    host: smtpMeta.host,
    port: smtpMeta.port,
    secure: smtpMeta.secure,
    auth: {
      user: smtpMeta.user,
      pass: plainPassword,
    },
    connectionTimeout: 15000,
  });

  const fromDisplayName =
    mailbox.metadata?.providerDisplayName || mailbox.email.split("@")[0];

  const headers: Record<string, string> = {};
  if (inReplyTo) {
    headers["In-Reply-To"] = inReplyTo;
  }
  if (references || inReplyTo) {
    headers["References"] = references || inReplyTo!;
  }

  const cleanSubject = subject.replace(/[\r\n]+/g, " ");

  const info = await transporter.sendMail({
    from: `"${fromDisplayName}" <${mailbox.email}>`,
    to,
    subject: cleanSubject,
    text: body,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  const messageId = info.messageId || `<${Date.now()}@${mailbox.email.split("@")[1] || "aursh.internal"}>`;
  const threadId = inReplyTo || references || messageId;

  return {
    messageId,
    threadId,
  };
}

/**
 * Polls messages from IMAP mailbox for replies, parsing RFC 2822 contents.
 */
export async function pollImapMessages({
  mailboxId,
  sinceDate,
}: {
  mailboxId: string;
  sinceDate?: Date;
}): Promise<NormalizedMailMessage[]> {
  const [mailbox] = await db
    .select()
    .from(gtmConnectedMailbox)
    .where(eq(gtmConnectedMailbox.id, mailboxId));

  if (!mailbox) {
    throw new Error(`Connected mailbox ${mailboxId} not found`);
  }

  if (mailbox.status === "revoked") {
    return [];
  }

  const imapMeta = mailbox.metadata?.imap;
  if (!imapMeta || !mailbox.encryptedPassword) {
    return [];
  }

  const plainPassword = decryptToken(mailbox.encryptedPassword);

  const client = new ImapFlow({
    host: imapMeta.host,
    port: imapMeta.port,
    secure: imapMeta.secure,
    auth: {
      user: imapMeta.user,
      pass: plainPassword,
    },
    logger: false,
    connectionTimeout: 15000,
  });

  const normalizedList: NormalizedMailMessage[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchCriteria: Record<string, any> = {};
      if (sinceDate) {
        searchCriteria.since = sinceDate;
      } else {
        // Default to last 30 days
        searchCriteria.since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      const messages = client.fetch(searchCriteria, {
        source: true,
        envelope: true,
        internalDate: true,
      });

      for await (const msg of messages) {
        if (!msg.source) continue;

        try {
          const parsed = await simpleParser(msg.source);
          const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase().trim() || "";
          const fromName = parsed.from?.value?.[0]?.name || fromAddress;
          const toAddress = parsed.to
            ? Array.isArray(parsed.to)
              ? parsed.to[0]?.value?.[0]?.address?.toLowerCase().trim() || ""
              : parsed.to.value?.[0]?.address?.toLowerCase().trim() || ""
            : "";

          const isOutbound = fromAddress === mailbox.email.toLowerCase().trim();

          const inReplyTo =
            typeof parsed.inReplyTo === "string"
              ? parsed.inReplyTo
              : Array.isArray(parsed.inReplyTo)
                ? parsed.inReplyTo[0]
                : undefined;

          const references = Array.isArray(parsed.references)
            ? parsed.references.join(" ")
            : typeof parsed.references === "string"
              ? parsed.references
              : undefined;

          const headers: Record<string, string> = {};
          if (inReplyTo) headers["in-reply-to"] = inReplyTo;
          if (references) headers["references"] = references;

          const bodyText =
            parsed.text ||
            (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "");

          const messageId = parsed.messageId || `<imap-${msg.uid}@aursh.internal>`;
          const threadId = inReplyTo || references || messageId;

          normalizedList.push({
            id: messageId,
            threadId,
            from: fromAddress,
            fromName,
            to: toAddress,
            subject: parsed.subject || "",
            body: bodyText,
            snippet: bodyText.slice(0, 200),
            timestamp: parsed.date
              ? new Date(parsed.date)
              : msg.internalDate
                ? new Date(msg.internalDate)
                : new Date(),
            headers,
            isOutbound,
          });
        } catch (parseErr) {
          console.warn(`[IMAP Poll] Failed to parse message uid ${msg.uid}:`, parseErr);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err: any) {
    try {
      await client.logout();
    } catch {}

    const errStr = err?.message || String(err);
    if (
      errStr.includes("EAUTH") ||
      errStr.includes("Authentication failed") ||
      errStr.includes("LOGIN failed")
    ) {
      await db
        .update(gtmConnectedMailbox)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(eq(gtmConnectedMailbox.id, mailboxId));
    }
    console.error(`[IMAP Poll] Error polling mailbox ${mailbox.email}:`, err);
  }

  return normalizedList;
}
