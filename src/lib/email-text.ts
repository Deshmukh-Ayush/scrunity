/**
 * Email text is untrusted input. Everything here works on plain strings and
 * returns plain strings or tokens; nothing is ever parsed as HTML (no
 * innerHTML, no DOMParser), so markup in a message stays inert text.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
}

/**
 * Decodes HTML character references (`&#39;`, `&#x27;`, `&amp;`, …) that
 * providers leave in snippets. Unknown names stay as written. One pass only,
 * so `&amp;lt;` becomes `&lt;` (text), never `<` markup.
 */
export function decodeEntities(text: string): string {
  return text.replace(
    /&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]{2,8});/g,
    (match, ref: string) => {
      if (ref[0] === "#") {
        const code =
          ref[1] === "x" || ref[1] === "X"
            ? parseInt(ref.slice(2), 16)
            : parseInt(ref.slice(1), 10)
        // Skip NUL, surrogates and out-of-range code points.
        if (!code || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))
          return match
        return String.fromCodePoint(code)
      }
      return NAMED_ENTITIES[ref.toLowerCase()] ?? match
    }
  )
}

/** Normalized display text: entities decoded, Windows line endings unified. */
export function emailPlainText(text: string | null | undefined): string {
  if (!text) return ""
  return decodeEntities(text).replace(/\r\n?/g, "\n")
}

/** A one-line preview for list rows: decoded, whitespace collapsed. */
export function emailSnippet(text: string | null | undefined): string {
  return emailPlainText(text).replace(/\s+/g, " ").trim()
}

const QUOTE_HEADER =
  /^\s*(On\s.+\swrote:|-{2,}\s*Original Message\s*-{2,}|From:\s.+)\s*$/i

/**
 * Splits a body into what the sender wrote and the quoted history under it:
 * from the first "On … wrote:" / "Original Message" / "From:" line, or the
 * first run of ">" lines that continues to the end.
 */
export function splitQuoted(text: string): {
  main: string
  quoted: string | null
} {
  const lines = text.split("\n")
  let start = lines.findIndex((line) => QUOTE_HEADER.test(line))
  if (start === -1) {
    const firstQuote = lines.findIndex((line) =>
      line.trimStart().startsWith(">")
    )
    const restIsQuote =
      firstQuote > 0 &&
      lines
        .slice(firstQuote)
        .every((line) => line.trim() === "" || line.trimStart().startsWith(">"))
    start = restIsQuote ? firstQuote : -1
  }
  if (start <= 0) return { main: text, quoted: null }
  return {
    main: lines.slice(0, start).join("\n").trimEnd(),
    quoted: lines.slice(start).join("\n").trim(),
  }
}

export type TextToken =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string }

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi

/**
 * Splits text into plain runs and http(s) links. Trailing punctuation stays
 * outside the link. Any other scheme (javascript:, data:, mailto:) stays text.
 */
export function linkify(text: string): TextToken[] {
  const tokens: TextToken[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    let url = match[0]
    const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? ""
    url = url.slice(0, url.length - trailing.length)
    const index = match.index ?? 0
    if (index > last)
      tokens.push({ type: "text", value: text.slice(last, index) })
    let href: string | null = null
    try {
      const parsed = new URL(url)
      if (parsed.protocol === "http:" || parsed.protocol === "https:")
        href = parsed.toString()
    } catch {}
    tokens.push(
      href ? { type: "link", value: url, href } : { type: "text", value: url }
    )
    last = index + url.length
  }
  if (last < text.length) tokens.push({ type: "text", value: text.slice(last) })
  return tokens
}
