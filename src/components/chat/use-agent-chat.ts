"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  applyStreamPart,
  readSseEvents,
  type StreamAccumulator,
} from "./chat-stream"
import type { ChatMessage, InitialConversation, LinkedCampaign } from "./types"

const CONVERSATIONS_CHANGED = "gtm:conversations-changed"
const CONVERSATION_SELECTED = "gtm:conversation-selected"

const emit = (name: string, detail?: unknown) =>
  window.dispatchEvent(
    new CustomEvent(name, detail === undefined ? undefined : { detail })
  )

function persistMessage(body: Record<string, unknown>) {
  return fetch("/api/gtm/chat/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/**
 * State and actions for the agent chat: the open conversation (from the URL or
 * the sidebar's selection event), sending a prompt, and streaming the reply.
 */
export function useAgentChat(initialConversation: InitialConversation | null) {
  const router = useRouter()
  const urlConvId = useSearchParams().get("id")

  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(initialConversation?.id ?? urlConvId)
  const [messages, setMessages] = React.useState<ChatMessage[]>(
    initialConversation?.messages ?? []
  )
  const [activeTitle, setActiveTitle] = React.useState<string | null>(
    initialConversation?.title ?? null
  )
  const [linkedCampaign, setLinkedCampaign] =
    React.useState<LinkedCampaign | null>(
      initialConversation?.linkedCampaign ?? null
    )
  const [isLoadingConversation, setIsLoadingConversation] =
    React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  const clearConversation = React.useCallback(() => {
    setActiveConversationId(null)
    setActiveTitle(null)
    setMessages([])
    setLinkedCampaign(null)
  }, [])

  const loadConversation = React.useCallback(async (id: string) => {
    try {
      setIsLoadingConversation(true)
      setActiveConversationId(id)
      const res = await fetch(`/api/gtm/chat/conversations/${id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setActiveTitle(data.conversation?.title || null)
        setLinkedCampaign(data.linkedCampaign || null)
      }
    } catch (err) {
      console.error("Failed to load conversation details:", err)
    } finally {
      setIsLoadingConversation(false)
    }
  }, [])

  // Follow ?id= changes. The server already loaded the initial conversation, so
  // this only fetches when the URL points somewhere else.
  React.useEffect(() => {
    if (!urlConvId) {
      clearConversation()
    } else if (urlConvId !== activeConversationId || messages.length === 0) {
      loadConversation(urlConvId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConvId, loadConversation])

  // The sidebar announces selections with a window event instead of navigating.
  React.useEffect(() => {
    const handleSelected = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string | null }>).detail?.id
      if (id) loadConversation(id)
      else clearConversation()
    }
    window.addEventListener(CONVERSATION_SELECTED, handleSelected)
    return () =>
      window.removeEventListener(CONVERSATION_SELECTED, handleSelected)
  }, [loadConversation, clearConversation])

  const startNewChat = React.useCallback(() => {
    clearConversation()
    router.push("/dashboard/chat")
    emit(CONVERSATION_SELECTED, { id: null })
  }, [router, clearConversation])

  /** Creates a conversation titled after the first prompt and points the URL at it. */
  const createConversation = async (title: string) => {
    try {
      const res = await fetch("/api/gtm/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.slice(0, 50) }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const id: string = data.conversation.id
      setActiveConversationId(id)
      setActiveTitle(data.conversation.title)
      window.history.replaceState(null, "", `/dashboard/chat?id=${id}`)
      emit(CONVERSATIONS_CHANGED)
      emit(CONVERSATION_SELECTED, { id })
      return id
    } catch (e) {
      console.error("Error creating conversation:", e)
      return null
    }
  }

  const sendMessage = async (text: string) => {
    const prompt = text.trim()
    if (!prompt || isGenerating) return
    setIsGenerating(true)

    const conversationId =
      activeConversationId ?? (await createConversation(prompt))

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      createdAt: new Date(),
    }
    const assistantId = `assistant-${Date.now()}`
    const history = [...messages, userMessage]
    setMessages([
      ...history,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        createdAt: new Date(),
      },
    ])

    if (conversationId) {
      persistMessage({
        conversationId,
        id: userMessage.id,
        role: "user",
        content: prompt,
      }).catch((err) => console.error("Error saving user message:", err))
    }

    const updateAssistant = (
      content: string,
      toolCalls: ChatMessage["toolCalls"]
    ) =>
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content, toolCalls: [...(toolCalls || [])] }
            : m
        )
      )

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    const acc: StreamAccumulator = { content: "", toolSteps: [] }

    try {
      const res = await fetch("/api/gtm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          companyName: linkedCampaign?.companyName,
        }),
        signal: abortController.signal,
      })
      if (!res.ok) throw new Error(`Chat API error HTTP ${res.status}`)
      if (!res.body) throw new Error("No response stream available.")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const { events, rest } = readSseEvents(buffer)
        buffer = rest
        for (const event of events) {
          applyStreamPart(acc, event)
          updateAssistant(acc.content, acc.toolSteps)
        }
      }

      const finalContent =
        acc.content.trim() ||
        (acc.toolSteps.length > 0
          ? "Completed requested actions across your GTM pipeline."
          : "I am ready to help manage your campaigns and pipeline.")
      updateAssistant(finalContent, acc.toolSteps)

      if (conversationId) {
        persistMessage({
          conversationId,
          id: assistantId,
          role: "assistant",
          content: finalContent,
          toolCalls: acc.toolSteps.length > 0 ? acc.toolSteps : undefined,
        }).catch((err) => console.error("Error saving assistant message:", err))
        emit(CONVERSATIONS_CHANGED)
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Chat error:", err)
        updateAssistant(
          "I encountered an error querying the GTM pipeline. Please try again.",
          acc.toolSteps
        )
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const stopGenerating = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsGenerating(false)
    }
  }, [])

  return {
    activeConversationId,
    activeTitle,
    linkedCampaign,
    messages,
    isLoadingConversation,
    isGenerating,
    sendMessage,
    stopGenerating,
    startNewChat,
  }
}
