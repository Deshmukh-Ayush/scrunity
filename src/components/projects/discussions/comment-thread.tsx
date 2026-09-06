"use client";

import { useState, useRef, useEffect, ChangeEvent, KeyboardEvent, FormEvent, SVGProps } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2, Send } from "lucide-react";
import posthog from "posthog-js";

type CommentType = {
  comment: {
    id: string;
    body: string;
    createdAt: Date;
    userId: string | null;
  };
  author: {
    name: string | null;
    image: string | null;
  } | null;
};

export function CommentThread({ 
  projectId, 
  deliverableId,
  comments,
  currentUserId,
  currentUserRole
}: { 
  projectId: string;
  deliverableId?: string;
  comments: CommentType[];
  currentUserId: string;
  currentUserRole: string;
}) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Auto-scroll to bottom on mount or new comment
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [newComment]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
  
    setIsSubmitting(true);
    try {
      const res = await axios.post('/api/comments', { projectId, body: newComment.trim(), deliverableId });
      if (res.data.success) {
        posthog.capture("comment_created", {
          is_deliverable_comment: Boolean(deliverableId),
        });
        setNewComment("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await axios.delete(`/api/comments?commentId=${commentId}`);
      if (res.data.success) {
        toast.success("Comment deleted");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete comment");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative bg-background/50">
      <style dangerouslySetInnerHTML={{__html: `
        .comment-enter {
          opacity: 1;
          transform: translateY(0) scale(1);
          transition: opacity 250ms cubic-bezier(0.23, 1, 0.32, 1), transform 250ms cubic-bezier(0.23, 1, 0.32, 1);
        }
        @starting-style {
          .comment-enter {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
        }
        
        /* Smooth stagger */
        .stagger-1 { transition-delay: 0ms; }
        .stagger-2 { transition-delay: 40ms; }
        .stagger-3 { transition-delay: 80ms; }
        .stagger-4 { transition-delay: 120ms; }
        .stagger-5 { transition-delay: 160ms; }
      `}} />

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto hide-scrollbar px-4 pt-6 pb-36 flex flex-col gap-6"
      >
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground/60 space-y-4 py-16 opacity-0 animate-[fadeIn_400ms_ease-out_forwards]">
            <div className="bg-muted/30 p-5 rounded-full border border-border/20 shadow-sm">
              <MessageSquareIcon className="w-8 h-8 opacity-40" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[14px] font-medium text-foreground/80">No discussions yet</p>
              <p className="text-[13px] text-balance max-w-[250px]">Send a message to start the conversation.</p>
            </div>
          </div>
        ) : (
          comments.map(({ comment, author }, i) => {
            const isMe = comment.userId === currentUserId;
            const canDelete = isMe || currentUserRole === 'owner';
            const staggerClass = i < 5 ? `stagger-${i + 1}` : '';

            return (
              <div 
                key={comment.id} 
                className={`group flex gap-3 max-w-[85%] comment-enter ${staggerClass} ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                {!isMe && (
                  <Avatar className="w-8 h-8 shrink-0 ring-1 ring-border/20 shadow-sm self-end mb-1">
                    <AvatarImage src={author?.image || ""} />
                    <AvatarFallback className="bg-muted text-[11px] font-medium text-foreground/70">
                      {author?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    {!isMe && (
                      <span className="text-[12px] font-medium text-foreground/80">
                        {author?.name || "Unknown"}
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-muted-foreground/50 tabular-nums">
                      {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div className="relative group/bubble">
                    <div className={`px-4 py-2.5 rounded-[20px] text-[13px] leading-[1.5] break-words whitespace-pre-wrap shadow-sm transition-all duration-200
                      ${isMe 
                        ? 'bg-primary text-primary-foreground rounded-br-[4px]' 
                        : 'bg-muted/60 border border-border/40 text-foreground/90 rounded-bl-[4px] backdrop-blur-sm'
                      }`}
                    >
                      {comment.body}
                    </div>
                    
                    {canDelete && (
                      <button 
                        onClick={() => handleDelete(comment.id)}
                        className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/bubble:opacity-100 transition-all duration-200 p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 active:scale-[0.97] rounded-full
                          ${isMe ? '-left-9' : '-right-9'}
                        `}
                        title="Delete message"
                        aria-label="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Glassmorphism Composer Fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pt-8 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
        <div className="relative flex flex-col bg-background/80 backdrop-blur-xl border border-border/50 rounded-[20px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] focus-within:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] focus-within:border-border/80 transition-all duration-300 pointer-events-auto overflow-hidden">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
            placeholder="Message..."
            className="w-full bg-transparent border-0 px-4 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-0 min-h-[52px] max-h-[200px] hide-scrollbar"
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/40 pl-2">
              <span className="hidden sm:inline-block">Press Enter to send</span>
            </div>
            
            <Button 
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !newComment.trim()} 
              size="sm"
              className="h-8 w-8 p-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] disabled:opacity-40 disabled:scale-100 flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageSquareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}