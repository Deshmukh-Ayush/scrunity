"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useHydrated } from "@/hooks/use-hydrated"
import { AgentComposer } from "@/components/chat/agent-composer"
import { setPendingPrompt } from "@/components/chat/chat-events"
import { ChevronRight } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { HomeFeed } from "@/lib/data/home"
import { NeedsYou, Today } from "./home-feed"

export const COMPOSER_PLACEHOLDER =
  "Describe who you want to reach, or ask about your campaigns"

const STARTER_PROMPTS = [
  "Where do my campaigns stand, and what should I do next?",
  "Which leads have verified emails and are ready to contact?",
  "Who replied to my outreach, and what did they say?",
]

function greetingWord(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning"
  if (hour >= 12 && hour < 17) return "Good afternoon"
  return "Good evening"
}

/**
 * "Good morning, Ayush." from the viewer's local clock. The server cannot
 * know the time of day, so the line renders after mount; its height is
 * reserved, so nothing below moves.
 */
export function Greeting({ firstName }: { firstName: string | null }) {
  const hydrated = useHydrated()
  const text = hydrated
    ? `${greetingWord(new Date().getHours())}${firstName ? `, ${firstName}` : ""}.`
    : ""

  return (
    <h1
      className={cn(
        "min-h-8 text-title text-fg-strong",
        "transition-opacity duration-(--motion-base) ease-out motion-reduce:transition-none",
        hydrated ? "opacity-100" : "opacity-0"
      )}
    >
      {text || <span className="sr-only">Home</span>}
    </h1>
  )
}

/** First-run suggestions. Choosing one fills the composer; it does not send. */
export function StarterPrompts({
  onPick,
}: {
  onPick: (prompt: string) => void
}) {
  return (
    <div className="flex flex-col gap-1" role="group" aria-label="Suggestions">
      {STARTER_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onPick(prompt)}
          className={cn(
            "flex min-h-10 w-full items-center gap-2 rounded-md border border-transparent px-3 py-2 text-start text-body text-fg-default outline-none",
            "transition-[background-color,color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
            "ui-hover:bg-muted ui-hover:text-fg-strong ui-focus:focus-ring"
          )}
        >
          <span className="min-w-0 flex-1">{prompt}</span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-fg-muted"
          />
        </button>
      ))}
    </div>
  )
}

/**
 * Home: greeting, the agent composer, then "Needs you" and "Today" (each
 * hidden when empty). With nothing in either and no chats yet, starter
 * prompts sit under the composer instead.
 *
 * Sending creates a chat (POST /api/gtm/chat/conversations), hands the prompt
 * to the chat page (setPendingPrompt) and navigates to /dashboard/chat?id=…,
 * where the existing agent flow sends it. The composer is a named view
 * transition, so it moves down to its chat position while the rest fades.
 */
export function HomeClient({
  firstName,
  feed,
}: {
  firstName: string | null
  feed: HomeFeed
}) {
  const router = useRouter()
  const [value, setValue] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const isFirstRun =
    feed.needsYou.length === 0 && feed.activity.length === 0 && !feed.hasChats

  const send = async () => {
    const prompt = value.trim()
    if (!prompt || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/gtm/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: prompt.slice(0, 50) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const id: string = data.conversation.id
      setPendingPrompt(id, prompt)
      router.push(`/dashboard/chat?id=${id}`)
    } catch (err) {
      console.error("Could not start a chat:", err)
      setError("The chat couldn't start. Check your connection and send again.")
      setSending(false)
    }
  }

  const pickStarter = (prompt: string) => {
    setValue(prompt)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-16 pt-12 pb-16 md:pt-20">
      <div className="flex flex-col gap-6">
        <Greeting firstName={firstName} />
        <div className="flex flex-col gap-2">
          <AgentComposer
            transitionName="agent-composer"
            textareaRef={textareaRef}
            value={value}
            onValueChange={setValue}
            onSubmit={send}
            sending={sending}
            placeholder={COMPOSER_PLACEHOLDER}
          />
          {error && (
            <p role="alert" className="px-1 text-body text-danger">
              {error}
            </p>
          )}
        </div>
        {isFirstRun && <StarterPrompts onPick={pickStarter} />}
      </div>

      <NeedsYou items={feed.needsYou} />
      <Today items={feed.activity} />
    </div>
  )
}
