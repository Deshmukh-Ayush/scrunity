"use client";

import * as React from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Target,
  Sparkles,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isToday, isYesterday, isAfter, subDays } from "date-fns";

export interface UnifiedConversationItem {
  id: string;
  title: string | null;
  outreachCampaignId?: string | null;
  researchRunId?: string | null;
  companyName?: string | null;
  segmentName?: string | null;
  currentStage?: string | null;
  campaignStatus?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export function groupConversationsByRecency(
  conversations: UnifiedConversationItem[]
) {
  const groups: {
    today: UnifiedConversationItem[];
    yesterday: UnifiedConversationItem[];
    previous7Days: UnifiedConversationItem[];
    older: UnifiedConversationItem[];
  } = {
    today: [],
    yesterday: [],
    previous7Days: [],
    older: [],
  };

  const sevenDaysAgo = subDays(new Date(), 7);

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt || conv.createdAt);
    if (isToday(date)) {
      groups.today.push(conv);
    } else if (isYesterday(date)) {
      groups.yesterday.push(conv);
    } else if (isAfter(date, sevenDaysAgo)) {
      groups.previous7Days.push(conv);
    } else {
      groups.older.push(conv);
    }
  }

  return groups;
}

interface AgentConversationNavProps {
  isCollapsed?: boolean;
  activeConversationId?: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  className?: string;
}

export function AgentConversationNav({
  isCollapsed = false,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  className,
}: AgentConversationNavProps) {
  const [conversations, setConversations] = React.useState<
    UnifiedConversationItem[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");

  const loadConversations = React.useCallback(async () => {
    try {
      const res = await fetch("/api/gtm/chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadConversations();

    const handleUpdate = () => {
      loadConversations();
    };

    window.addEventListener("gtm:conversations-changed", handleUpdate);
    return () => {
      window.removeEventListener("gtm:conversations-changed", handleUpdate);
    };
  }, [loadConversations]);

  const handleDeleteConversation = async (
    e: React.MouseEvent,
    id: string
  ) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/gtm/chat/conversations/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
          onNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const filteredConversations = React.useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        (c.segmentName && c.segmentName.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  const grouped = React.useMemo(
    () => groupConversationsByRecency(filteredConversations),
    [filteredConversations]
  );

  if (isCollapsed) {
    return (
      <div className={cn("flex flex-col items-center py-3 gap-2", className)}>
        <Button
          onClick={onNewChat}
          size="icon"
          variant="outline"
          className="size-9 rounded-xl border-border/80 shadow-2xs text-primary"
          title="New Chat"
        >
          <Plus className="size-4" />
        </Button>

        <div className="w-8 border-b border-border/50 my-1" />

        <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-220px)] custom-scrollbar">
          {conversations.slice(0, 10).map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectConversation(conv.id)}
                title={conv.title || "Conversation"}
                className={cn(
                  "p-2 rounded-lg transition-colors flex items-center justify-center",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium shadow-2xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {conv.outreachCampaignId ? (
                  <Target className="size-4 shrink-0 text-primary" />
                ) : (
                  <MessageSquare className="size-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col flex-1 min-h-0 overflow-hidden", className)}>
      {/* Action Bar: New Chat & Search */}
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <Button
          onClick={onNewChat}
          size="sm"
          variant="outline"
          className="w-full justify-start gap-2 h-8.5 text-xs font-medium border-border/80 bg-background hover:bg-muted/60 transition-all rounded-lg shadow-2xs"
        >
          <Plus className="size-3.5 text-primary" />
          <span>New chat</span>
        </Button>

        <div className="relative">
          <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="h-8 pl-8 pr-2.5 text-xs bg-background/80 border-border/60 rounded-lg placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Grouped Conversation History List */}
      <ScrollArea className="flex-1 px-3 py-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-xs">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading history...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-10 px-3 text-xs text-muted-foreground">
            <MessageSquare className="size-6 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No conversations found</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">
              Start a new chat to ask questions or run GTM tasks.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5 pb-4">
            {/* Today */}
            {grouped.today.length > 0 && (
              <ConversationSection
                title="Today"
                items={grouped.today}
                activeId={activeConversationId}
                onSelect={onSelectConversation}
                onDelete={handleDeleteConversation}
              />
            )}

            {/* Yesterday */}
            {grouped.yesterday.length > 0 && (
              <ConversationSection
                title="Yesterday"
                items={grouped.yesterday}
                activeId={activeConversationId}
                onSelect={onSelectConversation}
                onDelete={handleDeleteConversation}
              />
            )}

            {/* Previous 7 Days */}
            {grouped.previous7Days.length > 0 && (
              <ConversationSection
                title="Previous 7 Days"
                items={grouped.previous7Days}
                activeId={activeConversationId}
                onSelect={onSelectConversation}
                onDelete={handleDeleteConversation}
              />
            )}

            {/* Older */}
            {grouped.older.length > 0 && (
              <ConversationSection
                title="Older"
                items={grouped.older}
                activeId={activeConversationId}
                onSelect={onSelectConversation}
                onDelete={handleDeleteConversation}
              />
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ConversationSection({
  title,
  items,
  activeId,
  onSelect,
  onDelete,
}: {
  title: string;
  items: UnifiedConversationItem[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-muted-foreground/70 px-2 mb-1 uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-0.5">
        {items.map((conv) => {
          const isActive = conv.id === activeId;
          const isLinkedCampaign = Boolean(conv.outreachCampaignId);

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium shadow-2xs"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {isLinkedCampaign ? (
                  <Target className="size-3.5 shrink-0 text-primary opacity-80" />
                ) : (
                  <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs leading-tight">
                    {conv.title || "Untitled conversation"}
                  </p>
                  {isLinkedCampaign && conv.companyName && (
                    <p className="text-[10px] text-muted-foreground/70 truncate leading-none mt-0.5">
                      {conv.companyName} {conv.segmentName ? `· ${conv.segmentName}` : ""}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => onDelete(e, conv.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0"
                title="Delete conversation"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
