"use client"

import * as React from "react"
import { XCircleSolid } from "@/components/icons/status"
import Link from "next/link"
import { AlertCircle, Building2, ExternalLink, Info, Mail, Send, User, VolumeX } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MailboxMessage, MailboxThread } from "@/lib/mailbox-thread-types"
import { IntentBadge } from "./intent-badge"
import { MessageTimestamp, ThreadTimestamp } from "./mailbox-time"

function MessageCard({ msg }: { msg: MailboxMessage }) {
  return (
    <article
      data-direction={msg.isOutbound ? "outbound" : "inbound"}
      className={cn(
        "space-y-3 rounded-xl p-4.5 shadow-2xs transition-all shadow-surface",
        "data-[direction=outbound]:border-border/80 data-[direction=outbound]:bg-card",
        "data-[direction=inbound]:border-primary/30 data-[direction=inbound]:bg-primary/5 dark:data-[direction=inbound]:bg-primary/10"
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              msg.isOutbound
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-primary/30 bg-primary/10 text-primary"
            )}
          >
            {msg.fromName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {msg.fromName}
              </span>
              <Badge
                variant="neutral"
                className={cn(
                  "px-1 py-0 text-[9px] font-medium",
                  msg.isOutbound
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-primary/30 bg-primary/5 text-primary"
                )}>
                {msg.isOutbound
                  ? "Outbound Sent Email"
                  : "Prospect Inbound Reply"}
              </Badge>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              from: {msg.from} • to: {msg.to}
            </span>
          </div>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          <MessageTimestamp value={msg.timestamp} />
        </span>
      </div>
      <div className="space-y-2 font-sans text-xs leading-relaxed whitespace-pre-wrap text-foreground">
        {msg.body}
      </div>
    </article>
  )
}

/**
 * Manual replies are not wired up yet (sends go through the Stage 7 queue), so
 * the composer is visibly disabled. Muting is local-only for now.
 */
function ReplyComposer({ contactName }: { contactName: string }) {
  const [replyText, setReplyText] = React.useState("")
  const [isMuted, setIsMuted] = React.useState(false)

  return (
    <div className="space-y-3 border-t border-border/70 bg-card/50 p-4">
      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        rows={3}
        placeholder={`Write a reply to ${contactName}...`}
        aria-label={`Reply to ${contactName}`}
        className="w-full resize-none rounded-lg border border-border/80 bg-background p-3 text-xs leading-relaxed focus:ring-1 focus:ring-primary focus:outline-hidden"
      />
      <div className="flex items-center justify-between gap-3 pt-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            aria-pressed={isMuted}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
              "aria-pressed:bg-muted aria-pressed:font-medium aria-pressed:text-foreground"
            )}
          >
            <VolumeX className="size-3.5" />
            <span>{isMuted ? "Thread Muted" : "Mute Thread"}</span>
          </button>
          <div className="hidden items-center gap-1 pl-2 text-[11px] text-muted-foreground/80 md:flex">
            <Info className="size-3" />
            <span>Sending is throttled via stage 7 Gmail pipeline</span>
          </div>
        </div>

        <Button
          disabled
          variant="secondary"
          size="sm"
          className="gap-1.5"
          title="Direct manual response sending routes through background Stage 7 dispatch queue"
        >
          <Send className="size-3.5" />
          <span>Send Reply (Automated Queue)</span>
        </Button>
      </div>
    </div>
  )
}

/** Full conversation for the selected thread (right pane). */
export function ThreadDetail({ thread }: { thread: MailboxThread | null }) {
  if (!thread) {
    return (
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden bg-background sm:flex">
        <div className="flex flex-1 flex-col items-center justify-center space-y-2 p-8 text-center text-muted-foreground">
          <Mail className="size-8 stroke-[1.5] text-muted-foreground/40" />
          <p className="text-xs font-medium text-foreground">
            No conversation selected
          </p>
          <p className="max-w-xs text-[11px]">
            Select a thread from the list on the left to read full message
            details and prospect replies.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="hidden min-h-0 flex-1 flex-col overflow-hidden bg-background sm:flex">
      <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-card/30 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {thread.subject}
            </h2>
            {thread.isBounced && (
              <Badge
                variant="danger"
                className="gap-1">
                <XCircleSolid className="size-3" /> Delivery Bounced
              </Badge>
            )}
            <IntentBadge intent={thread.classifiedIntent} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 font-medium text-foreground">
              <User className="size-3.5 text-muted-foreground" />
              <span>{thread.contact.name}</span>
              {thread.contact.title && (
                <span className="font-normal text-muted-foreground">
                  ({thread.contact.title})
                </span>
              )}
            </div>
            {thread.company.name && (
              <div className="flex items-center gap-1">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span>{thread.company.name}</span>
              </div>
            )}
            <Link
              href={`/dashboard/campaigns/${thread.campaign.id}`}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <span>Campaign: {thread.campaign.name}</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <span className="block font-mono text-[11px] text-muted-foreground">
            {thread.contact.email || "No email"}
          </span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
            First sent: <ThreadTimestamp value={thread.sentAt} />
          </span>
        </div>
      </div>

      {thread.isBounced && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-tint p-3 text-xs text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="space-y-0.5">
            <p className="font-semibold">Email Delivery Failed (Bounced)</p>
            <p className="text-[11px] text-muted-foreground">
              {thread.bounceReason ||
                "Recipient address not found (550). This contact requires re-discovery before outreach can resume."}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {thread.messages.map((msg, index) => (
          <MessageCard key={msg.id || index} msg={msg} />
        ))}
      </div>

      <ReplyComposer key={thread.id} contactName={thread.contact.name} />
    </div>
  )
}
