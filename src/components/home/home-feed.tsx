"use client"

import Link from "next/link"
import { useHydrated } from "@/hooks/use-hydrated"
import {
  AlertTriangle,
  Building2,
  Calendar,
  Info,
  Mail,
  MailReply,
  Send,
} from "@/components/ui/icons"
import type { NeedsYouItem, TodayItem } from "@/lib/data/home"
import { FeedRow, FeedSection } from "./feed-row"

const NEEDS_YOU_LIMIT = 5

// Stopped campaigns first: they block everything after them.
const NEEDS_YOU_ORDER: Record<NeedsYouItem["kind"], number> = {
  campaign_failed: 0,
  approve_emails: 1,
  send_approved: 2,
  select_companies: 3,
  awaiting_review: 4,
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`

function needsYouRow(item: NeedsYouItem) {
  const href = `/dashboard/campaigns/${item.campaignId}`
  switch (item.kind) {
    case "campaign_failed":
      return {
        href,
        icon: AlertTriangle,
        title: "Campaign stopped",
        context: item.segmentName,
        action: "Open",
      }
    case "approve_emails":
      return {
        href,
        icon: Mail,
        title: `${plural(item.count, "email")} waiting for approval`,
        context: item.segmentName,
        action: "Review",
      }
    case "send_approved":
      return {
        href,
        icon: Send,
        title: `${plural(item.count, "approved email")} ready to send`,
        context: item.segmentName,
        action: "Open",
      }
    case "select_companies":
      return {
        href,
        icon: Building2,
        title: "Choose which companies to contact",
        context: item.segmentName,
        action: "Review",
      }
    case "awaiting_review":
      return {
        href,
        icon: Info,
        title: "Campaign waiting for your review",
        context: item.segmentName,
        action: "Review",
      }
  }
}

/** Campaigns waiting on a decision. Hidden when there are none. */
export function NeedsYou({ items }: { items: NeedsYouItem[] }) {
  const sorted = [...items].sort(
    (a, b) => NEEDS_YOU_ORDER[a.kind] - NEEDS_YOU_ORDER[b.kind]
  )
  const visible = sorted.slice(0, NEEDS_YOU_LIMIT)

  return (
    <FeedSection
      id="home-needs-you"
      title="Needs you"
      meta={items.length}
      action={
        items.length > NEEDS_YOU_LIMIT ? (
          <Link
            href="/dashboard/campaigns"
            className="text-body font-medium text-fg-default hover:text-fg-strong"
          >
            View all
          </Link>
        ) : undefined
      }
    >
      {visible.map((item) => {
        const row = needsYouRow(item)
        return (
          <FeedRow
            key={`${item.kind}-${item.campaignId}`}
            href={row.href}
            icon={row.icon}
            title={row.title}
            context={row.context}
            trailing={row.action}
          />
        )
      })}
    </FeedSection>
  )
}

const INTENT_LABELS: Record<string, string> = {
  interested: "Interested",
  not_interested: "Not interested",
  question: "Asked a question",
  auto_reply: "Auto-reply",
}

function isLocalToday(value: Date | string, now: Date) {
  const date = new Date(value)
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

interface TodayRow {
  key: string
  href: string
  icon: typeof Send
  title: string
  context?: string
  at: Date
}

/** Sends are grouped per campaign; replies and meetings are one row each. Newest first. */
function todayRows(items: TodayItem[], now: Date): TodayRow[] {
  const sends = new Map<
    string,
    { segmentName: string; count: number; at: Date }
  >()
  const rows: TodayRow[] = []

  for (const item of items) {
    if (!isLocalToday(item.at, now)) continue
    const at = new Date(item.at)
    if (item.kind === "sent") {
      const entry = sends.get(item.campaignId) ?? {
        segmentName: item.segmentName,
        count: 0,
        at,
      }
      entry.count += item.count
      if (at > entry.at) entry.at = at
      sends.set(item.campaignId, entry)
    } else if (item.kind === "reply") {
      const intent = item.intent ? INTENT_LABELS[item.intent] : undefined
      rows.push({
        key: `reply-${item.contactId}-${at.getTime()}`,
        href: `/dashboard/mailbox?contactId=${item.contactId}`,
        icon: MailReply,
        title: `Reply from ${item.contactName}`,
        context: [item.companyName, intent].filter(Boolean).join(" · "),
        at,
      })
    } else {
      rows.push({
        key: `meeting-${item.contactId}-${at.getTime()}`,
        href: `/dashboard/mailbox?contactId=${item.contactId}`,
        icon: Calendar,
        title: `Meeting with ${item.contactName}`,
        context: item.companyName,
        at,
      })
    }
  }

  for (const [campaignId, entry] of sends) {
    rows.push({
      key: `sent-${campaignId}`,
      href: `/dashboard/campaigns/${campaignId}`,
      icon: Send,
      title: `${plural(entry.count, "email")} sent`,
      context: entry.segmentName,
      at: entry.at,
    })
  }

  return rows.sort((a, b) => b.at.getTime() - a.at.getTime())
}

/**
 * What happened (or is booked) on the viewer's local today. It depends on the
 * viewer's clock and timezone, so it renders only after hydration; it sits
 * last on the page, so nothing above it moves when it appears.
 */
export function Today({ items }: { items: TodayItem[] }) {
  const hydrated = useHydrated()
  if (!hydrated) return null

  const now = new Date()
  const rows = todayRows(items, now)
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  return (
    <FeedSection id="home-today" title="Today" meta={dateLabel}>
      {rows.map((row) => (
        <FeedRow
          key={row.key}
          href={row.href}
          icon={row.icon}
          title={row.title}
          context={row.context}
          trailing={
            <time
              dateTime={row.at.toISOString()}
              className="text-meta text-fg-muted tabular-nums"
            >
              {row.at.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          }
        />
      ))}
    </FeedSection>
  )
}
