# Scrunity design system

Scrunity is a calm, dense, light-mode work tool (references: Attio, Linear, Vercel Geist). This document is the
reference for the foundations every screen sits on. The tokens live in `src/app/globals.css`; the hex values and the
contrast math also live in `src/lib/design/tokens.ts`. Every component is shown on the internal testing route
`/playground/components/document/testing` (platform admins only), including a **Foundations** page.

Light mode only for now. Every color is a CSS variable, so a dark palette can be added later as a separate set of
values (`next-themes` is kept with `forcedTheme="light"`). Existing `dark:` classes are inert.

## Color tokens

Token names describe purpose, not appearance. Components use semantic tokens, never hex values.

### Surfaces and borders

| CSS variable | Tailwind | Value | Purpose |
|---|---|---|---|
| `--canvas` (= `--background`) | `bg-canvas`, `bg-background` | `#f9fafb` | App background |
| `--surface` (= `--card`, `--popover`) | `bg-surface`, `bg-card` | `#ffffff` | Cards, panels, popovers, the main content panel |
| `--muted-fill` (= `--muted`, `--accent`) | `bg-muted` | `#f3f4f6` | Hover and selected fills |
| `--border-default` (= `--border`, `--input`) | `border-border` | `#e5e7eb` | Borders and dividers |
| `--border-strong` | `border-border-strong` | `#d1d5db` | Hover or emphasis borders |

`#d4d4d4` (1.48:1 on white) is a divider color at most, never text.

### Text

| CSS variable | Tailwind | Value | Use |
|---|---|---|---|
| `--text-strong` | `text-fg-strong` (also `text-foreground`) | `#0a0a0a` | Page titles, primary content (record names, table values) |
| `--text-default` | `text-fg-default` | `#262626` | Labels, UI text, section labels |
| `--text-muted` | `text-fg-muted` (also `text-muted-foreground`) | `#6b6b6b` | Descriptions, secondary text. 5.33:1 on white, 5.10:1 on canvas, 4.84:1 on the muted fill |
| `--text-subtle` | `text-fg-subtle` | `#a3a3a3` | **Placeholders and disabled text only** (2.52:1) |


### shadcn mapping

shadcn components read `--background`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`,
`--destructive`, `--border`, `--input` and `--ring`; all of them point at the tokens above.

- `--primary` is **neutral ink** (`--text-strong`, white foreground). It is not the brand color. `text-primary` and
  `bg-primary` therefore render near-black, never blue.
- `--secondary` is the white surface with `--text-default`.
- `--destructive` is `--danger`.
- `--ring` is `--brand`: every focus ring (see Focus below).

### Brand

`--brand: #00aaf7`, used as `var(--brand)` or `bg-brand`.

