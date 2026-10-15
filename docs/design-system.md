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
- Current brand placements: chat send (Home), start research, confirm profile, launch campaigns, confirm companies,
  start sending, Approve in the lead review dialog, create organization, pay / confirm seats in billing dialogs,
  landing CTA.
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
- **Primitives library:** Base UI (`@base-ui/react`). Do not add a second primitive library.

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
