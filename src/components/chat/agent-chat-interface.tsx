"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Bot,
  Sparkles,
  Target,
  Users,
  Search,
  Mail,
  Loader2,
  StopCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from "@/components/ui/prompt-input";
import { Tool, type ToolPart } from "@/components/ui/tool";
import { Markdown } from "@/components/ui/markdown";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolPart[];
  createdAt?: string | Date;
}

export function AgentChatInterface() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlConvId = searchParams.get("id");

  const [activeConversationId, setActiveConversationId] = React.useState<
    string | null
  >(urlConvId);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] =
    React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [activeTitle, setActiveTitle] = React.useState<string | null>(null);
  const [linkedCampaign, setLinkedCampaign] = React.useState<{
    id: string;
    companyName: string;
    segmentName: string;
    currentStage: string;
    status: string;
  } | null>(null);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Load single conversation messages
  const loadConversation = React.useCallback(async (id: string) => {
    try {
      setIsLoadingConversation(true);
      setActiveConversationId(id);
      const res = await fetch(`/api/gtm/chat/conversations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setActiveTitle(data.conversation?.title || null);
        setLinkedCampaign(data.linkedCampaign || null);
      }
    } catch (err) {
      console.error("Failed to load conversation details:", err);
    } finally {
      setIsLoadingConversation(false);
    }
  }, []);

  // Sync with URL search params
  React.useEffect(() => {
    if (urlConvId) {
      if (urlConvId !== activeConversationId || messages.length === 0) {
        loadConversation(urlConvId);
      }
    } else {
      setActiveConversationId(null);
      setActiveTitle(null);
      setMessages([]);
      setLinkedCampaign(null);
    }
  }, [urlConvId, loadConversation]);

  // Listen to external selection events
  React.useEffect(() => {
    const handleSelected = (e: any) => {
      const id = e.detail?.id;
      if (id) {
        loadConversation(id);
      } else {
        setActiveConversationId(null);
        setActiveTitle(null);
        setMessages([]);
        setLinkedCampaign(null);
      }
    };

    window.addEventListener("gtm:conversation-selected", handleSelected);
    return () => {
      window.removeEventListener("gtm:conversation-selected", handleSelected);
    };
  }, [loadConversation]);

  // Start fresh chat / reset
  const handleNewChat = React.useCallback(() => {
    setActiveConversationId(null);
    setActiveTitle(null);
    setMessages([]);
    setLinkedCampaign(null);
    setInputValue("");
    router.push("/dashboard/chat");
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("gtm:conversation-selected", { detail: { id: null } })
      );
    }
  }, [router]);

  // Send message
  const handleSendMessage = React.useCallback(
    async (promptText?: string) => {
      const textToSend = (promptText || inputValue).trim();
      if (!textToSend || isGenerating) return;

      setInputValue("");
      setIsGenerating(true);

      let targetConvId = activeConversationId;

      // 1. If no active conversation, create one first
      if (!targetConvId) {
        try {
          const createRes = await fetch("/api/gtm/chat/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: textToSend.slice(0, 50),
            }),
          });
          if (createRes.ok) {
            const data = await createRes.json();
            targetConvId = data.conversation.id;
            setActiveConversationId(targetConvId);
            setActiveTitle(data.conversation.title);

            // Update URL without full page reload
            if (typeof window !== "undefined") {
              window.history.replaceState(
                null,
                "",
                `/dashboard/chat?id=${targetConvId}`
              );
              window.dispatchEvent(
                new CustomEvent("gtm:conversations-changed")
              );
              window.dispatchEvent(
                new CustomEvent("gtm:conversation-selected", {
                  detail: { id: targetConvId },
                })
              );
            }
          }
        } catch (e) {
          console.error("Error creating conversation:", e);
        }
      }

      const userMsgId = `user-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userMsgId,
        role: "user",
        content: textToSend,
        createdAt: new Date(),
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        toolCalls: [],
        createdAt: new Date(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages([...updatedMessages, assistantMessage]);

      // Persist user message to DB in background
      if (targetConvId) {
        fetch("/api/gtm/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: targetConvId,
            id: userMsgId,
            role: "user",
            content: textToSend,
          }),
        }).catch((err) => console.error("Error saving user message:", err));
      }

      // 2. Stream AI response with tools
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      let accumulatedContent = "";
      const toolSteps: ToolPart[] = [];

      try {
        const apiMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/gtm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            companyName: linkedCampaign?.companyName,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`Chat API error HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error("No response stream available.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const payloadStr = trimmed.replace(/^data:\s*/, "");
            if (payloadStr === "[DONE]") continue;

            try {
              const part = JSON.parse(payloadStr);

              switch (part.type) {
                case "text-delta": {
                  if (typeof part.delta === "string") {
                    accumulatedContent += part.delta;
                  }
                  break;
                }
                case "tool-input-available":
                case "tool-call": {
                  const tName = part.toolName || part.name;
                  const tId = part.toolCallId || part.id;
                  const existingIdx = toolSteps.findIndex(
                    (t) => t.toolCallId === tId
                  );
                  const newTool: ToolPart = {
                    type: tName || "tool",
                    state: "input-streaming",
                    input: part.input || part.args || {},
                    toolCallId: tId,
                  };
                  if (existingIdx >= 0) {
                    toolSteps[existingIdx] = newTool;
                  } else {
                    toolSteps.push(newTool);
                  }
                  break;
                }
                case "tool-output-available":
                case "tool-result": {
                  const tId = part.toolCallId || part.id;
                  const matchIdx = toolSteps.findIndex(
                    (t) => t.toolCallId === tId
                  );
                  if (matchIdx >= 0) {
                    toolSteps[matchIdx].state = "output-available";
                    toolSteps[matchIdx].output = part.output || part.result;
                  }
                  break;
                }
                case "tool-input-error":
                case "tool-output-error": {
                  const tId = part.toolCallId || part.id;
                  const matchIdx = toolSteps.findIndex(
                    (t) => t.toolCallId === tId
                  );
                  if (matchIdx >= 0) {
                    toolSteps[matchIdx].state = "output-error";
                    toolSteps[matchIdx].errorText =
                      part.errorText || part.error || "Execution failed";
                  }
                  break;
                }
                case "error": {
                  if (typeof part.errorText === "string") {
                    accumulatedContent += `\n\n*Error: ${part.errorText}*`;
                  }
                  break;
                }
              }

              // Live update of message content and tool steps
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: accumulatedContent,
                        toolCalls: [...toolSteps],
                      }
                    : msg
                )
              );
            } catch {
              // Ignore non-json chunks
            }
          }
        }

        // Final message fallback
        const finalContent =
          accumulatedContent.trim() ||
          (toolSteps.length > 0
            ? "Completed requested actions across your GTM pipeline."
            : "I am ready to help manage your campaigns and pipeline.");

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: finalContent,
                  toolCalls: [...toolSteps],
                }
              : msg
          )
        );

        // Persist assistant message to DB
        if (targetConvId) {
          fetch("/api/gtm/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: targetConvId,
              id: assistantMsgId,
              role: "assistant",
              content: finalContent,
              toolCalls: toolSteps.length > 0 ? toolSteps : undefined,
            }),
          }).catch((err) =>
            console.error("Error saving assistant message:", err)
          );

          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("gtm:conversations-changed"));
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Chat error:", err);
          const fallbackText =
            "I encountered an error querying the GTM pipeline. Please try again.";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: fallbackText,
                    toolCalls: [...toolSteps],
                  }
                : msg
            )
          );
        }
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [
      inputValue,
      isGenerating,
      activeConversationId,
      messages,
      linkedCampaign,
    ]
  );

  const handleStopGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-background relative overflow-hidden">
      {/* Top Header */}
      <header className="h-12 border-b border-border/60 px-5 flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            {linkedCampaign
              ? `${linkedCampaign.companyName} — ${linkedCampaign.segmentName}`
              : activeTitle || (activeConversationId ? "Conversation" : "New Chat")}
          </span>

          {linkedCampaign && (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0 border-primary/30 bg-primary/10 text-primary capitalize font-mono shrink-0"
            >
              {linkedCampaign.currentStage.replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <RotateCcw className="size-3" />
              Reset
            </Button>
          )}
        </div>
      </header>

      {/* Scrolling Message Thread */}
      <ChatContainerRoot className="flex-1 px-4 md:px-8 py-6 space-y-6">
        <ChatContainerContent className="max-w-3xl mx-auto w-full space-y-6">
          {isLoadingConversation ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground text-xs">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Loading conversation thread...</span>
            </div>
          ) : messages.length === 0 ? (
            /* Welcome / Starter Prompts Screen */
            <div className="py-12 md:py-20 flex flex-col items-center text-center space-y-6">
              <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Sparkles className="size-6" />
              </div>

              <div className="space-y-1.5 max-w-md">
                <h1 className="text-lg font-semibold text-foreground tracking-tight">
                  How can I assist your GTM pipeline today?
                </h1>
                <p className="text-xs text-muted-foreground">
                  Ask questions about your campaigns, look up verified contacts,
                  or inspect market intelligence with live tool actions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage(
                      "What is the live status of our active outreach campaigns?"
                    )
                  }
                  className="p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                    <Target className="size-3.5" />
                    <span>Campaign Status</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Check execution stage and prospect counts across pipelines.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage(
                      "Find target prospect companies and contacts discovered by the agent"
                    )
                  }
                  className="p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                    <Users className="size-3.5" />
                    <span>Prospect Contacts</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Look up scraped decision-makers, titles, and verified emails.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage(
                      "Show discovered competitor positioning and market intelligence"
                    )
                  }
                  className="p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                    <Search className="size-3.5" />
                    <span>Market Intelligence</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Review competitor domains and ICP segment positioning.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSendMessage(
                      "Check if our outbound sending mailbox is connected"
                    )
                  }
                  className="p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border transition-all text-xs group"
                >
                  <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
                    <Mail className="size-3.5" />
                    <span>Mailbox Status</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Verify Google Workspace or SMTP sending configuration.
                  </p>
                </button>
              </div>
            </div>
          ) : (
            /* Message Thread */
            messages.map((message) => {
              const isUser = message.role === "user";

              if (isUser) {
                return (
                  <div key={message.id} className="flex justify-end w-full">
                    <div className="bg-muted/80 text-foreground border border-border/70 rounded-2xl px-4 py-2.5 max-w-[85%] text-xs leading-relaxed shadow-2xs whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </div>
                );
              }

              // Assistant Turn
              return (
                <div key={message.id} className="flex items-start gap-3 w-full">
                  <div className="size-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="size-4" />
                  </div>

                  <div className="flex-1 space-y-3 min-w-0">
                    {/* Inline Tool Call Cards */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="space-y-2">
                        {message.toolCalls.map((toolCall, idx) => (
                          <Tool
                            key={toolCall.toolCallId || idx}
                            toolPart={toolCall}
                            defaultOpen={false}
                            className="text-xs"
                          />
                        ))}
                      </div>
                    )}

                    {/* Markdown Output */}
                    {message.content ? (
                      <div className="text-xs leading-relaxed text-foreground prose-sm dark:prose-invert">
                        <Markdown>{message.content}</Markdown>
                      </div>
                    ) : (
                      isGenerating && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                          <span>Agent is analyzing...</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}

          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      {/* Fixed Composer at Bottom */}
      <div className="p-4 md:p-6 bg-background/80 backdrop-blur-xs border-t border-border/50 shrink-0">
        <div className="max-w-3xl mx-auto w-full">
          <PromptInput
            value={inputValue}
            onValueChange={setInputValue}
            onSubmit={() => handleSendMessage()}
            disabled={isGenerating}
            className="bg-muted/30 border-border/80 rounded-2xl p-2 transition-all focus-within:border-primary/50 focus-within:bg-background focus-within:shadow-xs"
          >
            <PromptInputTextarea
              placeholder="Ask about campaigns, search prospects, or give instructions..."
              className="text-xs min-h-[44px] max-h-36 resize-none px-3 py-2"
            />

            <PromptInputActions className="justify-between px-2 pt-1">
              <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                Press <kbd className="font-mono">Enter</kbd> to send, <kbd className="font-mono">Shift+Enter</kbd> for new line
              </span>

              <div className="flex items-center gap-2">
                {isGenerating ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleStopGeneration}
                    className="size-8 rounded-full p-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                    title="Stop generating"
                  >
                    <StopCircle className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!inputValue.trim() || isGenerating}
                    onClick={() => handleSendMessage()}
                    className="size-8 rounded-full p-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 shadow-xs"
                    title="Send message"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
