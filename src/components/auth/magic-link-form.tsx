"use client"

import React, { useState } from "react"
import { Loader2 } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn } from "@/lib/auth-client"

/**
 * Email sign-in link. The confirmation is the same whether or not the email
 * has access, so the form never reveals who has an account.
 */
export function MagicLinkForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "limited" | "error">("idle")

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setState("sending")
    const { error } = await signIn.magicLink({
      email: email.trim().toLowerCase(),
      callbackURL: next ?? "/dashboard",
      newUserCallbackURL: next ?? "/onboarding",
      errorCallbackURL: "/sign-in",
    })
    if (!error) setState("sent")
    else setState(error.status === 429 ? "limited" : "error")
  }

  if (state === "sent") {
    return (
      <p role="status" className="rounded-md border border-border px-3 py-2 text-center text-xs text-muted-foreground">
        If this email has access to Scrunity, a sign-in link is on its way. It works once and expires in 5 minutes.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Input
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        aria-label="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-9 text-sm"
      />
      <Button type="submit" variant="outline" disabled={state === "sending"} className="text-sm">
        {state === "sending" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Email me a sign-in link
      </Button>
      {state === "limited" && (
        <p role="alert" className="text-center text-xs text-muted-foreground">
          Too many requests. Please wait a minute and try again.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="text-center text-xs text-muted-foreground">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  )
}
