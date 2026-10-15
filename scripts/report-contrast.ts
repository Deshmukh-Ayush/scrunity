/**
 * Prints the WCAG 2.x contrast ratio of every text/background pair in the
 * design system (src/app/globals.css). No database, no network.
 *
 *   npx tsx scripts/report-contrast.ts
 *
 * Exits 1 if any pair marked as allowed falls below its threshold.
 * Keep the hex values below in sync with the tokens in globals.css.
 */

const T = {
  canvas: "#f9fafb", // --background
  surface: "#ffffff", // --surface
  muted: "#f3f4f6", // --muted (hover and selected fills)
  textStrong: "#0a0a0a",
  textDefault: "#262626",
  textMuted: "#737373",
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
}

// Brand button stops, computed exactly like the CSS: color-mix(in srgb, ...).
const brandTop = mix(T.brand, T.white, 0.92) // --brand-top
const brandBottom = mix(T.brand, "#000000", 0.94) // --brand-bottom
const brandEdge = mix(T.brand, "#000000", 0.8) // --brand-edge

/** "white" or "dark": the founder's call for text on the brand button. */
const BRAND_BUTTON_TEXT: "white" | "dark" = "white"
const brandText = BRAND_BUTTON_TEXT === "white" ? T.white : T.textStrong

type Pair = {
  name: string
  fg: string
  bg: string
  /** "text" = 4.5:1, "large" = 3:1, "ui" = 3:1 non-text, "info" = reported only, "avoid" = documented as not allowed */
  rule: "text" | "large" | "ui" | "info" | "avoid"
}

const PAIRS: Pair[] = [
  { name: "text-strong on canvas", fg: T.textStrong, bg: T.canvas, rule: "text" },
  { name: "text-strong on surface", fg: T.textStrong, bg: T.surface, rule: "text" },
  { name: "text-default on canvas", fg: T.textDefault, bg: T.canvas, rule: "text" },
  { name: "text-default on surface", fg: T.textDefault, bg: T.surface, rule: "text" },
  { name: "text-default on muted fill", fg: T.textDefault, bg: T.muted, rule: "text" },
  { name: "text-muted on canvas", fg: T.textMuted, bg: T.canvas, rule: "text" },
  { name: "text-muted on surface", fg: T.textMuted, bg: T.surface, rule: "text" },
  { name: "text-muted on muted fill", fg: T.textMuted, bg: T.muted, rule: "avoid" },
  { name: "text-subtle on surface (placeholder/disabled only)", fg: T.textSubtle, bg: T.surface, rule: "info" },
  { name: "#d4d4d4 on surface (divider only, never text)", fg: T.divider, bg: T.surface, rule: "info" },
  { name: "primary-foreground (white) on primary (text-strong)", fg: T.white, bg: T.textStrong, rule: "text" },
  { name: "success text on success tint", fg: T.success, bg: T.successTint, rule: "text" },
  { name: "success text on surface", fg: T.success, bg: T.surface, rule: "text" },
  { name: "white on solid success", fg: T.white, bg: T.success, rule: "text" },
  { name: "danger text on danger tint", fg: T.danger, bg: T.dangerTint, rule: "text" },
  { name: "danger text on surface", fg: T.danger, bg: T.surface, rule: "text" },
  { name: "white on solid danger", fg: T.white, bg: T.danger, rule: "text" },
  { name: "warning text on warning tint", fg: T.warning, bg: T.warningTint, rule: "text" },
  { name: "warning text on surface", fg: T.warning, bg: T.surface, rule: "text" },
  { name: "white on solid warning", fg: T.white, bg: T.warning, rule: "text" },
  { name: `brand button text (${BRAND_BUTTON_TEXT}) on --brand`, fg: brandText, bg: T.brand, rule: "info" },
  { name: `brand button text (${BRAND_BUTTON_TEXT}) on gradient top`, fg: brandText, bg: brandTop, rule: "info" },
  { name: `brand button text (${BRAND_BUTTON_TEXT}) on gradient bottom`, fg: brandText, bg: brandBottom, rule: "info" },
  { name: "white on --brand", fg: T.white, bg: T.brand, rule: "info" },
  { name: "text-strong on --brand", fg: T.textStrong, bg: T.brand, rule: "info" },
  { name: "button focus ring (text-strong) on canvas", fg: T.textStrong, bg: T.canvas, rule: "ui" },
  { name: "field focus border (--brand) on surface", fg: T.brand, bg: T.surface, rule: "info" },
]

function main() {
  console.log(`Brand stops: top ${brandTop}, base ${T.brand}, bottom ${brandBottom}, edge ${brandEdge}`)
  console.log(`BRAND_BUTTON_TEXT = ${BRAND_BUTTON_TEXT}\n`)
  console.log(pad("pair", 58) + pad("fg", 9) + pad("bg", 9) + pad("ratio", 8) + "result")
  let failures = 0
  for (const pair of PAIRS) {
    const ratio = contrast(pair.fg, pair.bg)
    const result = verdict(pair.rule, ratio)
    if (result.startsWith("FAIL")) failures++
    console.log(pad(pair.name, 58) + pad(pair.fg, 9) + pad(pair.bg, 9) + pad(ratio.toFixed(2), 8) + result)
  }
  console.log(failures === 0 ? "\nAll required pairs pass." : `\n${failures} required pair(s) fail.`)
  process.exit(failures === 0 ? 0 : 1)
}

function verdict(rule: Pair["rule"], ratio: number): string {
  switch (rule) {
    case "text":
      return ratio >= 4.5 ? "pass (AA text 4.5)" : "FAIL (AA text 4.5)"
    case "large":
    case "ui":
      return ratio >= 3 ? "pass (3:1)" : "FAIL (3:1)"
    case "avoid":
      return ratio >= 4.5 ? "passes, still avoided" : "below 4.5: not allowed (documented)"
    case "info":
      return `info (AA text ${ratio >= 4.5 ? "met" : "not met"}, 3:1 ${ratio >= 3 ? "met" : "not met"})`
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

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** color-mix(in srgb, a <weight>, b) */
function mix(a: string, b: string, weight: number): string {
  const [ra, ga, ba] = hexToRgb(a)
  const [rb, gb, bb] = hexToRgb(b)
  const channel = (x: number, y: number) =>
    Math.round(x * weight + y * (1 - weight)).toString(16).padStart(2, "0")
  return `#${channel(ra, rb)}${channel(ga, gb)}${channel(ba, bb)}`
}

function pad(text: string, width: number) {
  return text.length >= width ? text + " " : text + " ".repeat(width - text.length)
}

main()
