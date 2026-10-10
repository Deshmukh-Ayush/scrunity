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

## Overview

The Scrunity Design System defines the visual foundation and component architecture for Scrunity's autonomous GTM and cold outreach platform. Adapted structurally from Firecrawl's proven developer-first aesthetic, Scrunity pairs dense, high-signal information density with crisp typographic hierarchy, near-neutral surfaces, and a signature brand palette.

### Core Tenets
1. **Calm Precision:** High data density without visual clutter. Whitespace is deliberate, micro-typography is sharp, and contrast ratios strictly meet WCAG AA standards.
2. **Signature Brand Blue (`#00aff9`):** One distinctive primary color carrying the core product identity, expressed across an intentional opacity ramp for hover, selection, emphasis, and focus boundaries.
3. **Heat Orange Tertiary (`#fa5d19`):** A warm, high-visibility accent reserved for active pipeline execution states, agent tool runs, real-time replies, and action tags.
4. **Near-Neutral Surfaces:** Zero saturated grey backgrounds. Surfaces transition cleanly between pure white (`#ffffff`) in light mode and deep charcoal (`#121212` / `#1e1e1e`) in dark mode.
5. **Configurable Tokens in Code:** The design system is not an isolated document; all color and layout tokens are implemented directly as CSS custom properties in `src/app/globals.css`.

---

## Colors

### Primary Palette (Brand Blue — `#00aff9`)
The primary brand token represents Scrunity's signature color. It replaces Firecrawl's heat orange as the primary brand hero, utilized for active nav items, primary call-to-actions, brand marks, and interactive focus rings.

| Token | Hex / Value | Opacity | Semantic Use |
|---|---|---|---|
| `--color-primary` / `--color-primary-100` | `#00aff9` | 100% | Primary buttons, active badges, key call-to-actions, logo marks |
| `--color-primary-90` | `rgba(0, 175, 249, 0.90)` | 90% | Button hover states, active pressed states |
| `--color-primary-40` | `rgba(0, 175, 249, 0.40)` | 40% | Subtle border outlines, decorative divider strokes |
| `--color-primary-20` | `rgba(0, 175, 249, 0.20)` | 20% | Focused ring halos, subtle card highlights |
| `--color-primary-16` | `rgba(0, 175, 249, 0.16)` | 16% | Selected tab/row background fills in dark mode |
| `--color-primary-12` | `rgba(0, 175, 249, 0.12)` | 12% | Interactive hover states, light pills |
| `--color-primary-8` | `rgba(0, 175, 249, 0.08)` | 8% | Soft container fills, tag backgrounds |
| `--color-primary-4` | `rgba(0, 175, 249, 0.04)` | 4% | Subtle table row hovers, surface tinting |

### Secondary Palette (Near-Neutral — `#262626`)
Dark neutral surface token matching Firecrawl's `#262626`. Serves as secondary button surface in dark mode, card header divides, and subtle chrome separators.

| Token | Hex / Value | Semantic Use |
|---|---|---|
| `--color-secondary` | `#262626` | Dark-mode surface badges, secondary controls, card borders |
| `--color-secondary-foreground` | `#ffffff` | Contrast text rendered over secondary backgrounds |

### Tertiary Palette (Heat Orange Accent — `#fa5d19`)
Firecrawl's signature heat orange (`#fa5d19`) serves as Scrunity's tertiary and operational accent color. It replaces older blue/bluetron info accents to provide immediate visual pop for running execution pipelines, agent tool calls, email reply inquiries, and hot prospect tags.

