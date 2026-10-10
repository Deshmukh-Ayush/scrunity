---
colors:
  primary:
    100: "#00aff9"
    90: "rgba(0, 175, 249, 0.90)"
    40: "rgba(0, 175, 249, 0.40)"
    20: "rgba(0, 175, 249, 0.20)"
    16: "rgba(0, 175, 249, 0.16)"
    12: "rgba(0, 175, 249, 0.12)"
    8: "rgba(0, 175, 249, 0.08)"
    4: "rgba(0, 175, 249, 0.04)"
  secondary:
    100: "#262626"
    foreground: "#ffffff"
  tertiary:
    100: "#fa5d19"
    hover: "#e04e10"
    40: "rgba(250, 93, 25, 0.40)"
    20: "rgba(250, 93, 25, 0.20)"
    16: "rgba(250, 93, 25, 0.16)"
    12: "rgba(250, 93, 25, 0.12)"
    8: "rgba(250, 93, 25, 0.08)"
    4: "rgba(250, 93, 25, 0.04)"
    foreground: "#ffffff"
  surfaces:
    light:
      background: "#ffffff"
      card: "#ffffff"
      muted: "#f5f5f5"
      border: "#e5e5e5"
      foreground: "#171717"
    dark:
      background: "#121212"
      card: "#1e1e1e"
      muted: "#262626"
      border: "rgba(255, 255, 255, 0.10)"
      foreground: "#f5f5f5"
  accents:
    success: "#10b981"
    warning: "#f59e0b"
    destructive: "#ef4444"
    info: "#fa5d19"
typography:
  fonts:
    sans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    mono: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    serif: "Instrument Serif, Georgia, serif"
  scale:
    micro: "10px"
    badge: "11px"
    compact: "12px"
    regular: "13px"
    body: "14px"
    subhead: "16px"
    card_title: "18px"
    section_title: "20px"
    display: "36px"
spacing:
  base: "4px"
  density: "compact"
  scales:
    1: "4px"
    2: "8px"
    3: "12px"
    4: "16px"
    5: "20px"
    6: "24px"
    8: "32px"
    10: "40px"
    12: "48px"
    16: "64px"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
components:
  button:
    height_default: "28px"
    height_sm: "24px"
    height_xs: "20px"
  table:
    row_height: "40px"
    font_size: "12px"
  badge:
    height: "20px"
    font_size: "10px"
    radius: "9999px"
---

# Scrunity Design System

## 1. Overview

The Scrunity Design System defines the visual architecture, component contracts, and interaction standards for Scrunity's autonomous GTM and cold outreach platform. Adapted structurally from Firecrawl's proven developer-first aesthetic, Scrunity combines high-density data visualization with crisp typographic hierarchy, near-neutral surfaces, and a signature two-accent color model.

### 1.1 Core Tenets
1. **Calm Precision & High Information Density:** Complex operational workflows (multi-stage scraping pipelines, throttled Gmail dispatch queues, email thread classification) require dense, low-noise interfaces. Whitespace is disciplined (4px/8px baselines), micro-typography is sharp and readable, and tables maintain compact 40px rows without visual clutter.
2. **Signature Brand Blue (`#00aff9`):** One primary brand anchor represents Scrunity's core identity. It is deployed systematically across an intentional opacity ramp (from 4% subtle hover washes up to 100% solid fills) for active navigation states, primary call-to-actions, selection bounds, and focus rings.
3. **Operational Heat Orange (`#fa5d19`):** Firecrawl's primary heat orange is adapted as Scrunity's tertiary accent. It provides immediate visual heat for live operational states: active AI agent loops, autonomous background pollers, inbound prospect reply inquiries, unread notifications, and high-priority intent tags.
4. **Near-Neutral Surfaces & High Contrast:** Surfaces are strictly neutral and zero-saturated. Backgrounds transition cleanly between pure white (`#ffffff` / `oklch(1 0 0)`) in light mode and deep charcoal (`#121212` / `oklch(0.145 0 0)`) in dark mode, maintaining WCAG AA compliant text contrast across all viewports.
5. **Single Source of Truth in Code:** Tokens are not abstract design artifacts; they are implemented as live CSS custom properties in `src/app/globals.css` wired directly into Tailwind CSS v4's `@theme` block and shadcn component primitives. Modifying a single token variable propagates across all components, badges, and dashboard screens.

---

## 2. Color System

### 2.1 Primary Brand Palette (`#00aff9`)
Scrunity's signature color replaces traditional generic SaaS blues. It expresses brand identity through an explicit opacity ramp:

