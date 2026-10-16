import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { MailThreadsIllustration } from "@/components/ui/illustrations/mail-threads"
import { MailboxAttentionBanner } from "@/components/mailbox/mailbox-states"
import {
  THREAD_STATUSES,
  ThreadStatusBadge,
} from "@/components/mailbox/thread-status"
import {
  FilterDemo,
  MailboxPageStates,
  MessageCardDemo,
  ThreadRowDemo,
} from "./mailbox-demos"
import type { ForcedStateProps, ShowcaseEntry, StateName } from "./types"

const LINK_STATES: StateName[] = ["default", "hover", "focus-visible"]
const force = (props: ForcedStateProps) =>
  props["data-force"] === "pressed" ? undefined : props["data-force"]

export const emptyStateEntry: ShowcaseEntry = {
  id: "empty-state",
  name: "Empty state",
  group: "Display",
  description:
    'Illustration slot, bold title, up to two lines of description, actions, and an optional Learn more card. size="sm" for tight places; DataTable\'s empty and error messages use it.',
  render: () => (
    <div className="grid w-full gap-6 lg:grid-cols-2">
      <div className="rounded-lg bg-canvas p-4 shadow-surface">
        <EmptyState
          illustration={<MailThreadsIllustration />}
          title="No conversations yet"
          description="Emails your campaigns send, and the replies to them, will appear here."
          actions={
            <Link href="#empty-state" className={buttonVariants()}>
              Go to campaigns
            </Link>
          }
          learnMore={{
            title: "How the mailbox works",
            description: "What appears here and when replies are read.",
            href: "#empty-state",
          }}
        />
      </div>
      <div className="flex flex-col gap-6 rounded-lg bg-canvas p-4 shadow-surface">
        <EmptyState
          size="sm"
          title="No conversations match"
          description="Try another search or filter."
        />
        <div className="flex items-end justify-center gap-6 text-fg-default">
          <MailThreadsIllustration className="w-20" />
          <MailThreadsIllustration className="w-40" />
          <MailThreadsIllustration className="w-60 text-fg-muted" />
        </div>
        <p className="text-center text-meta text-fg-muted">
          The illustration at 80, 160 and 240px, in the subtle and muted tokens.
        </p>
      </div>
    </div>
  ),
}

export const threadRowEntry: ShowcaseEntry = {
  id: "mailbox-thread-row",
  name: "Mailbox thread row",
  group: "Mailbox",
  description:
    "Two lines. Line 1: unread dot + semibold name, company (truncates first), time. Line 2: the one status badge and the latest snippet, decoded. Selected is a white chip; hover a muted fill; focus the brand ring.",
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {Object.values(THREAD_STATUSES).map((status) => (
          <ThreadStatusBadge key={status.label} status={status} />
        ))}
      </div>
      <p className="text-meta text-fg-muted">
        Status badges: one per thread. Bounced is the only toned one; reply
        classes stay neutral with an icon.
      </p>
    </div>
  ),
  states: [
    {
      label: "default (sent)",
      supports: LINK_STATES,
      render: (p) => <ThreadRowDemo id="t-sent" force={force(p)} />,
    },
    {
      label: "unread (interested)",
      supports: LINK_STATES,
      render: (p) => <ThreadRowDemo id="t-interested" force={force(p)} />,
    },
    {
      label: "selected",
      supports: LINK_STATES,
      render: (p) => (
        <ThreadRowDemo id="t-question" selected force={force(p)} />
      ),
    },
    {
      label: "long text",
      supports: LINK_STATES,
      render: (p) => <ThreadRowDemo id="t-hostile" force={force(p)} />,
    },
    {
      label: "bounced",
      supports: LINK_STATES,
      render: (p) => <ThreadRowDemo id="t-bounced" force={force(p)} />,
    },
  ],
}

export const messageCardEntry: ShowcaseEntry = {
  id: "mailbox-message-card",
  name: "Mailbox message card",
  group: "Mailbox",
  description:
    "White surface card per message. Bodies are plain text: entities decoded, markup inert, http(s) links only, quoted history behind Show quoted text. The last card is a hostile fixture: its <script>, <img onerror> and javascript: link must read as text.",
  render: () => (
    <div className="flex w-full flex-col gap-3">
      <MessageCardDemo id="m1" />
      <MessageCardDemo id="m2" />
      <MessageCardDemo id="m10" />
    </div>
  ),
}

export const mailboxFilterEntry: ShowcaseEntry = {
  id: "mailbox-filter",
  name: "Mailbox list and filter",
  group: "Mailbox",
  description:
    "Search plus a Select with counts (six options never clip at 320px). The list is a listbox: Arrow keys, Home and End move focus, Enter opens. Shown 320px wide.",
  render: () => <FilterDemo />,
}

export const mailboxBannerEntry: ShowcaseEntry = {
  id: "mailbox-banner",
  name: "Mailbox attention banner",
  group: "Mailbox",
  description:
    "Shown above the list when the connection needs a person: plain words and one action (the existing reconnect flow).",
  render: () => (
    <div className="flex w-full flex-col gap-4">
      <MailboxAttentionBanner
        email="founder@acme-outbound.com"
        reason="revoked"
        reconnectHref="#mailbox-banner"
      />
      <MailboxAttentionBanner
        email="founder@acme-outbound.com"
        reason="sync-error"
        reconnectHref="#mailbox-banner"
      />
    </div>
  ),
}

export const mailboxPageEntry: ShowcaseEntry = {
  id: "mailbox-page",
  name: "Mailbox page states",
  group: "Mailbox",
  description:
    "The whole page from fixtures: not connected, syncing (no backend signal yet), connected with no threads, populated, needs attention, sync error, no results, loading. Nothing real is read or changed.",
  render: () => <MailboxPageStates />,
}
