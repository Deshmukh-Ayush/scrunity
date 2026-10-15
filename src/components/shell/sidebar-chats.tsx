"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Plus } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import { CONVERSATIONS_CHANGED } from "@/components/chat/chat-events"
import { SidebarGroup, SidebarItem } from "./sidebar-item"
import { useStoredBoolean } from "./use-stored-boolean"

interface ChatSummary {
  id: string
  title: string | null
}

const RECENT_LIMIT = 12

/**
 * The sidebar's Chats group: the organization's recent agent chats (only
 * chats with at least one message, from GET /api/gtm/chat/conversations) and
 * a "New chat" link to Home, where the composer lives. Open or closed is
 * remembered per user. The list refetches when a chat changes
 * (gtm:conversations-changed, sent by the chat page).
 */
export function SidebarChats({ userId }: { userId: string }) {
  const pathname = usePathname()
  const activeId = useSearchParams().get("id")
  const [open, setOpen] = useStoredBoolean(
    `scrunity:sidebar:chats-open:${userId}`,
    true
  )
  const [chats, setChats] = React.useState<ChatSummary[] | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/gtm/chat/conversations")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled)
          setChats((data.conversations ?? []).slice(0, RECENT_LIMIT))
      } catch (err) {
        console.error("Failed to load chats:", err)
      }
    }
    load()
    window.addEventListener(CONVERSATIONS_CHANGED, load)
    return () => {
      cancelled = true
      window.removeEventListener(CONVERSATIONS_CHANGED, load)
    }
  }, [])

  return (
    <SidebarGroup
      label="Chats"
      open={open}
      onOpenChange={setOpen}
      action={
        <Link
          href="/dashboard"
          aria-label="New chat"
          title="New chat"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-sm border border-transparent text-fg-muted outline-none",
            "transition-[background-color,color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
            "ui-hover:bg-muted ui-hover:text-fg-strong ui-focus:focus-ring"
          )}
        >
          <Plus className="size-4" />
        </Link>
      }
    >
      <ul role="list" className="flex flex-col gap-px">
        {chats?.map((chat) => (
          <li key={chat.id}>
            <SidebarItem
              href={`/dashboard/chat?id=${chat.id}`}
              label={chat.title || "Untitled chat"}
              title={chat.title || "Untitled chat"}
              current={pathname === "/dashboard/chat" && activeId === chat.id}
              className="font-normal"
            />
          </li>
        ))}
        {chats?.length === 0 && (
          <li className="px-2 py-1 text-meta font-normal text-fg-muted">
            Chats you start on Home show up here.
          </li>
        )}
      </ul>
    </SidebarGroup>
  )
}
