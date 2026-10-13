/** The mailbox record returned alongside threads by GET /api/gtm/mailbox/threads. */
export interface ConnectedMailboxInfo {
  id: string
  email: string
  provider?: string
  status: string
  dailySendCount?: number
  metadata?: {
    smtp?: { host: string; port: number; secure: boolean; user: string }
    imap?: { host: string; port: number; secure: boolean; user: string }
    microsoftTenantId?: string
    providerDisplayName?: string
  }
}

export type MailboxTab = "conversations" | "settings"