| Token | Hex / Value | Opacity | Semantic Use |
|---|---|---|---|
| `--color-tertiary` / `--color-tertiary-100` | `#fa5d19` | 100% | Running agent indicator, live execution badges, urgent reply tags |
| `--color-tertiary-hover` | `#e04e10` | 100% | Hover state for tertiary buttons |
| `--color-tertiary-40` | `rgba(250, 93, 25, 0.40)` | 40% | Tertiary card borders, active progress ring strokes |
| `--color-tertiary-20` | `rgba(250, 93, 25, 0.20)` | 20% | Agent tool running pill borders, question badge outlines |
| `--color-tertiary-12` | `rgba(250, 93, 25, 0.12)` | 12% | Background fill for tertiary warning/info cards |
| `--color-tertiary-8` | `rgba(250, 93, 25, 0.08)` | 8% | Subtle row highlight for threads with open replies |
| `--color-tertiary-4` | `rgba(250, 93, 25, 0.04)` | 4% | Background tint for active pipeline stages |

### Neutral Surface & Semantic Scale

| Role | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Background** | `oklch(1 0 0)` (`#ffffff`) | `oklch(0.145 0 0)` (`#121212`) | Page base background |
| **Card / Surface** | `oklch(1 0 0)` (`#ffffff`) | `oklch(0.205 0 0)` (`#1e1e1e`) | Content containers, sheets, modals |
| **Muted** | `oklch(0.97 0 0)` (`#f5f5f5`) | `oklch(0.269 0 0)` (`#262626`) | Hover backgrounds, input fills |
| **Border** | `oklch(0.922 0 0)` (`#e5e5e5`) | `oklch(1 0 0 / 10%)` | Hairline dividers, card outlines |
| **Foreground** | `oklch(0.145 0 0)` (`#171717`) | `oklch(0.985 0 0)` (`#fcfcfc`) | High-contrast primary typography |
| **Muted Text** | `oklch(0.556 0 0)` (`#737373`) | `oklch(0.708 0 0)` (`#a3a3a3`) | Secondary metadata, labels, timestamps |
| **Success** | `#10b981` | `#34d399` | Sent emails, verified contacts, positive replies |
| **Warning** | `#f59e0b` | `#fbbf24` | Rate limits, pending human reviews, credit warnings |
| **Destructive** | `#ef4444` | `#f87171` | Bounced emails, errors, deletion actions |

---

## Typography

Scrunity employs three distinct typefaces configured in `src/app/layout.tsx`:
1. **Sans-Serif (`Inter`):** Primary UI font, optimized for legibility at small sizes (10px–14px).
2. **Monospace (`Geist Mono`):** Code snippets, identifiers, API keys, JSON payloads, and credit counters.
3. **Display Serif (`Instrument Serif`):** Marketing headings and editorial brand touchpoints.

### Scale & Hierarchy

| Scale | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `micro` | 10px | 600 SemiBold | 1.2 | Upper-case section labels, dot indicators, compact badges |
| `badge` | 11px | 500 Medium | 1.3 | Pill badges, campaign status labels, relative timestamps |
| `compact` | 12px | 400 / 500 | 1.4 | Table cells, secondary navigation, input placeholders |
| `regular` | 13px | 400 / 500 | 1.5 | Primary navigation, card descriptions, message preview snippets |
| `body` | 14px | 400 Regular | 1.6 | Email thread message bodies, documentation prose, notes |
| `subhead` | 16px | 600 SemiBold | 1.3 | Card titles, modal headers, subsection titles |
| `card_title` | 18px | 600 SemiBold | 1.3 | Metric summary titles, campaign card headings |
| `section_title`| 20px | 600 SemiBold | 1.2 | View titles, page headers |
| `display` | 36px | 600 SemiBold | 1.1 | Key promotional statistics, high-impact hero headings |

---

## Layout & Spatial System

Scrunity adheres to a strict 4px baseline grid. Padding, margin, and gap values derive exclusively from multiples of 4px.

- **Micro spacing (`gap-1`, `p-1`):** 4px — Tight badge icons, inner pill padding.
- **Compact spacing (`gap-2`, `p-2`):** 8px — List item margins, compact button padding.
- **Standard spacing (`gap-3`, `p-3`, `gap-4`, `p-4`):** 12px / 16px — Form fields, card interiors, thread items.
- **Section spacing (`gap-6`, `p-6`):** 24px — Major layout pane separation, dashboard grid gap.