| Token Name | Value | Alpha | Semantic Function |
|---|---|---|---|
| `--color-primary` / `--color-primary-100` | `#00aff9` | 100% | Primary buttons, active navigation text/icons, key conversion CTAs |
| `--color-primary-90` | `rgba(0, 175, 249, 0.90)` | 90% | Hover state for primary solid buttons |
| `--color-primary-40` | `rgba(0, 175, 249, 0.40)` | 40% | Active selection borders, focused input outlines |
| `--color-primary-20` | `rgba(0, 175, 249, 0.20)` | 20% | Interactive focus ring halos, selected nav border accents |
| `--color-primary-16` | `rgba(0, 175, 249, 0.16)` | 16% | Dark mode active row fills, selected tab indicator backgrounds |
| `--color-primary-12` | `rgba(0, 175, 249, 0.12)` | 12% | Selected table rows, highlighted conversation cards |
| `--color-primary-8` | `rgba(0, 175, 249, 0.08)` | 8% | Soft container fills, active sidebar item background pill |
| `--color-primary-4` | `rgba(0, 175, 249, 0.04)` | 4% | Subtle table row hovers, surface tinting in light mode |

### 2.2 Secondary Surface Palette (`#262626`)
A deep near-neutral tone matching Firecrawl's secondary surface foundation:

| Token Name | Value | Semantic Function |
|---|---|---|
| `--color-secondary` | `#262626` | Dark-mode surface badges, secondary button backgrounds, input fills |
| `--color-secondary-foreground`| `#ffffff` | High-contrast text rendered over secondary backgrounds |

### 2.3 Tertiary Accent Palette (`#fa5d19`)
Firecrawl's signature heat orange serves as Scrunity's dedicated operational and alert accent:

| Token Name | Value | Alpha | Semantic Function |
|---|---|---|---|
| `--color-tertiary` / `--color-tertiary-100` | `#fa5d19` | 100% | Running agent indicator, live polling badges, unread response dots |
| `--color-tertiary-hover` | `#e04e10` | 100% | Hover state for tertiary buttons |
| `--color-tertiary-40` | `rgba(250, 93, 25, 0.40)` | 40% | Tertiary card borders, question badge borders |
| `--color-tertiary-20` | `rgba(250, 93, 25, 0.20)` | 20% | Inbound reply message container borders |
| `--color-tertiary-16` | `rgba(250, 93, 25, 0.16)` | 16% | Dark mode badge fills for high-priority prospect replies |
| `--color-tertiary-12` | `rgba(250, 93, 25, 0.12)` | 12% | Background tint for question/inquiry badges |
| `--color-tertiary-8` | `rgba(250, 93, 25, 0.08)` | 8% | Thread list item highlight when unread reply is pending |
| `--color-tertiary-4` | `rgba(250, 93, 25, 0.04)` | 4% | Inbound reply card background tint |

### 2.4 Neutral Surface & Semantic Scale

| Role | Light Mode Value | Dark Mode Value | Usage in Application |
|---|---|---|---|
| **Background** | `oklch(1 0 0)` (`#ffffff`) | `oklch(0.145 0 0)` (`#121212`) | Viewport background shell |
| **Card / Surface** | `oklch(1 0 0)` (`#ffffff`) | `oklch(0.205 0 0)` (`#1e1e1e`) | Content cards, message panes, modal sheets |
| **Muted** | `oklch(0.97 0 0)` (`#f5f5f5`) | `oklch(0.269 0 0)` (`#262626`) | Hover states, inactive pill backgrounds |
| **Border** | `oklch(0.922 0 0)` (`#e5e5e5`) | `oklch(1 0 0 / 10%)` | Hairline dividers, card outlines |
| **Foreground** | `oklch(0.145 0 0)` (`#171717`) | `oklch(0.985 0 0)` (`#fcfcfc`) | High-contrast primary text |
| **Muted Text** | `oklch(0.556 0 0)` (`#737373`) | `oklch(0.708 0 0)` (`#a3a3a3`) | Secondary metadata, timestamps, subtitles |
| **Success** | `#10b981` | `#34d399` | "Interested" reply badges, verified MX badges, active mailboxes |
| **Warning** | `#f59e0b` | `#fbbf24` | Rate limits, pending human reviews, credit warnings |
| **Destructive** | `#ef4444` | `#f87171` | Bounced emails, failed dispatches, account disconnection |

---

## 3. Typography

