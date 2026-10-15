/**
 * Prints the WCAG 2.x contrast ratio of every text/background pair in the
 * design system. No database, no network.
 *
 *   npx tsx scripts/report-contrast.ts
 *
 * The pairs and hex values live in src/lib/design/tokens.ts (kept in sync
 * with src/app/globals.css). Exits 1 if any required pair fails.
 */
import {
  BRAND_BUTTON_TEXT,
  BRAND_STOPS,
  CONTRAST_PAIRS,
  contrast,
  contrastVerdict,
} from "../src/lib/design/tokens"

function main() {
  console.log(
    `Brand stops: top ${BRAND_STOPS.top}, base ${BRAND_STOPS.base}, bottom ${BRAND_STOPS.bottom}, edge ${BRAND_STOPS.edge}`
  )
  console.log(`BRAND_BUTTON_TEXT = ${BRAND_BUTTON_TEXT}\n`)
  console.log(pad("pair", 58) + pad("fg", 9) + pad("bg", 9) + pad("ratio", 8) + "result")
  let failures = 0
  for (const pair of CONTRAST_PAIRS) {
    const ratio = contrast(pair.fg, pair.bg)
    const verdict = contrastVerdict(pair.rule, ratio)
    if (!verdict.pass) failures++
    console.log(pad(pair.name, 58) + pad(pair.fg, 9) + pad(pair.bg, 9) + pad(ratio.toFixed(2), 8) + verdict.label)
  }
  console.log(failures === 0 ? "\nAll required pairs pass." : `\n${failures} required pair(s) fail.`)
  process.exit(failures === 0 ? 0 : 1)
}

function pad(text: string, width: number) {
  return text.length >= width ? text + " " : text + " ".repeat(width - text.length)
}

main()
