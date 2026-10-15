"use client"

import * as React from "react"
import { ViewTransition } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUp, StopCircle } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

const MAX_LINES = 8
const LINE_HEIGHT_PX = 24

/**
 * The agent composer, shared by Home and the chat page: a white floating
 * card (radius 12) with an auto-growing textarea (1 to 8 lines) and a round
 * brand send button. Enter sends, Shift+Enter adds a line, and Enter while
 * an IME is composing never sends. The whole card shows the focus ring while
 * the textarea has focus.
 *
 * Both pages wrap it in a <ViewTransition name="agent-composer">, so a
 * navigation from Home to a chat moves the card to its new place instead of
 * swapping it (CSS in globals.css, instant under reduced motion).
 */
export function AgentComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  sending = false,
  generating = false,
  disabled = false,
  placeholder,
  autoFocus = false,
  textareaRef,
  transitionName,
  className,
  "data-force": dataForce,
}: {
  value: string
  onValueChange: (value: string) => void
  onSubmit: () => void
  /** Shown instead of Send while the agent is writing, when provided. */
  onStop?: () => void
  /** The send request is in flight: the button shows a spinner. */
  sending?: boolean
  /** The agent is replying: the stop button replaces send (when onStop is set). */
  generating?: boolean
  disabled?: boolean
  placeholder: string
  autoFocus?: boolean
  textareaRef?: React.Ref<HTMLTextAreaElement>
  /** View-transition name for the Home → chat move; leave unset when several composers share a page. */
  transitionName?: string
  className?: string
  "data-force"?: "focus-visible"
}) {
  const innerRef = React.useRef<HTMLTextAreaElement>(null)
  const inputId = React.useId()
  React.useImperativeHandle(
    textareaRef,
    () => innerRef.current as HTMLTextAreaElement
  )

  // Grow with the content up to MAX_LINES, then scroll inside.
  React.useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_LINES * LINE_HEIGHT_PX)}px`
  }, [value])

  const canSend =
    value.trim().length > 0 && !sending && !generating && !disabled

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    // keyCode 229 covers browsers that end an IME composition with a plain Enter keydown.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    if (canSend) onSubmit()
  }

  const showStop = generating && onStop

  const card = (
    <div
      data-slot="agent-composer"
      data-force={dataForce}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-transparent bg-surface p-3 shadow-floating",
        "transition-[border-color,box-shadow] duration-(--motion-fast) ease-out motion-reduce:transition-none",
        "has-[textarea:focus-visible]:focus-ring data-[force=focus-visible]:focus-ring",
        disabled && "bg-muted",
        className
      )}
    >
      <label className="sr-only" htmlFor={inputId}>
        Message the agent
      </label>
      <textarea
        id={inputId}
        ref={innerRef}
        rows={1}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          "block max-h-48 min-h-6 w-full resize-none overflow-y-auto bg-transparent px-1 text-base leading-6 text-fg-strong outline-none md:text-composer",
          "placeholder:text-fg-subtle disabled:cursor-not-allowed"
        )}
      />
      <div className="flex items-center justify-end">
        {showStop ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="rounded-full"
            onClick={onStop}
            aria-label="Stop"
          >
            <StopCircle />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="brand"
            className="rounded-full"
            onClick={onSubmit}
            disabled={!canSend && !sending}
            loading={sending}
            aria-label="Send"
          >
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  )

  if (!transitionName) return card
  return (
    <ViewTransition name={transitionName} share="composer-move" default="none">
      {card}
    </ViewTransition>
  )
}
