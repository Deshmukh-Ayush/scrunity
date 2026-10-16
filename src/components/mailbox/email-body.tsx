"use client"

import * as React from "react"
import { ChevronDown } from "@/components/ui/icons"
import { emailPlainText, linkify, splitQuoted } from "@/lib/email-text"
import { cn } from "@/lib/utils"

/**
 * An email body rendered as plain text, never HTML: entities decoded, line
 * breaks kept, http(s) URLs as safe links, quoted history behind "Show quoted
 * text". Bodies are untrusted input; React renders every piece as text.
 */
export function EmailBody({
  body,
  className,
}: {
  body: string
  className?: string
}) {
  const { main, quoted } = React.useMemo(
    () => splitQuoted(emailPlainText(body)),
    [body]
  )
  const [showQuoted, setShowQuoted] = React.useState(false)
  const quotedId = React.useId()

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <PlainText text={main} />
      {quoted && (
        <>
          <button
            type="button"
            aria-expanded={showQuoted}
            aria-controls={quotedId}
            onClick={() => setShowQuoted((v) => !v)}
            className={cn(
              "-ms-1 inline-flex h-6 w-fit items-center gap-1 rounded-sm border border-transparent px-1 text-meta text-fg-muted outline-none",
              "transition-[color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
              "ui-hover:text-fg-strong ui-focus:focus-ring"
            )}
          >
            {showQuoted ? "Hide quoted text" : "Show quoted text"}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3.5 motion-safe:transition-transform",
                showQuoted && "rotate-180"
              )}
            />
          </button>
          <div
            id={quotedId}
            hidden={!showQuoted}
            className="border-s-2 border-border ps-3 text-fg-muted"
          >
            <PlainText text={quoted} />
          </div>
        </>
      )}
    </div>
  )
}

function PlainText({ text }: { text: string }) {
  const tokens = React.useMemo(() => linkify(text), [text])
  return (
    <p className="text-body break-words whitespace-pre-wrap text-fg-default">
      {tokens.map((token, i) =>
        token.type === "link" ? (
          <a
            key={i}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fg-strong underline decoration-border-strong underline-offset-2 hover:decoration-fg-strong"
          >
            {token.value}
          </a>
        ) : (
          <React.Fragment key={i}>{token.value}</React.Fragment>
        )
      )}
    </p>
  )
}
