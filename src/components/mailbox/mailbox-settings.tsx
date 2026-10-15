"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Clock, Mail, Server } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ImapSmtpForm } from "./imap-smtp-form"
import type { ConnectedMailboxInfo } from "./types"

function Notice({
  tone,
  title,
  children,
}: {
  tone: "success" | "error"
  title: string
  children: React.ReactNode
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      data-tone={tone}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        "data-[tone=success]:border-success-border data-[tone=success]:bg-success-tint data-[tone=success]:text-success",
        "data-[tone=error]:border-danger-border data-[tone=error]:bg-danger-tint data-[tone=error]:text-danger"
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0 opacity-80" />
      <div className="space-y-0.5 text-xs">
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

function providerLabel(provider?: string) {
  if (provider === "microsoft") return "Microsoft 365 / Outlook"
  if (provider === "imap_smtp") return "Generic IMAP / SMTP"
  return "Google Workspace"
}

function providerDetail(mailbox: ConnectedMailboxInfo) {
  if (mailbox.provider === "microsoft")
    return "Connected via Microsoft Graph OAuth 2.0 (Mail.Send, Mail.Read, Mail.ReadWrite)"
  if (mailbox.provider === "imap_smtp") {
    const { smtp, imap } = mailbox.metadata || {}
    return `Connected via Custom SMTP (${smtp?.host || "configured"}:${smtp?.port || "587"}) & IMAP (${imap?.host || "configured"}:${imap?.port || "993"})`
  }
  return "Connected via Google OAuth 2.0 (gmail.send & gmail.readonly)"
}

function ConnectedMailboxCard({
  mailbox,
  onDisconnect,
}: {
  mailbox: ConnectedMailboxInfo
  onDisconnect: () => void
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-success-border bg-success-tint p-2.5 text-success">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <span>{mailbox.email}</span>
              <Badge
                variant="outline"
                className="border-success-border text-[10px] font-medium text-success"
              >
                {providerLabel(mailbox.provider)}
              </Badge>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {providerDetail(mailbox)}
            </div>
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDisconnect}
          className="h-8 text-xs"
        >
          Disconnect Mailbox
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-4 border-t border-border/40 pt-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="block text-[11px] text-muted-foreground">
            Daily Dispatch Throttling
          </dt>
          <dd className="mt-0.5 block text-xs font-medium text-foreground">
            50 emails/day cap
          </dd>
        </div>
        <div>
          <dt className="block text-[11px] text-muted-foreground">
            Reply Classification
          </dt>
          <dd className="mt-0.5 block text-xs font-medium text-success">
            Autonomous Stage 8 Polling Active
          </dd>
        </div>
        <div>
          <dt className="block text-[11px] text-muted-foreground">
            Today&apos;s Sends
          </dt>
          <dd className="mt-0.5 block text-xs font-medium text-foreground">
            {mailbox.dailySendCount || 0} / 50 dispatched
          </dd>
        </div>
      </dl>
    </div>
  )
}

function ProviderOptions({ onConnected }: { onConnected: () => void }) {
  const [showImapSmtpForm, setShowImapSmtpForm] = React.useState(false)

  return (
    <div className="space-y-6">
      <div className="space-y-2 rounded-xl border border-border/80 bg-card/60 p-5">
        <h4 className="text-xs font-semibold text-foreground">
          Choose Your Mailbox Connection Provider
        </h4>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Connect your outbound mailbox to send approved outreach drafts and
          automatically capture inbound prospective replies. Both OAuth 2.0 and
          manual IMAP/SMTP configurations are supported.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col justify-between space-y-4 rounded-xl border border-border/80 bg-card/40 p-5 transition-all hover:border-primary/50">
          <div className="space-y-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-danger-tint text-sm font-semibold text-danger">
              G
            </div>
            <h5 className="text-xs font-semibold text-foreground">
              Google Workspace / Gmail
            </h5>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Connect with OAuth 2.0 using least-privilege Gmail scopes (
              <code className="text-[10px]">gmail.send</code>,{" "}
              <code className="text-[10px]">gmail.readonly</code>).
            </p>
          </div>
          <a
            href="/api/gtm/mailbox/connect"
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 w-full gap-1.5 text-xs"
            )}
          >
            <Mail className="size-3.5" />
            Connect Google Account
          </a>
        </div>

        <div className="relative flex flex-col justify-between space-y-4 rounded-xl border border-border/50 bg-muted/20 p-5 opacity-80 select-none">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex size-9 items-center justify-center rounded-lg border border-border/40 bg-muted text-sm font-semibold text-muted-foreground">
                M
              </div>
              <Badge
                variant="secondary"
                className="border border-border/60 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                Coming Soon
              </Badge>
            </div>
            <div>
              <h5 className="text-xs font-semibold text-foreground/80">
                Microsoft 365 / Outlook
              </h5>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Microsoft 365 / Outlook support is coming soon — in the
                meantime, connect via Google or the generic IMAP/SMTP option.
              </p>
            </div>
          </div>
          <Button
            disabled
            variant="outline"
            className="h-9 w-full border-dashed border-border/80 bg-muted/30 text-xs text-muted-foreground"
          >
            <Clock className="mr-1 size-3.5" />
            Coming Soon
          </Button>
        </div>

        <div className="flex flex-col justify-between space-y-4 rounded-xl border border-border/80 bg-card/40 p-5 transition-all hover:border-primary/50">
          <div className="space-y-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-success-tint text-sm font-semibold text-success">
              <Server className="size-4" />
            </div>
            <h5 className="text-xs font-semibold text-foreground">
              Generic IMAP / SMTP
            </h5>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Connect any custom provider (Zoho, Fastmail, iCloud, Private
              Email) with credentials encrypted using AES-256-GCM.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowImapSmtpForm((open) => !open)}
            aria-expanded={showImapSmtpForm}
            className="h-9 w-full border-border/80 text-xs hover:bg-muted"
          >
            <Server className="mr-1 size-3.5" />
            {showImapSmtpForm ? "Close Form" : "Configure IMAP / SMTP"}
          </Button>
        </div>
      </div>

      {showImapSmtpForm && (
        <ImapSmtpForm
          onCancel={() => setShowImapSmtpForm(false)}
          onConnected={() => {
            setShowImapSmtpForm(false)
            onConnected()
          }}
        />
      )}
    </div>
  )
}

