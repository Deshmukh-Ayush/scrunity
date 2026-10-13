import type { ToolPart } from "@/components/ui/tool"

export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  toolCalls?: ToolPart[]
  createdAt?: string | Date
}

export interface LinkedCampaign {
  id: string
  companyName: string
  segmentName: string
  currentStage: string
  status: string
}

/** A conversation pre-loaded on the server for /dashboard/chat?id=… */
export interface InitialConversation {
  id: string
  title: string | null
  messages: ChatMessage[]
  linkedCampaign: LinkedCampaign | null
}
