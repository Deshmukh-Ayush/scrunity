/**
 * Plain-text email rendering helpers (src/lib/email-text.ts). No database, no
 * network. Run: npx tsx scripts/test-email-text.ts
 */
import {
  decodeEntities,
  emailSnippet,
  linkify,
  splitQuoted,
} from "../src/lib/email-text"

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
  if (!ok)
    console.log(
      "   expected:",
      JSON.stringify(expected),
      "\n   actual:  ",
      JSON.stringify(actual)
    )
}

// A real bounce snippet from the dev database (provider snippets are HTML-escaped).
const realSnippet =
  "Address not found Your message wasn&#39;t delivered to amit.kumar@igotanoffer.com because the address couldn&#39;t be found"
console.log("before:", realSnippet)
console.log("after: ", emailSnippet(realSnippet))
check(
  "decodes &#39; in the real bounce snippet",
  emailSnippet(realSnippet),
  "Address not found Your message wasn't delivered to amit.kumar@igotanoffer.com because the address couldn't be found"
)
check(
  "hex and named references",
  decodeEntities("it&#x27;s &amp; &quot;ok&quot; &hellip;"),
  `it's & "ok" …`
)
check(
  "decodes one level only",
  decodeEntities("&amp;lt;script&amp;gt;"),
  "&lt;script&gt;"
)
check(
  "unknown names stay",
  decodeEntities("&notanentity; &#0;"),
  "&notanentity; &#0;"
)

// Markup stays text: decoding turns &lt;script&gt; into the literal characters, which React renders as text.
const hostile =
  'Hi &lt;script&gt;alert(1)&lt;/script&gt; <img src=x onerror="alert(2)"> <b>bold</b>'
check(
  "HTML in a body is returned as literal text",
  emailSnippet(hostile),
  `Hi <script>alert(1)</script> <img src=x onerror="alert(2)"> <b>bold</b>`
)

check(
  "only http(s) becomes a link; javascript: stays text",
  linkify("see https://acme.com/pricing. or javascript:alert(1)").map(
    (t) => t.type
  ),
  ["text", "link", "text"]
)
check(
  "link excludes trailing punctuation",
  linkify("Book here (https://cal.com/ayush).").find((t) => t.type === "link"),
  {
    type: "link",
    value: "https://cal.com/ayush",
    href: "https://cal.com/ayush",
  }
)

const reply =
  "Sounds good, let's talk Tuesday.\n\nOn Mon, Oct 12, 2026 at 9:00 AM Ayush <a@b.com> wrote:\n> Hi Dana,\n> quick question"
check("splits quoted history at 'On … wrote:'", splitQuoted(reply), {
  main: "Sounds good, let's talk Tuesday.",
  quoted:
    "On Mon, Oct 12, 2026 at 9:00 AM Ayush <a@b.com> wrote:\n> Hi Dana,\n> quick question",
})
check("no quote: nothing split", splitQuoted("Just one line").quoted, null)
check(
  "a '>' line in the middle is not history",
  splitQuoted("a\n> b\nc").quoted,
  null
)

console.log(failures ? `\n${failures} failed` : "\nAll checks passed")
process.exit(failures ? 1 : 0)