Scrunity uses a three-tier typographic hierarchy:
1. **Sans-Serif (`Inter`):** UI text, form controls, navigation, and tabular data. Clean, geometric, and optimized for sub-14px micro-legibility.
2. **Monospace (`Geist Mono`):** Code snippets, email addresses, thread IDs, timestamps, and credit numbers.
3. **Display Serif (`Instrument Serif`):** Marketing headings, page title accents, and high-impact editorial moments.

### 3.1 Scale & Specifications

| Name | Font Size | Line Height | Font Weight | Letter Spacing | Applied Components |
|---|---|---|---|---|---|
| `micro` | 10px (`0.625rem`) | 12px | 600 SemiBold | `0.05em` | Status badges, uppercase section headers, dot counts |
| `badge` | 11px (`0.6875rem`) | 14px | 500 Medium | `0.02em` | Pill badges, metadata pills, relative timestamps |
| `compact` | 12px (`0.75rem`) | 16px | 400 / 500 | `0.01em` | Table data cells, secondary buttons, input text |
| `regular` | 13px (`0.8125rem`) | 18px | 400 / 500 | `0em` | Primary navigation, thread preview snippets |
| `body` | 14px (`0.875rem`) | 22px | 400 Regular | `0em` | Email thread message bodies, help documentation |
| `subhead` | 16px (`1.0rem`) | 22px | 600 SemiBold | `-0.01em` | Modal headers, card titles, drawer subheadings |
| `card_title`| 18px (`1.125rem`) | 24px | 600 SemiBold | `-0.02em` | Metric cards, campaign headers |
| `section_title` | 20px (`1.25rem`) | 26px | 600 SemiBold | `-0.02em` | Main dashboard view headings, page titles |
| `display` | 36px (`2.25rem`) | 40px | 600 SemiBold | `-0.03em` | Hero metrics, landing display titles |

---

## 4. Layout & Spatial System

### 4.1 Grid & Spacing Scale
All margins, paddings, and gaps derive strictly from a 4px baseline grid:
- `4px` (`gap-1`, `p-1`): Inner pill margins, icon-to-text gaps in badges.
- `8px` (`gap-2`, `p-2`): Small button paddings, list item row gaps.
- `12px` (`gap-3`, `p-3`): Medium form control spacing, thread row vertical padding.
- `16px` (`gap-4`, `p-4`): Card interior padding, panel separation.
- `24px` (`gap-6`, `p-6`): Major layout pane margins, dashboard grid gaps.
- `32px` (`gap-8`, `p-8`): Empty state hero paddings, large modal buffers.

### 4.2 Multi-Pane Architecture
1. **Collapsible Navigation Rail (`Sidebar`):**
   - Expanded: `240px` (`w-60`).
   - Collapsed: `64px` (`w-16`).
   - Fixed-left positioning with layout transition animations.
2. **Master List Pane (`Thread List`):**
   - Fixed width: `320px` to `384px` (`w-80` to `w-96`).
   - Independent vertical scrolling (`overflow-y-auto`).
   - Hairline right border (`border-r border-border/70`).
3. **Detail Pane (`Message View`):**
   - Responsive flex container (`flex-1 min-w-0`).
   - Sticky header with thread controls.
   - Independent message history scroll container.
   - Fixed bottom composer bar.

---

## 5. Elevation & Depth

Scrunity rejects heavy drop shadows in favor of crisp hairline borders and subtle alpha blending:
- **Level 0 (Base Canvas):** Background color (`bg-background`).
- **Level 1 (Cards & Panes):** Flat card surface with hairline boundary (`bg-card border border-border/80`).
- **Level 2 (Dropdowns & Popovers):** Subtle elevation with glass blur (`shadow-xs border border-border/80 backdrop-blur-md`).
- **Level 3 (Modals & Dialogs):** Centered overlay with medium elevation (`shadow-md border border-border bg-card`).
- **Focus Rings:** `ring-2 ring-primary/30 outline-hidden`.

---

## 6. Motion & Interaction

Motion is subtle, functional, and fast, reinforcing spatial hierarchy without slowing power users:
- **Durations:**
  - `150ms`: Micro-interactions (button hover, text color switches, icon opacity).
  - `200ms`: Dropdowns, tooltips, and popover enter/exit.
  - `300ms`: Layout animations (active tab layout pill, sidebar collapse/expand).
- **Easing:**
  - Spring physics: `stiffness: 350`, `damping: 30` (used for active sidebar indicators via Framer Motion).
  - Standard CSS: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out response).
- **Reduced Motion:**
  - All animated transitions gracefully degrade to instant switches when `prefers-reduced-motion: reduce` is enabled.

