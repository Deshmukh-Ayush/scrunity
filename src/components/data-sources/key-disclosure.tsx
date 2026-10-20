import { ShieldCheck } from "@/components/ui/icons"
import { DATA_SOURCE_COPY } from "@/lib/data-sources/copy"
import { cn } from "@/lib/utils"

/**
 * How the customer's key is used, in three plain sentences. Shown on the page
 * and inside the connect dialog, so it is read before a key is pasted.
 */
export function KeyDisclosure({ className, headingLevel = "h2" }: { className?: string; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel
  return (
    <section aria-labelledby="key-disclosure-heading" className={cn("flex flex-col gap-2", className)}>
      <Heading id="key-disclosure-heading" className="flex items-center gap-2 text-body font-medium text-fg-default">
        <ShieldCheck className="text-fg-muted" />
        {DATA_SOURCE_COPY.disclosureTitle}
      </Heading>
      <ul className="flex list-disc flex-col gap-1 ps-9 text-body text-fg-muted marker:text-fg-subtle">
        {DATA_SOURCE_COPY.disclosure.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  )
}
