import {
  FeedRow,
  FeedSection,
  FeedSectionHeader,
} from "@/components/home/feed-row"
import { SidebarItem } from "@/components/shell/sidebar-item"
import { CreditsPill } from "@/components/shell/sidebar-content"
import {
  AlertTriangle,
  Building2,
  Calendar,
  Home,
  Mail,
  MailReply,
  Send,
} from "@/components/ui/icons"
import {
  ComposerDemo,
  GroupDemo,
  SidebarDemo,
  NEAR_BLACK_NAV_TEXT,
} from "./shell-demos"
import type { ForcedStateProps, ShowcaseEntry, StateName } from "./types"

const LINK_STATES: StateName[] = ["default", "hover", "focus-visible"]

const linkForce = (
  props: ForcedStateProps
): "hover" | "focus-visible" | undefined =>
  props["data-force"] === "pressed" ? undefined : props["data-force"]

function SelectedNavItem({
  nearBlack = false,
  force,
}: {
  nearBlack?: boolean
  force?: "hover" | "focus-visible"
}) {
  return (
    <div className="w-48" style={nearBlack ? NEAR_BLACK_NAV_TEXT : undefined}>
      <SidebarItem
        href="#sidebar"
        icon={Home}
        label="Home"
        tone="nav"
        current
        data-force={force}
      />
    </div>
  )
}

export const sidebarEntry: ShowcaseEntry = {
  id: "sidebar",
  name: "Sidebar",
  group: "Shell",
  description:
    'Rows: 32px, 6px radius, 16px icon, 14/20 medium label; hover fills with --muted-fill. The current main-nav item is a solid brand fill (founder exception) with aria-current="page"; its text and icon are one token, --nav-selected-fg. White (2.59:1, below AA; founder decision, the default) and near-black (7.63:1) side by side. Focus on it is a near-black ring behind a canvas gap. Click "Chats" to collapse a group.',
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <figure className="flex flex-col gap-2">
        <figcaption className="text-meta text-fg-muted">
          White text (default, founder decision) · 2.59:1
        </figcaption>
        <SidebarDemo />
      </figure>
      <figure className="flex flex-col gap-2">
        <figcaption className="text-meta text-fg-muted">
          Near-black text · 7.63:1
        </figcaption>
        <SidebarDemo selectedText="near-black" />
      </figure>
      <figure className="flex flex-col gap-2">
        <figcaption className="text-meta text-fg-muted">
          Chats collapsed
        </figcaption>
        <SidebarDemo chatsOpen={false} />
      </figure>
    </div>
  ),
  states: [
    {
      label: "nav item",
      supports: LINK_STATES,
      render: (props) => (
        <div className="w-48">
          <SidebarItem
            href="#sidebar"
            icon={Home}
            label="Campaigns"
            tone="nav"
            data-force={linkForce(props)}
          />
        </div>
      ),
    },
    {
      label: "selected (white, default)",
      supports: LINK_STATES,
      render: (props) => <SelectedNavItem force={linkForce(props)} />,
    },
    {
      label: "selected (near-black)",
      supports: LINK_STATES,
      render: (props) => <SelectedNavItem nearBlack force={linkForce(props)} />,
    },
    {
      label: "chat row (selected)",
      supports: LINK_STATES,
      render: (props) => (
        <div className="w-48">
          <SidebarItem
            href="#sidebar"
            label="Draft a follow-up"
            current
            className="font-normal"
            data-force={linkForce(props)}
          />
        </div>
      ),
    },
    {
      label: "group (click to toggle)",
      supports: LINK_STATES,
      render: (props) => (
        <div className="w-48">
          <GroupDemo data-force={linkForce(props)} />
        </div>
      ),
    },
    {
      label: "credits pill",
      supports: LINK_STATES,
      render: (props) => (
        <CreditsPill credits={1792} data-force={linkForce(props)} />
      ),
    },
  ],
}

