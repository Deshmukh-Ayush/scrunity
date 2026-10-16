import type { MailboxThread } from "@/lib/mailbox-thread-types"

/**
 * Thread search and filter predicates, shared by GET /api/gtm/mailbox/threads
 * (lib/data/mailbox.ts) and the Mailbox page, so both always agree.
 */

export const MAILBOX_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "interested", label: "Interested" },
  { id: "question", label: "Questions" },
  { id: "not_interested", label: "Not interested" },
  { id: "bounced", label: "Bounced" },
] as const

export type MailboxFilterId = (typeof MAILBOX_FILTERS)[number]["id"]

export function isMailboxFilterId(
  value: string | null | undefined
): value is MailboxFilterId {
  return MAILBOX_FILTERS.some((f) => f.id === value)
}

export function matchesSearch(thread: MailboxThread, search: string) {
  const q = search.toLowerCase().trim()
  if (!q) return true
  return (
    thread.contact.name.toLowerCase().includes(q) ||
    Boolean(thread.contact.email?.toLowerCase().includes(q)) ||
    Boolean(thread.company.name?.toLowerCase().includes(q)) ||
    thread.subject.toLowerCase().includes(q) ||
    thread.latestSnippet.toLowerCase().includes(q) ||
    thread.campaign.name.toLowerCase().includes(q)
  )
}

/** "unread" and "bounced" are thread states, not reply intents (a bounced thread never has one). */
export function matchesFilter(
  thread: MailboxThread,
  filter: string | null | undefined
) {
  if (!filter || filter === "all") return true
  if (filter === "unread") return thread.isUnread
  if (filter === "bounced") return Boolean(thread.isBounced)
  return thread.classifiedIntent === filter
}