---

## 7. Shapes & Geometry

Border radii follow a strict hierarchy:
- `--radius-sm` (`6px` / `rounded-sm`): Micro badges, inner buttons, code blocks.
- `--radius-md` (`8px` / `rounded-md`): Standard buttons, inputs, dropdown menu items.
- `--radius-lg` (`10px` / `rounded-lg`): Cards, detail containers, modal sheets.
- `--radius-xl` (`14px` / `rounded-xl`): Inbound/outbound message bubbles, preview frames.
- `--radius-full` (`9999px` / `rounded-full`): Intent badges, status dots, circular avatar chips.

---

## 8. Component Specifications

### 8.1 Buttons (`Button`)
Standard heights: `28px` (default), `24px` (`sm`), `20px` (`xs`), `32px` (`lg`).
- `variant="default"`: `bg-primary text-primary-foreground hover:bg-primary-hover` — Primary action.
- `variant="tertiary"`: `bg-tertiary text-tertiary-foreground hover:bg-tertiary-hover` — Live operational action.
- `variant="outline"`: `border border-border/80 text-foreground hover:bg-muted` — Secondary controls.
- `variant="ghost"`: `text-muted-foreground hover:text-foreground hover:bg-muted` — Tertiary icon actions.

### 8.2 Badges (`Badge`)
Height: `20px`, Font size: `10px`, Radius: `rounded-full`.
- `variant="default"`: Solid primary blue pill (`bg-primary text-primary-foreground`).
- `variant="tertiary"`: Operational orange pill (`bg-tertiary/15 text-tertiary border border-tertiary/40`).
- `variant="success"`: Emerald verification pill (`bg-emerald-500/15 text-emerald-600 border border-emerald-500/40`).
- `variant="destructive"`: Soft red error pill (`bg-destructive/10 text-destructive border border-destructive/30`).
- `variant="outline"`: Crisp hairline pill (`border border-border/80 text-muted-foreground`).

### 8.3 Intent Classification Badges
Used across outreach pipelines, lead lists, and mailbox views:
- **Interested:** `variant="success"` (`bg-emerald-500/15 text-emerald-600 border border-emerald-500/40`) with emerald dot.
- **Question:** `variant="tertiary"` (`bg-tertiary/15 text-tertiary border border-tertiary/40`) with heat orange dot.
- **Not Interested:** `variant="outline"` (`border border-border/70 text-muted-foreground bg-muted/40`) with muted dot.
- **Auto Reply:** `variant="outline"` (`border border-border/70 text-muted-foreground bg-muted/30`).
- **Unclear:** `variant="outline"` (`border border-border/70 text-muted-foreground bg-muted/20`).

### 8.4 Navigation Items
- Inactive: `text-neutral-700 dark:text-neutral-300 hover:bg-foreground/4 hover:text-foreground`.
- Active: `text-primary font-semibold` with smooth sliding indicator (`bg-primary/10 border border-primary/20`).

---

## 9. Voice & Content Standards

1. **Precision Over Fluff:** Use concrete domain terminology ("Stage 7 Gmail Dispatch", "Stage 8 Reply Polling", "MX Record Validated") instead of vague AI hype ("Magic Autopilot", "Supercharging Leads").
2. **Honest System Status:** Never fake synchronous operation. If an action routes through an asynchronous Inngest worker or Gmail dispatch queue, label the button explicitly (e.g. "Send Reply (Automated Queue)") and disable it with informative tooltips when unavailable.
3. **Dense Error Transparency:** Error toasts and inline banners must state: (a) what failed, (b) the root cause, and (c) the actionable remedy.

---

## 10. Do's and Don'ts

### Do:
- **Do** reference CSS custom properties (`bg-primary`, `text-tertiary`, `border-border`) so theme modifications apply globally.
- **Do** use `bg-primary/10` with `border-l-primary` for active list selections.
- **Do** maintain a strict 40px row height for tables and 28px height for default buttons.
- **Do** pair icon sizes (`size-3.5` / `size-4`) consistently with typography scale.
- **Do** keep middle list panes independently scrollable with `overflow-y-auto`.

### Don't:
- **Don't** hardcode raw hex values (`#00aff9`, `#fa5d19`, `#262626`) in component JSX files.
- **Don't** use heavy drop shadows (`shadow-xl`) or excessive gradients that muddy data contrast.
- **Don't** mix multiple primary accent colors on a single view.
- **Don't** trigger full page reloads or unmount list components when switching selected items.
- **Don't** fake instant execution when backend jobs run asynchronously in queues.