export const composerEntry: ShowcaseEntry = {
  id: "agent-composer",
  name: "Agent composer",
  group: "Shell",
  description:
    "White floating card (radius 12), auto-growing textarea from 1 to 8 lines, 15/24 text (16px on phones). Enter sends, Shift+Enter adds a line, IME-safe. Round brand send button, disabled while empty, spinner while sending.",
  render: () => (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <ComposerDemo />
      <ComposerDemo initialValue="Find logistics companies in Texas with 50 to 200 people" />
      <ComposerDemo
        initialValue={
          "Find logistics companies in Texas\nwith 50 to 200 people\nthat raised money in the last year"
        }
      />
    </div>
  ),
  states: [
    {
      label: "empty",
      supports: ["default", "focus-visible", "disabled"],
      render: (props) => (
        <ComposerDemo
          disabled={props.disabled}
          data-force={
            props["data-force"] === "focus-visible"
              ? "focus-visible"
              : undefined
          }
        />
      ),
    },
    {
      label: "filled",
      supports: ["default", "focus-visible", "disabled", "loading"],
      render: (props) => (
        <ComposerDemo
          initialValue="Who replied this week?"
          disabled={props.disabled}
          sending={props.loading}
          data-force={
            props["data-force"] === "focus-visible"
              ? "focus-visible"
              : undefined
          }
        />
      ),
    },
  ],
}

export const feedRowEntry: ShowcaseEntry = {
  id: "feed-row",
  name: "Home feed rows",
  group: "Shell",
  description:
    "Compact link cards for Home's Needs you (trailing action) and Today (trailing time) sections. The section header is a 15/22 title with a muted count or date. Sections with no rows render nothing.",
  render: () => (
    <div className="flex w-full max-w-xl flex-col gap-12">
      <FeedSection id="showcase-needs-you" title="Needs you" meta={3}>
        {[
          <FeedRow
            key="a"
            href="#feed-row"
            icon={AlertTriangle}
            title="Campaign stopped"
            context="Early-stage SaaS startups"
            trailing="Open"
          />,
          <FeedRow
            key="b"
            href="#feed-row"
            icon={Mail}
            title="12 emails waiting for approval"
            context="Mid-market logistics"
            trailing="Review"
          />,
          <FeedRow
            key="c"
            href="#feed-row"
            icon={Building2}
            title="Choose which companies to contact"
            context="Boutique B2B agencies"
            trailing="Review"
          />,
        ]}
      </FeedSection>
      <FeedSection id="showcase-today" title="Today" meta="Friday, October 16">
        {[
          <FeedRow
            key="d"
            href="#feed-row"
            icon={MailReply}
            title="Reply from Dana Whitfield"
            context="Northwind Analytics · Interested"
            trailing={
              <span className="text-meta text-fg-muted tabular-nums">
                2:14 PM
              </span>
            }
          />,
          <FeedRow
            key="e"
            href="#feed-row"
            icon={Calendar}
            title="Meeting with Priya Raman"
            context="Lattice Freight"
            trailing={
              <span className="text-meta text-fg-muted tabular-nums">
                4:30 PM
              </span>
            }
          />,
          <FeedRow
            key="f"
            href="#feed-row"
            icon={Send}
            title="8 emails sent"
            context="Mid-market logistics"
            trailing={
              <span className="text-meta text-fg-muted tabular-nums">
                9:05 AM
              </span>
            }
          />,
        ]}
      </FeedSection>
      <FeedSectionHeader
        id="showcase-header"
        title="Section header"
        meta={42}
      />
    </div>
  ),
  states: [
    {
      label: "needs you row",
      supports: LINK_STATES,
      render: (props) => (
        <div className="w-80">
          <FeedRow
            href="#feed-row"
            icon={Mail}
            title="12 emails waiting for approval"
            context="Mid-market logistics"
            trailing="Review"
            data-force={linkForce(props)}
          />
        </div>
      ),
    },
    {
      label: "today row",
      supports: LINK_STATES,
      render: (props) => (
        <div className="w-80">
          <FeedRow
            href="#feed-row"
            icon={MailReply}
            title="Reply from Dana Whitfield"
            context="Northwind Analytics · Interested"
            trailing={
              <span className="text-meta text-fg-muted tabular-nums">
                2:14 PM
              </span>
            }
            data-force={linkForce(props)}
          />
        </div>
      ),
    },
  ],
}
