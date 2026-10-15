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
- `--ring` is `--text-strong`: the neutral focus ring for buttons and other controls.

### Brand

`--brand: #00aaf7`, used as `var(--brand)` or `bg-brand`.

- **Used for:** brand button backgrounds. Form-field focus uses the darker `--brand-focus: #0088c6` for the border and
  the 2px ring (3.93:1 on white, 3.77:1 on the canvas: passes the 3:1 non-text minimum that `#00aaf7` at 2.59:1 fails).
  The Field family also tints checked choice cards with brand.
- **Never used for:** text, links, icons, badges, section backgrounds or decoration.
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
  brightens it 4%; press scales to 0.97 and fades the highlight.

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

Why: a box-shadow ring takes no layout space, follows the border radius exactly and stacks with the lift, so surfaces
look crisp without a heavy outlined look. No other shadows.

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
- Buttons scale to 0.97 on press (`transition: scale 200ms ease-out`), only under `motion-safe`.
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
  `ghost`, `brand`, `danger`; sizes `sm` 28px, `md` 32px (default), `lg` 36px, plus `icon-sm`, `icon`, `icon-lg`.
  Padding scales with height and is slightly smaller on the icon side (`data-icon="inline-start|inline-end"`).
  `loading` keeps width and color. Focus-visible is a 2px neutral ring offset from the button. Hit area is at least
  24×24px.
- **Badge**: `neutral` (default), `outline`, `success`, `warning`, `danger`; `text-meta`, 6px radius, no animation.
- **Form fields**: Input, Textarea and SelectTrigger share one recipe (`fieldControlClassName`) ported from the
  landing page: 32px, 8px radius, cool-gray border, `--brand-focus` border and ring on focus, danger border and ring when
  `aria-invalid`, muted fill when disabled, `text-base md:text-sm` (16px on phones so iOS does not zoom).
- **Field family** (`components/ui/field.tsx`, the founder's file, used as-is): `FieldSet`, `FieldLegend`, `FieldGroup`, `Field` (vertical,
  horizontal, responsive), `FieldContent`, `FieldLabel`, `FieldTitle`, `FieldDescription`, `FieldSeparator`,
  `FieldError` (`role="alert"`, de-duplicated messages).
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
- Stroke 2 on the 24px grid (≈1.3px at 16px) matches 14px body text; use `strokeWidth={1.5}` next to `text-meta`.
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
