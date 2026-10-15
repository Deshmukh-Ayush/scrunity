import {
  FeedRow,
  FeedSection,
  FeedSectionHeader,
} from "@/components/home/feed-row"
import { SidebarGroup, SidebarItem } from "@/components/shell/sidebar-item"
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
import { ComposerDemo, SidebarDemo } from "./shell-demos"
import type { ForcedStateProps, ShowcaseEntry, StateName } from "./types"

const LINK_STATES: StateName[] = ["default", "hover", "focus-visible"]
const noop = () => {}

const linkForce = (
  props: ForcedStateProps
): "hover" | "focus-visible" | undefined =>
  props["data-force"] === "pressed" ? undefined : props["data-force"]

export const sidebarEntry: ShowcaseEntry = {
  id: "sidebar",
  name: "Sidebar",
  group: "Shell",
  description:
    '32px rows, 6px radius, 16px icon, 14/20 medium label. Hover fills with --muted-fill; the current page is a white chip with aria-current="page". Groups collapse with the accordion transition.',
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <SidebarDemo />
      <SidebarDemo chatsOpen={false} />
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
            data-force={linkForce(props)}
          />
        </div>
      ),
    },
    {
      label: "selected",
      supports: LINK_STATES,
      render: (props) => (
        <div className="w-48">
          <SidebarItem
            href="#sidebar"
            icon={Home}
            label="Home"
            current
            data-force={linkForce(props)}
          />
        </div>
      ),
    },
    {
      label: "group (collapsed)",
      supports: LINK_STATES,
      render: (props) => (
        <div className="w-48">
          <SidebarGroup
            label="Chats"
            open={false}
            onOpenChange={noop}
            data-force={linkForce(props)}
          >
            <span />
          </SidebarGroup>
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
