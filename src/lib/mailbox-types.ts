export interface NormalizedMailMessage {
  id: string;
  threadId?: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  timestamp: Date;
  headers?: Record<string, string>;
  isOutbound?: boolean;
}

export interface SendMailboxParams {
  mailboxId: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

export interface SendMailboxResult {
  messageId: string;
  threadId?: string;
}
