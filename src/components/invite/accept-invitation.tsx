"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

/** Accepts a team invitation for the signed-in user, or asks them to sign in first. */
export function AcceptInvitation({ inviteId, signedInEmail }: { inviteId: string; signedInEmail: string | null }) {
  const router = useRouter()
  const [state, setState] = React.useState<"idle" | "accepting" | "error">("idle")
  const [message, setMessage] = React.useState<string | null>(null)

  if (!signedInEmail) {
    const next = encodeURIComponent(`/invite/org/${inviteId}`)
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Sign in with the email address this invitation was sent to.</p>
        <Link href={`/sign-in?next=${next}`} className={buttonVariants({ variant: "outline" })}>
          Sign in to accept
        </Link>
      </div>
    )
  }

  const accept = async () => {
    setState("accepting")
    const res = await fetch("/api/organizations/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setState("error")
      setMessage(data.error || "Could not accept the invitation.")
      return
    }
    await authClient.organization.setActive({ organizationId: data.organizationId })
    router.push("/dashboard")
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Signed in as {signedInEmail}.</p>
      <Button variant="outline" onClick={accept} disabled={state === "accepting"}>
        {state === "accepting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Accept invitation
      </Button>
      {message && (
        <p role="alert" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  )
}
