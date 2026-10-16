/**
 * Small client-side glue between Home, the chat page and the sidebar.
 *
 * - CONVERSATIONS_CHANGED: a window event the chat page sends after it saves
 *   a message, so the sidebar's Chats list refetches.
 * - Pending prompt: Home creates the chat, stores the first prompt here and
 *   navigates to /dashboard/chat?id=…; the chat page takes it on mount and
 *   sends it with the existing agent flow. It lives in module memory, so it
 *   survives client-side navigation only, and is read once.
 */
export const CONVERSATIONS_CHANGED = "gtm:conversations-changed"

export function emitConversationsChanged() {
  window.dispatchEvent(new CustomEvent(CONVERSATIONS_CHANGED))
}

const pendingPrompts = new Map<string, string>()

export function setPendingPrompt(conversationId: string, prompt: string) {
  pendingPrompts.set(conversationId, prompt)
}

export function takePendingPrompt(
  conversationId: string | null
): string | null {
  if (!conversationId) return null
  const prompt = pendingPrompts.get(conversationId) ?? null
  pendingPrompts.delete(conversationId)
  return prompt
}