- **Used for two things only:** brand button backgrounds, and focus rings (every focus-visible state).
- **Never used for:** text, links, icons, badges, selected states, section backgrounds or decoration.
- **Rule (Attio's approach):** brand appears only where attention is genuinely needed. At most one brand button per
  view. Most screens have none.
- **Never a brand button inside repeated rows or lists** (table rows, cards in a grid, plan lists, draft lists). The
  same action is neutral there; it can be brand in a single-item view (e.g. Approve in the single-lead review dialog).
- Empty-state buttons are brand only when they are the single action on the screen.
- **Founder exceptions** (decided, not precedents):
  - **Selected main-nav item:** a solid brand fill (`--nav-selected-bg`). Its text and icon are one token,
    `--nav-selected-fg`, set to **white** (`var(--brand-foreground)`). White on `#00aaf7` is 2.59:1, below AA for
    14px text: a second founder decision, reviewed against near-black (`--text-strong`, 7.63:1), which is one line
    away. The contrast script reports it as `accepted`. The brand focus ring would disappear on a brand fill, so a
    focused selected item gets a 2px near-black ring behind a 2px canvas gap. Hover on unselected items stays neutral.
  - **"Review drafts"** in the Campaigns table is a brand button even though it repeats per row.
- Current brand placements: chat send (Home), start research, confirm profile, launch campaigns, confirm companies,
  start sending, Approve in the lead review dialog, New research run (Research page), Review drafts (Campaigns rows),
  create organization, pay / confirm seats in billing dialogs, landing CTA.
- **Brand button text:** `BRAND_BUTTON_TEXT = white` (founder's call, in `src/lib/design/tokens.ts`, mirrored by
  `--brand-foreground`). White on `#00aaf7` is **2.59:1**, below AA 4.5:1; near-black `#0a0a0a` is 7.63:1. Both are
  shown side by side at all three sizes on the testing route ("Brand button text"). To switch, set
  `BRAND_BUTTON_TEXT = "dark"` and `--brand-foreground: var(--text-strong)`.
- The brand button is drawn from `--brand` only: a top-to-bottom gradient from `--brand-top`
  (`color-mix(in srgb, var(--brand) 92%, white)` = `#14b1f8`) to `--brand-bottom` (`… 94%, black` = `#00a0e8`), a 1px
  inset white highlight at the top, a `--brand-edge` ring (`… 80%, black` = `#0088c6`) and a small drop shadow. Hover
  brightens it 4%; press scales to 0.96 and fades the highlight.

### Status

A tint background with darker text from the same family. **Green (success) is reserved for verified and completed
states.** Replied, sent and similar progress states are neutral, with an icon (Replied uses the mail-reply icon). Each pair is at least 4.5:1, and status is **always** paired
with a label or an icon, never color alone.

| Status | Text (`text-*`) | Tint (`bg-*-tint`) | Border (`border-*-border`) | Text on tint | Text on white |
|---|---|---|---|---|---|
| success | `#047857` | `#ecfdf5` | `#a7f3d0` | 5.21 | 5.48 |
| warning | `#b45309` | `#fffbeb` | `#fde68a` | 4.84 | 5.02 |
| danger | `#b91c1c` | `#fef2f2` | `#fecaca` | 5.91 | 6.47 |

No other colors in the UI. The one exception is the Google "G" logo (`components/ui/google-logo.tsx`), whose colors
Google's brand rules require; it appears on Google sign-in and the Connect Gmail / Connect Google buttons. Tailwind's `neutral` and `gray` scales are allowed; brand and status colors only through
their variables. Charts use the neutral `--chart-1..5` ramp.

Check every pair with `npx tsx scripts/report-contrast.ts` (exits 1 if a required pair fails).

## Typography

Inter via `next/font` (self-hosted woff2), antialiased (`-webkit-font-smoothing: antialiased`,
`-moz-osx-font-smoothing: grayscale` on the root).

| Utility | Size / line height | Weight | Use |
|---|---|---|---|
| `text-title` | 24 / 32 | 600 | Page titles, Home greeting |
| `text-composer` | 15 / 24 | 400 | Agent composer input and agent responses |
| `text-section` | 15 / 22 | 500 | Section labels (`text-fg-default`) |
| `text-body` | 14 / 20 | 400 | Everything else |
| `text-meta` | 12 / 16 | 500 | Badges, timestamps, keyboard hints |

- `tabular-nums` on numbers in tables, counters, credits and timestamps.
- Headings get `text-wrap: balance` and paragraphs `text-wrap: pretty` (set globally).
- `white-space: nowrap` on labels and badges.
- Sentence case everywhere.
- `cn` (`src/lib/utils.ts`) registers these five names as font sizes; otherwise the class merge would treat them as
  colors and drop them.

## Radius

| Utility | Value | Use |
|---|---|---|
| `rounded-sm` | 6px | Badges, small controls, menu items |
| `rounded-md` | 8px | Buttons, inputs |
| `rounded-lg` | 10px | Cards, popovers, menus |
| `rounded-xl` | 12px | Composer, dialogs |

Nested radii are concentric: outer radius = inner radius + padding (a 10px menu with 4px padding holds 6px items).

## Depth: shadows instead of borders

| CSS variable | Tailwind | Use |
|---|---|---|
| `--border-shadow` (flat 1px ring) | `shadow-surface` | Replaces `border` on flat surfaces in the page: the main content panel, table wrappers, list containers, static cards |
| `--shadow-border-sm` (ring + slight lift) | `shadow-raised` | Small raised controls: secondary and outline buttons, segmented controls, dropdown and select triggers, small cards |
| `--shadow-border` (ring + clearer lift) | `shadow-floating` | Things above the page: the agent composer, popovers, menus, dialogs, toasts |

Keep real borders in three places only:

1. Form fields, because their border color changes on focus and when invalid.
2. Single-side dividers between rows, list items and sections (a shadow cannot draw one side).
3. Dashed placeholders.

Every shadow-ring surface also has `border: 1px solid transparent` (`border border-transparent`): forced-colors mode
drops box-shadow and paints that border, so the edge survives. Selected states may use a real border (better-ui).

Why: a box-shadow ring takes no layout space, follows the border radius exactly and stacks with the lift, so surfaces
look crisp without a heavy outlined look. No other shadows.

## Focus

shadcn's default focus pattern, in brand. Defined once as the `focus-ring` utility in `globals.css`:

```css
@utility focus-ring {
  @apply border-ring ring-[3px] ring-ring/50; /* --ring = --brand */
  outline: 2px solid transparent;             /* becomes visible in forced-colors mode */
  outline-offset: 2px;
}
```

- Components apply it with `ui-focus:focus-ring` (focus-visible, or `data-force="focus-visible"` on the testing route, so
  forced focus is identical to real focus): Input, Textarea, Select trigger, every Button variant (so the dropdown
  trigger too), clickable cards and choice cards. Plain links get the same 3px ring from a base rule.
- **It stacks with the depth tokens.** Tailwind's ring and shadow utilities write separate variables
  (`--tw-ring-shadow`, `--tw-shadow`) into one `box-shadow`, so a focused secondary button keeps `shadow-raised`, a
  brand button keeps its highlight and lift, and a clickable card keeps `shadow-surface`. Controls carry a transparent
  1px border so `border-ring` has something to color.
- **Motion:** the ring eases in with `transition-[color,border-color,box-shadow]` (plus the control's other properties)
  over 150ms ease-out, the landing field's feel; `motion-reduce:transition-none` turns it off under reduced motion.
- **Menu and select items** use the highlighted background (`data-highlighted:bg-muted`), not a ring.
- **Forced colors:** box-shadow disappears there, so the transparent 2px outline becomes the indicator.
- **Contrast:** the brand ring measures 2.59:1 on white (and is drawn at 50% opacity). This is the founder's accepted
  decision; the contrast script reports it as `accepted`.

## Spacing

4px base. The space between groups is at least twice the space between items in a group (8px between items, 16px or
more between groups).

## Motion

Use the transitions.dev skill (`.agents/skills/transitions-dev`) for every transition and animation, and follow it
over generic choices.

- **The split:** `--motion-fast` 150ms, `--motion-base` 200ms, `--motion-slow` 300ms and `ease-enter`
  (`cubic-bezier(0.23, 1, 0.32, 1)`) are for **micro-interactions** only: press, hover and color changes on controls.
  **Real animations** (things that appear, disappear or move: menus, dialogs, tooltips, toasts, panels, text swaps)
  use the transitions skill's own tokens and per-transition variables (`--dropdown-*`, `--modal-*`, `--tt-*`, …).
  The two scales share names but not values (the skill's `--duration-fast` is 250ms), which is why ours are
  prefixed `--motion-*`.
- Menus and select popups use the skill's menu dropdown (`.t-dropdown`: 250ms in, 150ms out, from scale 0.97,
  origin-aware); dialogs use its modal (`.t-modal`, `.t-modal-backdrop`: 250ms in, 150ms out, scale 0.96). Both are
  adapted to Base UI's `data-starting-style` / `data-ending-style` attributes. Tooltips use its tooltip transition
  (`.t-tt-popup`: 80ms appear delay via the TooltipProvider, 150ms fade + scale from 0.98 in, 50ms out) as a white
  floating bubble.
- Buttons scale to **0.96** on press over **150ms ease-out** (better-ui), never while disabled, only under
  `motion-safe`; `<Button static>` opts out.
- Under reduced motion, overlays (menus, select, dialog, tooltip) keep a 150ms opacity cross-fade instead of
  appearing instantly (better-ui); scale is removed.
- Overlays that scroll (dialog, menus, select) use `overscroll-behavior: contain`.
- Never `transition: all`; list the properties.
- Hover styles only apply on devices that can hover (Tailwind's `hover:` and the `ui-hover:` variant both use
  `@media (hover: hover)`); animations run only under `prefers-reduced-motion: no-preference` (`motion-safe:`), and
  every transitions.dev snippet keeps its reduced-motion guard.
- No pulsing or breathing animation on status badges. Skeletons may pulse.

### Forcing states

`ui-hover:`, `ui-pressed:` and `ui-focus:` (in `globals.css`) behave like `hover:`, `active:` and `focus-visible:`
but also match `data-force="hover|pressed|focus-visible"`. The testing route uses them to show every state at once.
Use them for interactive styles in `components/ui`.

## Components

- **Button** (`components/ui/button.tsx`): variants `secondary` (default: white with `shadow-raised`), `outline`,
  `ghost`, `brand`, `danger`; sizes `sm` 28px (padding 10px, icon side 8px), `md` 32px (12px / 10px, default), `lg`
  36px (14px / 12px), plus `icon-sm`, `icon`, `icon-lg`. Mark icons with `data-icon="inline-start|inline-end"` to get
  the 2px-smaller icon-side padding. Icons next to the label sit 0.5px low (a sentence-case Inter label reads below
  its line box's center) with a 2px stroke (medium text). `loading` keeps width and color; `static` disables the
  press scale. 8px radius; transparent 1px border under the shadow ring. Hit area is at least 24×24px.
- **Badge**: one treatment, a tint fill with no ring: `neutral` (default), `success`, `warning`, `danger`. 20px tall,
  `text-meta`, 6px radius, 6px text-side padding and 4px on a leading icon's side, icons always 14px (outline icons at a
  1.5px stroke; status badges use the solid set in `components/icons/status`) and shifted by `--badge-icon-offset`
  (globals.css, tune by hand). `max-w-full`: a long label truncates and the full text is in the `title`. No animation.
- **Card**: 10px radius, `shadow-surface` over a transparent border, 16px padding (`size="sm"`: 12px) and 16px
  between sections. `CardHeader` takes an optional `CardLeading` (32px logo or initials, 8px radius, 12px from the
  text), `CardTitle` (`text-section`) and `CardDescription`, a quiet metadata row 2px below (separate items with
  `CardMetaDot`). `CardFooter` holds actions under a 1px divider. Clickable cards use `interactive` and render as the
  link (`render={<Link href=… />}`): hover lifts 1px and steps up to `shadow-floating` over 150ms ease-out; static
  cards have no hover. Flush children (footer, full-bleed media) inherit the card corners; the leading visual is not
  evenly inset, so it keeps its own 8px token.
- **Menus and select popups**: 10px radius, 4px padding, transparent 1px border, so items are concentric at 5px.
- **Form fields**: Input, Textarea and SelectTrigger share one recipe (`fieldControlClassName`) ported from the
  landing page: 32px, 8px radius, cool-gray border, the shared brand focus ring, danger border and ring when
  `aria-invalid`, muted fill when disabled, `text-base md:text-sm` (16px on phones so iOS does not zoom).
- **Field family** (`components/ui/field.tsx`, the founder's file, used as-is): `FieldSet`, `FieldLegend`, `FieldGroup`, `Field` (vertical,
  horizontal, responsive), `FieldContent`, `FieldLabel`, `FieldTitle`, `FieldDescription`, `FieldSeparator`,
  `FieldError` (`role="alert"`, de-duplicated messages). Errors use `--danger`; a checked choice card gets a
  `--text-strong` border on the canvas fill (a selected state, so not brand); links in descriptions turn strong and
  underlined on hover.
- **EmptyState** (`components/ui/empty-state.tsx`): optional illustration, a bold `text-section` title, at most two
  lines of description, actions, and an optional "Learn more" card (a white `shadow-surface` link card; only with a
  real destination). `size="sm"` for tight places; DataTable's empty and error messages use it. `role="alert"` for
  errors, `role="status"` when it replaces content after an action.
- **Illustrations** (`components/ui/illustrations/`): original single-color line drawings in inline SVG, strokes in
  `currentColor` (set with `text-fg-subtle` or `text-fg-muted`), 1.5px non-scaling strokes, `aria-hidden`, about 160px
  wide and fine at any size. `MailThreadsIllustration`: an open envelope with a letter and a short stack of thread
  lines.
- **Primitives library:** Base UI (`@base-ui/react`). Do not add a second primitive library.

## Data table

`src/components/ui/data-table/` (`DataTable`, cells, `FilterChips`, `useUrlFilter`). Used by Campaigns and Research;
Companies, People and Deals reuse it. Shown on the testing route with every state.

- **Surface:** white, `shadow-surface`, 10px radius. Inside, only single-side hairlines: under the header and under
  each row. No cell borders, no zebra stripes, no row colors for status.
- **Density:** 36px rows (`density="compact"`: 32px), 12px horizontal cell padding, `text-body` cells, `text-meta`
  muted headers in sentence case (never uppercase).
- **Semantics:** a real `<table>` with `aria-label`, `<th scope="col">`. It scrolls inside a focusable region
  (`role="region"`, `aria-label`, `tabIndex=0`; the surface shows the focus ring). The header is sticky when the region
  has a max height. Below 768px the first column sticks and the rest scrolls sideways; content never shrinks to fit,
  and the name column is narrower there so the next column always peeks in as a cue.
- **Column types:** `text` (truncates, full value in `title`), `entity` (16px logo or letter tile + name, the row's
  link), `status` (semantic `Badge` with a label and icon; never a per-category hue), `date` (`<time>`, relative or
  absolute, rendered after hydration), `number` (right-aligned, `tabular-nums`; "found / target" form), `actions`
  (right-aligned, header for screen readers only).
- **Sorting:** a column with `sortValue` gets a real `<button>` in its header (Hugeicons arrow glyph) and the sorted
  `<th>` gets `aria-sort`. Client-side; missing values sort last.
- **Row link:** the entity cell holds the one focusable link per row (keyboard, screen readers, middle-click).
  `rowHref` adds a mouse-only twin (`tabIndex=-1`, `aria-hidden`) over every other non-action cell, so the whole row
  is clickable. Not one `::after` stretched over the `<tr>`: WebKit ignores `position: relative` on table rows and
  sent clicks to the wrong row. Never `onClick` on `<tr>`. Action controls stay separate tab stops.
- **States:** `loading` (skeleton rows), `empty` and `error` (one centered `DataTableMessage`: title, one line, one
  action; drawn in the surface, outside the scrolling table). Over `pageSize` (25) rows: a Previous/Next pager.
- **Not built, on purpose:** row selection, bulk actions, column calculations, "add column", column visibility. No
  dead UI.
- **Filter chips** (`FilterChips`): compact toggle buttons (`aria-pressed`) with counts; "All" first, then only chips
  with results. The selected chip is the strong-ink fill (a selected state, not brand). Keep the value in the URL
  with `useUrlFilter` (`?status=`), so it survives refresh and back.
- Status words are plain (`components/gtm/pipeline-status.tsx`): never raw snake_case in the UI.

## Container

`src/components/layout/container.tsx`. A centered wrapper with 16px side padding on mobile, 24px at `sm` and 32px at
`lg`. It has no background: the app shell owns the background, so a Container can sit on the canvas or a white panel.

| `width` | Max width | Use |
|---|---|---|
| `prose` | 720px | Chat and the agent composer |
| `page` (default) | `max-w-7xl` | Settings and forms |
| `full` | none | CRM tables, which use the full width |

## Icons

Hugeicons free set (`@hugeicons/core-free-icons`, MIT; Stroke Rounded), imported only through
`src/components/ui/icons.tsx` (or `HugeiconsIcon` directly inside `components/ui`). Lucide and Phosphor are removed.

- Sizes: 16px default (`size-4`), 14px in dense rows (`size-3.5`), 20px large (`size-5`).
- Stroke is drawn in rendered pixels (`vector-effect: non-scaling-stroke`, the `.ui-icon` rule): **1.5px** next to
  regular text (400), **2px** next to medium or semibold text (buttons, badges set `--icon-stroke: 2px`), per better-ui.
- Decorative icons are `aria-hidden` (the default). Icon-only buttons need an `aria-label`.
- Icons are neutral: they take the text color around them, never brand.

## App shell

`src/components/shell/`, mounted once by `app/dashboard/layout.tsx`. Every authenticated route renders inside it; no
page draws its own sidebar or top bar.

- **Layout:** a CSS grid. Fixed 240px sidebar column, 48px top bar, and the main region (`<main id="main">`), which is
  the only part that scrolls. Sidebar and main both sit on the canvas (`bg-canvas`), split by one single-side divider
  (`border-e`). Cards inside main are white surfaces with shadow tokens.
- **Sidebar, top to bottom:** workspace menu (Settings, Billing, Sign out), main nav, the collapsible **Chats** group
  (recent chats and a "New chat" link to Home), credits pill pinned at the bottom (links to Billing).
- **Nav config rule:** the nav is the `NAV_ITEMS` array in `shell/nav-config.ts`. Only routes that exist and work
  today go in it: no placeholders, no "coming soon", no dead links. A new section (Inbox, Tasks, Companies, People,
  Deals, Lists) is one new line once its route ships. Settings and Billing live in the workspace menu.
- **Rows** (`SidebarItem`): 32px, 6px radius, 16px icon, `text-body` medium. Hover fills with `--muted-fill` (only on
  rows that are not current). The current page carries `aria-current="page"`: main nav (`tone="nav"`) is the brand
  fill described under Brand; chat rows and the menu trigger (`tone="list"`) are a white chip (`bg-surface
  shadow-raised`). Section labels are `text-meta` muted.
- **Collapsible groups** (`SidebarGroup`): the trigger is a button with `aria-expanded`/`aria-controls`; a closed body
  is `inert`. Open/closed is remembered per user in localStorage (every access in try/catch; renders with the default
  without it). The body uses the transitions.dev accordion and animates only after the first toggle, so a remembered
  state restored on load does not play. No motion under reduced motion.
- **Top bar:** breadcrumb on the left (current page, plus a linked parent where one exists, from `breadcrumbsFor`).
  The right side stays empty: no Help or search control without a real destination.
- **Below 768px:** the sidebar becomes a drawer (Base UI Dialog) opened from the top bar's menu button. Focus is
  trapped, Escape closes, focus returns to the trigger, and following a link closes it. Panel-reveal timing (400ms
  in, 350ms out); opacity only under reduced motion.
- **Keyboard:** a "Skip to content" link is the first focusable element; tab order is sidebar → top bar → main.

## Home

`/dashboard` (`components/home/`). Container `prose`, top to bottom with 64px between blocks:

1. **Greeting** (`text-title`): "Good morning, Ayush." The time of day comes from the viewer's clock after mount; the
   line's height is reserved, so nothing moves and hydration matches. First name from the session, or no name.
2. **Agent composer** (`components/chat/agent-composer.tsx`): white card, `shadow-floating`, radius 12, 12px padding.
   Auto-growing textarea, 1 to 8 lines, `text-composer` (16px on phones so iOS does not zoom). Enter sends,
   Shift+Enter adds a line, Enter while an IME is composing never sends. Round brand send button (icon only,
   `aria-label="Send"`), disabled while empty, `loading` while sending. The whole card takes the focus ring while the
   textarea has focus. This is Home's one brand button.
3. **Needs you**: campaigns waiting on the user (stopped, emails to approve, approved emails to send, companies to
   choose). At most 5 rows; "View all" goes to Campaigns when there are more.
4. **Today**: sends (grouped per campaign), replies and booked meetings on the viewer's local day. Rendered after
   hydration because "today" depends on the viewer's timezone; it sits last, so nothing above it shifts.
5. **Empty sections disappear.** No empty-state blocks for Needs you or Today.
6. **First run** (nothing in either section and no chats): three starter prompts under the composer. Choosing one fills
   the composer; it never sends.

Rows are `FeedRow`: a compact white card that is itself the link (icon, one-line title, one-line context, trailing
action or time). Sections are `FeedSection` with a `text-section` header and a muted count or date. Only real data
sources feed them (`lib/data/home.ts`); never placeholder rows.

**Home → chat.** Sending creates a chat (`POST /api/gtm/chat/conversations`), hands the prompt to the chat page
(`chat-events.ts`) and navigates to `/dashboard/chat?id=…`, where the existing agent flow sends it. Both composers are
a React `<ViewTransition name="agent-composer">`, so the card moves to its chat position (250ms, smooth-out) while
the rest of the page cross-fades (150ms out, 250ms in). Reduced motion: instant swap. The chat page has no Suspense
boundary on purpose: the pair only forms when the new page commits with the navigation.

## Mailbox

`/dashboard/mailbox` (`components/mailbox/`). Sent outreach threads and classified replies from Scrunity campaigns
only, never the person's whole inbox. Every empty and syncing message says so.

### Information hierarchy

The list answers "open this or not?" in a glance; the thread answers "what happened and what do I do?". A row is two
lines.

| Information | Where | Why |
|---|---|---|
| Thread status (bounced, reply class, or "Sent" with no reply yet) | Row line 2 (icon + label) and thread header | The single deciding fact. One status per thread, by priority: bounced > reply class > sent |
| Unread (has a reply or bounce) | Row: dot + semibold name | What changed. No read state is stored, so "unread" means "has inbound activity" |
| Contact name | Row line 1, thread header | Who it is |
| Company | Row line 1 (muted, truncates first), thread header | Who it is, second |
| Last activity time | Row line 1 (compact: time today, weekday this week, else date) | How recent |
| Latest message snippet (decoded) | Row line 2, after the status | What they said |
| Subject | Thread header | Outreach subjects repeat across a campaign, so they do not help scanning |
| Title (role) | Thread header | Useful once open, noise in a 50-row scan |
| Campaign | Thread header, as a "View campaign" link | Context, not a reason to open |
| Contact email | Thread header (muted) | Needed to act, not to scan |
| From/to addresses | Message card (muted, under the sender) | Only matters per message |
| Exact send time | Message card | Minute precision only matters per message |
| Message count, first-sent date | Thread header meta line | Context once open |
| Bounce reason | Thread body banner, in plain words | Explains the status |
| Message bodies | Thread body, plain text | The content |
| Actions | Thread header: View campaign, Open lead | Act on the thread once it is open; rows carry no actions |

Not available (fields we would want): a stored read state (so no "mark read"), full reply bodies (replies keep the
provider snippet only), other participants (cc), sync status or last-synced time, attachments, a per-thread
reply/compose path.

### Status badges

| Thread status | Badge | Icon |
|---|---|---|
| Bounced | danger | solid x-circle |
| Interested | neutral | sparkles |
| Question | neutral | message |
| Not interested | neutral | x-circle (outline) |
| Auto-reply | neutral | bot |
| Unclear | neutral | help-circle |
| Sent, no reply yet | neutral | send |

Green stays reserved for verified and completed states, so no reply class is green. No per-category hues: the icon
and label carry the meaning.

### States

Not connected (Connect Gmail, the existing OAuth flow) · syncing (skeleton rows, no fake progress; announced politely
when done; no backend signal yet, so it is a component state only) · connected with no threads · populated · needs
attention (mailbox revoked: banner with Reconnect) · no search/filter results · loading. All of them render from
fixtures on the testing route.

### Email bodies are untrusted

Bodies and snippets are rendered as **plain text, never HTML** (`lib/email-text.ts` + `EmailBody`): HTML entities are
decoded by a small explicit decoder (no `innerHTML`), so `&#39;` reads as an apostrophe and `<script>` stays visible
text. Line breaks are kept; only `http(s)` URLs become links (`target="_blank" rel="noopener noreferrer"`); quoted
history ("On … wrote:" and `>` lines) collapses behind "Show quoted text".

## Interface rules

**Accessibility**
- Text meets WCAG AA (4.5:1) against its background; check with the contrast script.
- Never signal status with color alone: pair it with a label or an icon.
- Every interactive element has a visible focus state and a hit area of at least 24×24px.
- Icon-only buttons have an `aria-label`; errors use `role="alert"`.

**Writing**
- Button labels start with a verb: "Launch campaign", "Save changes", not "OK" or "Submit".
- Sentence case everywhere, including titles and buttons.
- Empty states explain what belongs there and offer one action.
- Say what happened and what to do next in errors; no vendor names or internal ids.

**Layout**
- One brand button per view at most; most views have none.
- Surfaces use the three shadow tokens instead of borders (exceptions above).
- Numbers use `tabular-nums`.