### Panes & Viewports
- **Two-Pane Conversation Layout:**
  - Middle thread-list pane: Fixed width 320px–380px on desktop (`w-80` to `w-96`), border-r divider, internal independent scroll.
  - Right detail pane: Flex-1 responsive area, persistent header, scrollable message exchange, fixed bottom reply composer.
- **Responsive Adaptability:**
  - On mobile (`< 768px`), the thread list and detail pane stack or alternate using stateful selection.

---

## Elevation & Depth

Scrunity minimizes drop shadows in favor of 1px border strokes with subtle alpha blending:
- **Default Surface:** Flat background with `border border-border/60`.
- **Raised Elements (Modals, Popovers, Dropdowns):** Subtle `shadow-xs` / `shadow-sm` with backdrop blur (`backdrop-blur-md`).
- **Focus States:** `ring-2 ring-primary/30 outline-hidden`.

---

## Shapes & Radius

Border radiuses follow Scrunity's standardized geometry tokens:
- `--radius-sm`: `6px` (`rounded-sm`) — Micro badges, inner buttons.
- `--radius-md`: `8px` (`rounded-md`) — Standard inputs, buttons, dropdown items.
- `--radius-lg`: `10px` (`rounded-lg`) — Cards, panes, dialogue containers.
- `--radius-xl`: `14px` (`rounded-xl`) — Large preview panels, floating banners.
- `--radius-full`: `9999px` (`rounded-full`) — Avatars, pill badges, status indicator dots.

---

## Components

### Buttons
- **Primary:** `bg-primary text-primary-foreground hover:bg-primary/90` — Solid blue call to action.
- **Tertiary / Action:** `bg-tertiary text-tertiary-foreground hover:bg-tertiary/90` — Live action, review approval.
- **Secondary / Outline:** `border border-border bg-transparent hover:bg-muted` — Neutral navigation and cancel actions.
- **Ghost:** `hover:bg-muted text-muted-foreground hover:text-foreground` — Icon actions, inline links.

### Badges (`Badge`)
- **Primary / Brand:** Blue pill with white or saturated blue text (`bg-primary/10 text-primary border-primary/30`).
- **Tertiary / Live:** Orange pill (`bg-tertiary/10 text-tertiary border-tertiary/30`).
- **Intent Badges:**
  - `interested`: `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30`
  - `question`: `bg-tertiary/10 text-tertiary border-tertiary/30`
  - `not_interested`: `bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/30`
  - `unclear`: `bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30`

---

## Voice & Content

- **Objective and Exact:** Avoid empty marketing adjectives. State exactly what the system is performing (e.g. "Drafting Stage 3 cold emails", "Poll replies via Gmail API").
- **Honest System Status:** If an action cannot execute synchronously, explain the backend pipeline clearly rather than faking an instantaneous success.
- **Concise Microcopy:** Tooltips, error toasts, and button labels must be succinct (2–5 words).

---

## Do's & Don'ts

### Do
- Use `--color-primary` (`#00aff9`) for core brand actions and navigation highlights.
- Use `--color-tertiary` (`#fa5d19`) for active agent runs, live polling states, and hot outreach replies.
- Rely on Tailwind v4 theme variables (`bg-primary`, `text-tertiary`, `border-border`) so changing a token in `globals.css` propagates universally.
- Retain dense, compact 40px table rows and 28px button heights in complex operational dashboards.

### Don't
- Never introduce hardcoded hex colors like `#2a6dfb` or ad-hoc RGB colors across JSX components.
- Never use heavy drop shadows or excessive gradient fills that degrade contrast.
- Never remove scroll containers or enforce arbitrary `overflow: hidden` on viewport shells.
- Never fake asynchronous operations in UI buttons.
