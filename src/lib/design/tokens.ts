/**
 * The design tokens' hex values and contrast math, shared by
 * scripts/report-contrast.ts and the Foundations entry on the component
 * testing route. Keep the values in sync with src/app/globals.css.
 */

export const COLORS = {
  canvas: "#f9fafb",
  surface: "#ffffff",
  mutedFill: "#f3f4f6",
  borderDefault: "#e5e7eb",
  borderStrong: "#d1d5db",
  textStrong: "#0a0a0a",
  textDefault: "#262626",
  textMuted: "#6b6b6b",
  textSubtle: "#a3a3a3",
  divider: "#d4d4d4",
  brand: "#00aaf7",
  success: "#047857",
  successTint: "#ecfdf5",
  danger: "#b91c1c",
  dangerTint: "#fef2f2",
  warning: "#b45309",
  warningTint: "#fffbeb",
  white: "#ffffff",
} as const

/** "white" or "dark": the founder's call for text on the brand button. Mirror --brand-foreground. */
export const BRAND_BUTTON_TEXT: "white" | "dark" = "white"

// Brand button stops, computed like the CSS: color-mix(in srgb, ...).
export const BRAND_STOPS = {
  top: mix(COLORS.brand, COLORS.white, 0.92),
  base: COLORS.brand,
  bottom: mix(COLORS.brand, "#000000", 0.94),
  edge: mix(COLORS.brand, "#000000", 0.8),
}

const brandText = BRAND_BUTTON_TEXT === "white" ? COLORS.white : COLORS.textStrong

/**
 * "text" = 4.5:1, "ui" = 3:1 non-text, "info" = reported only, "avoid" = documented as not allowed,
 * "accepted" = below its threshold by the founder's explicit decision (reported, never a failure).
 */
export type ContrastRule = "text" | "ui" | "info" | "avoid" | "accepted"

export interface ContrastPair {
  name: string
  fg: string
  bg: string
  rule: ContrastRule
}

const C = COLORS
export const CONTRAST_PAIRS: ContrastPair[] = [
  { name: "text-strong on canvas", fg: C.textStrong, bg: C.canvas, rule: "text" },
  { name: "text-strong on surface", fg: C.textStrong, bg: C.surface, rule: "text" },
  { name: "text-default on canvas", fg: C.textDefault, bg: C.canvas, rule: "text" },
  { name: "text-default on surface", fg: C.textDefault, bg: C.surface, rule: "text" },
  { name: "text-default on muted fill", fg: C.textDefault, bg: C.mutedFill, rule: "text" },
  { name: "text-muted on canvas", fg: C.textMuted, bg: C.canvas, rule: "text" },
  { name: "text-muted on surface", fg: C.textMuted, bg: C.surface, rule: "text" },
  { name: "text-muted on muted fill", fg: C.textMuted, bg: C.mutedFill, rule: "text" },
  { name: "text-subtle on surface (placeholder/disabled only)", fg: C.textSubtle, bg: C.surface, rule: "info" },
  { name: "#d4d4d4 on surface (divider only, never text)", fg: C.divider, bg: C.surface, rule: "info" },
  { name: "white on primary (text-strong)", fg: C.white, bg: C.textStrong, rule: "text" },
  { name: "success text on success tint", fg: C.success, bg: C.successTint, rule: "text" },
  { name: "success text on surface", fg: C.success, bg: C.surface, rule: "text" },
  { name: "white on solid success", fg: C.white, bg: C.success, rule: "text" },
  { name: "danger text on danger tint", fg: C.danger, bg: C.dangerTint, rule: "text" },
  { name: "danger text on surface", fg: C.danger, bg: C.surface, rule: "text" },
  { name: "white on solid danger (danger button)", fg: C.white, bg: C.danger, rule: "text" },
  { name: "warning text on warning tint", fg: C.warning, bg: C.warningTint, rule: "text" },
  { name: "warning text on surface", fg: C.warning, bg: C.surface, rule: "text" },
  { name: "white on solid warning", fg: C.white, bg: C.warning, rule: "text" },
  { name: `brand button text (${BRAND_BUTTON_TEXT}) on --brand`, fg: brandText, bg: C.brand, rule: "info" },
  { name: `brand button text (${BRAND_BUTTON_TEXT}) on gradient top`, fg: brandText, bg: BRAND_STOPS.top, rule: "info" },
  { name: `brand button text (${BRAND_BUTTON_TEXT}) on gradient bottom`, fg: brandText, bg: BRAND_STOPS.bottom, rule: "info" },
  { name: "white on --brand", fg: C.white, bg: C.brand, rule: "info" },
  { name: "text-strong on --brand", fg: C.textStrong, bg: C.brand, rule: "info" },
  // Selected main-nav item (brand fill, founder exception). Text and icon are --nav-selected-fg.
  { name: "nav selected text (--nav-selected-fg = white) on --brand", fg: C.white, bg: C.brand, rule: "accepted" },
  { name: "nav selected text, near-black option, on --brand", fg: C.textStrong, bg: C.brand, rule: "info" },
  { name: "nav selected focus ring (text-strong) on canvas gap", fg: C.textStrong, bg: C.canvas, rule: "ui" },
  { name: "focus ring (--brand) on surface", fg: C.brand, bg: C.surface, rule: "accepted" },
  { name: "focus ring (--brand) on canvas", fg: C.brand, bg: C.canvas, rule: "accepted" },
]

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Whether a pair meets its rule; "info" and "avoid" pairs never fail. */
export function contrastVerdict(rule: ContrastRule, ratio: number): { pass: boolean; label: string } {
  switch (rule) {
    case "text":
      return { pass: ratio >= 4.5, label: ratio >= 4.5 ? "pass (AA text 4.5)" : "FAIL (AA text 4.5)" }
    case "ui":
      return { pass: ratio >= 3, label: ratio >= 3 ? "pass (3:1)" : "FAIL (3:1)" }
    case "avoid":
      return { pass: true, label: ratio >= 4.5 ? "passes, still avoided" : "below 4.5: not allowed (documented)" }
    case "accepted":
      return {
        pass: true,
        label: ratio >= 3 ? "pass (3:1)" : "below 3:1, accepted (founder decision)",
      }
    case "info":
      return {
        pass: true,
        label: `info (AA text ${ratio >= 4.5 ? "met" : "not met"}, 3:1 ${ratio >= 3 ? "met" : "not met"})`,
      }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** color-mix(in srgb, a <weight>, b) */
function mix(a: string, b: string, weight: number): string {
  const [ra, ga, ba] = hexToRgb(a)
  const [rb, gb, bb] = hexToRgb(b)
  const channel = (x: number, y: number) =>
    Math.round(x * weight + y * (1 - weight)).toString(16).padStart(2, "0")
  return `#${channel(ra, rb)}${channel(ga, gb)}${channel(ba, bb)}`
}
