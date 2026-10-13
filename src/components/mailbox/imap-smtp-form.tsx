"use client"

import * as React from "react"
import { AlertTriangle, Check, Info, Loader2, Server } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const INITIAL_VALUES = {
  email: "",
  displayName: "",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  sameCredentials: true,
  imapHost: "",
  imapPort: "993",
  imapSecure: true,
  imapUser: "",
  imapPass: "",
}

type FormValues = typeof INITIAL_VALUES

/** Builds the POST body; IMAP falls back to the SMTP/mailbox credentials when shared. */
function toPayload(v: FormValues) {
  const smtpUser = (v.smtpUser || v.email).trim()
  return {
    email: v.email.trim(),
    displayName: v.displayName.trim() || undefined,
    smtp: {
      host: v.smtpHost.trim(),
      port: parseInt(v.smtpPort, 10),
      secure: Boolean(v.smtpSecure),
      user: smtpUser,
      pass: v.smtpPass,
    },
    imap: {
      host: v.imapHost.trim(),
      port: parseInt(v.imapPort, 10),
      secure: Boolean(v.imapSecure),
      user: v.sameCredentials ? smtpUser : (v.imapUser || v.email).trim(),
      pass: v.sameCredentials ? v.smtpPass : v.imapPass,
    },
  }
}

function Field({
  label,
  className,
  ...inputProps
}: { label: string } & React.ComponentProps<typeof Input>) {
  const id = React.useId()
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <label htmlFor={id} className="text-[11px] font-medium text-foreground">
        {label}
      </label>
      <Input id={id} className="h-8 bg-background text-xs" {...inputProps} />
    </div>
  )
}

/**
 * Manual SMTP (sending) + IMAP (reply reading) mailbox setup. The server tests
 * both connections before saving; `onConnected` runs after a successful save.
 */
export function ImapSmtpForm({
  onConnected,
  onCancel,
}: {
  onConnected: () => void
  onCancel: () => void
}) {
  const [values, setValues] = React.useState(INITIAL_VALUES)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const set =
    <K extends keyof FormValues>(key: K) =>
    (value: FormValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: value }))
  const text = (key: keyof FormValues) => ({
    value: values[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key)(e.target.value as never),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/gtm/mailbox/imap-smtp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to connect mailbox")
      onConnected()
    } catch (err: any) {
      setError(err.message || "Failed to connect mailbox")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-in space-y-5 rounded-xl border border-border/90 bg-card/60 p-6 duration-200 fade-in-50"
    >
      <div className="flex items-start justify-between border-b border-border/60 pb-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Server className="size-3.5 text-primary" />
            <span>Generic IMAP / SMTP Mailbox Settings</span>
          </h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Both SMTP (sending) and IMAP (reply listening) must be configured so
            autonomous stages function properly.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
        <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="space-y-1 text-[11px] leading-relaxed">
          <p className="font-semibold">
            App-Specific Passwords Required for 2FA Accounts
          </p>
          <p className="text-muted-foreground">
            If your mail provider (Zoho, iCloud, Fastmail, Yahoo, Google) has
            Two-Factor Authentication enabled, generate and enter an{" "}
            <strong>App Password</strong> rather than your primary login
            password.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-500/25 bg-rose-500/10 p-3.5 text-xs text-rose-800 dark:text-rose-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
          <div className="space-y-0.5 text-[11px]">
            <p className="font-semibold">Connection Verification Failed</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Mailbox Email Address *"
          type="email"
          required
          placeholder="outreach@company.com"
          {...text("email")}
        />
        <Field
          label="Sender Display Name (Optional)"
          placeholder="Sarah Jenkins"
          {...text("displayName")}
        />
      </div>

      <div className="space-y-3 border-t border-border/40 pt-2">
        <h5 className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
          Outbound SMTP Configuration (Stage 7 Dispatch)
        </h5>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="SMTP Host *"
            className="sm:col-span-2"
            required
            placeholder="smtp.zoho.com or mail.privateemail.com"
            {...text("smtpHost")}
          />
          <Field
            label="SMTP Port *"
            required
            type="number"
            placeholder="587"
            {...text("smtpPort")}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="SMTP Username *"
            required
            placeholder="outreach@company.com"
            {...text("smtpUser")}
          />
          <Field
            label="SMTP Password / App Password *"
            type="password"
            required
            placeholder="••••••••••••••••"
            {...text("smtpPass")}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="smtpSecure"
            checked={values.smtpSecure}
            onChange={(e) => set("smtpSecure")(e.target.checked)}
            className="rounded border-border/80"
          />
          <label
            htmlFor="smtpSecure"
            className="cursor-pointer text-xs text-muted-foreground"
          >
            Use SSL/TLS (port 465). Leave unchecked for STARTTLS (port 587).
          </label>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/40 pt-2">
        <div className="flex items-center justify-between">
          <h5 className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
            Inbound IMAP Configuration (Stage 8 Reply Triage)
          </h5>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={values.sameCredentials}
              onChange={(e) => set("sameCredentials")(e.target.checked)}
              className="rounded border-border/80"
            />
            <span>Use same credentials as SMTP</span>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field
            label="IMAP Host *"
            className="sm:col-span-2"
            required
            placeholder="imappro.zoho.com or mail.privateemail.com"
            {...text("imapHost")}
          />
          <Field
            label="IMAP Port *"
            required
            type="number"
            placeholder="993"
            {...text("imapPort")}
          />
        </div>
        {!values.sameCredentials && (
          <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
            <Field
              label="IMAP Username *"
              required
              placeholder="outreach@company.com"
              {...text("imapUser")}
            />
            <Field
              label="IMAP Password *"
              type="password"
              required
              placeholder="••••••••••••••••"
              {...text("imapPass")}
            />
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="imapSecure"
            checked={values.imapSecure}
            onChange={(e) => set("imapSecure")(e.target.checked)}
            className="rounded border-border/80"
          />
          <label
            htmlFor="imapSecure"
            className="cursor-pointer text-xs text-muted-foreground"
          >
            Use SSL/TLS for IMAP (port 993, recommended).
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="h-8 gap-1.5 text-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Verifying & Saving...</span>
            </>
          ) : (
            <>
              <Check className="size-3.5" />
              <span>Test & Save Mailbox</span>
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
