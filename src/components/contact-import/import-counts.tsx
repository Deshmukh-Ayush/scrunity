import { IMPORT_COPY as COPY } from "@/lib/contact-import/copy"
import type { ImportCounts as Counts } from "@/lib/contact-import/review"

/** The counts of a review or a finished import, as a definition list. */
export function ImportCounts({ counts }: { counts: Counts }) {
  const items: Array<[string, number]> = [
    [COPY.countImported, counts.imported],
    [COPY.countDuplicates, counts.duplicates],
    [COPY.countInvalid, counts.invalid],
    [COPY.countSuppressed, counts.suppressed],
    [COPY.countPersonal, counts.personalEmails],
    [COPY.countNoEmail, counts.noEmail],
  ]
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-meta text-fg-muted">{label}</dt>
          <dd className="text-section text-fg-strong tabular-nums">{value.toLocaleString("en-US")}</dd>
        </div>
      ))}
    </dl>
  )
}
