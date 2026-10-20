"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Eye, EyeOff } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import { DATA_SOURCE_COPY as COPY } from "@/lib/data-sources/copy"
import { KeyDisclosure } from "./key-disclosure"

interface ConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Sends the key; resolves when the request is done. */
  onSubmit: (apiKey: string) => Promise<void> | void
  submitting: boolean
  /** Plain error text from the last attempt (missing key, rejected key, ...). */
  error: string | null
  reconnect?: boolean
}

/**
 * Paste-an-API-key dialog. The field is a password field (show/hide toggle),
 * opted out of autofill and password managers, and accepts paste. The key
 * lives only in the form inside the dialog, which unmounts when the dialog
 * closes, so it is forgotten then; it is never logged.
 */
export function ConnectDialog({ open, onOpenChange, submitting, ...form }: ConnectDialogProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const title = form.reconnect ? COPY.reconnectAction : COPY.dialogTitle

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" initialFocus={inputRef}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{COPY.dialogDescription}</DialogDescription>
        </DialogHeader>
        <KeyForm inputRef={inputRef} submitting={submitting} title={title} onCancel={() => onOpenChange(false)} {...form} />
      </DialogContent>
    </Dialog>
  )
}

function KeyForm({
  inputRef,
  submitting,
  title,
  onCancel,
  onSubmit,
  error,
}: Pick<ConnectDialogProps, "onSubmit" | "submitting" | "error"> & {
  inputRef: React.RefObject<HTMLInputElement | null>
  title: string
  onCancel: () => void
}) {
  const [apiKey, setApiKey] = React.useState("")
  const [visible, setVisible] = React.useState(false)

  // A failed attempt puts focus back in the field, next to its error.
  React.useEffect(() => {
    if (error) inputRef.current?.focus()
  }, [error, inputRef])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void onSubmit(apiKey)
  }

  return (
    <>
      <form id="connect-apollo-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field data-invalid={Boolean(error) || undefined}>
          <FieldLabel htmlFor="apollo-api-key">{COPY.keyLabel}</FieldLabel>
          <div className="relative">
            <Input
              ref={inputRef}
              id="apollo-api-key"
              name="apollo-api-key"
              type={visible ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              // Keep password managers from offering to save or fill this key.
              data-1p-ignore=""
              data-lpignore="true"
              data-bwignore=""
              className="pe-9"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "apollo-api-key-error apollo-api-key-hint" : "apollo-api-key-hint"}
              readOnly={submitting}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute inset-y-0 end-0.5 my-auto"
              onClick={() => setVisible((v) => !v)}
              aria-pressed={visible}
              // One name with aria-pressed (on = the key is shown), so the state is announced once.
              aria-label={COPY.showKey}
              aria-controls="apollo-api-key"
            >
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <FieldDescription id="apollo-api-key-hint">{COPY.keyHint}</FieldDescription>
          <FieldError id="apollo-api-key-error">{error}</FieldError>
        </Field>
      </form>

      <KeyDisclosure headingLevel="h3" className="rounded-lg bg-muted p-3 [&_ul]:ps-6" />

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          {COPY.cancelAction}
        </Button>
        <Button type="submit" form="connect-apollo-form" variant="brand" loading={submitting}>
          {title}
        </Button>
      </DialogFooter>
    </>
  )
}