/**
 * The "Mailbox Settings" tab: OAuth/IMAP callback notices, then either the
 * connected mailbox or the provider options.
 */
export function MailboxSettings({
  mailbox,
  callbackConnected,
  callbackError,
  onDisconnect,
  onConnected,
}: {
  mailbox: ConnectedMailboxInfo | null
  callbackConnected: boolean
  callbackError: string | null
  onDisconnect: () => void
  onConnected: () => void
}) {
  const [imapConnected, setImapConnected] = React.useState(false)

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      {callbackConnected && (
        <Notice tone="success" title="Mailbox Connected Successfully">
          Your sending mailbox is verified. Throttled stage 7 campaign sends and
          stage 8 autonomous reply triage are now active.
        </Notice>
      )}
      {callbackError && (
        <Notice tone="error" title="Mailbox Connection Error">
          {decodeURIComponent(callbackError)}
        </Notice>
      )}
      {imapConnected && (
        <Notice tone="success" title="Mailbox connected successfully!">
          SMTP outbound transport and IMAP inbox reading are verified and ready.
        </Notice>
      )}

      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Connected Sending Mailbox
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Account used for throttled stage 7 cold outreach dispatch and
              stage 8 autonomous reply triage.
            </p>
          </div>

          {mailbox && mailbox.status === "connected" ? (
            <ConnectedMailboxCard
              mailbox={mailbox}
              onDisconnect={onDisconnect}
            />
          ) : (
            <ProviderOptions
              onConnected={() => {
                setImapConnected(true)
                onConnected()
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
