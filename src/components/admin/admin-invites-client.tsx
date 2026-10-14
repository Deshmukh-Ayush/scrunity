"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LocalDate } from "@/components/ui/local-date"
import type { AdminPilotInvite } from "@/lib/data/admin"
import { PLAN_OPTIONS, adminRequest, selectClassName } from "./admin-shared"

interface UpsertResponse {
  results: { email: string; outcome: "created" | "updated" | "unchanged_claimed" }[]
  invalid: string[]
}

function InviteForm() {
  const router = useRouter()
  const [emails, setEmails] = React.useState("")
  const [plan, setPlan] = React.useState<string>("pilot")
  const [credits, setCredits] = React.useState("0")
  const [note, setNote] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const data = await adminRequest<UpsertResponse>("/api/admin/invites", "POST", {
        emails,
        plan,
        credits: Number(credits) || 0,
        note,
      })
      const count = (outcome: string) => data.results.filter((r) => r.outcome === outcome).length
      toast.success(
        `${count("created")} added, ${count("updated")} updated, ${count("unchanged_claimed")} already claimed` +
          (data.invalid.length ? `. Skipped invalid: ${data.invalid.join(", ")}` : "")
      )
      setEmails("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save invites")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="invite-emails">Emails (one or several, separated by commas or new lines)</Label>
        <Textarea
          id="invite-emails"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="customer@example.com"
          rows={3}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-plan">Plan</Label>
        <select id="invite-plan" className={selectClassName} value={plan} onChange={(e) => setPlan(e.target.value)}>
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-credits">Extra credits on top of the plan allotment</Label>
        <Input
          id="invite-credits"
          type="number"
          min={0}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="invite-note">Note (optional)</Label>
        <Input id="invite-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paid ₹X directly" />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" variant="outline" disabled={isSaving}>
          {isSaving ? "Saving…" : "Add invites"}
        </Button>
      </div>
    </form>
  )
}

function RevokeButton({ inviteId }: { inviteId: string }) {
  const router = useRouter()
  const [isRevoking, setIsRevoking] = React.useState(false)
  const revoke = async () => {
    if (!confirm("Revoke this invite? The customer will no longer get pilot access when they onboard.")) return
    setIsRevoking(true)
    try {
      await adminRequest(`/api/admin/invites/${inviteId}`, "DELETE")
      toast.success("Invite revoked")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke invite")
    } finally {
      setIsRevoking(false)
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={revoke} disabled={isRevoking}>
      Revoke
    </Button>
  )
}

/** Pilot invite form and list for the platform admin page. */
export function AdminInvitesClient({ invites }: { invites: AdminPilotInvite[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Pilot invites</h2>
        <p className="text-xs text-muted-foreground">
          When an invited email finishes onboarding, its organization gets the plan (credits reset to the plan
          allotment) plus the extra credits, once.
        </p>
      </div>
      <InviteForm />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Extra credits</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Note</th>
              <th className="px-3 py-2 font-medium">Added</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {invites.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No invites yet.
                </td>
              </tr>
            )}
            {invites.map((invite) => (
              <tr key={invite.id}>
                <td className="px-3 py-2 font-medium">{invite.email}</td>
                <td className="px-3 py-2">{invite.plan}</td>
                <td className="px-3 py-2">{invite.credits}</td>
                <td className="px-3 py-2">
                  {invite.status}
                  {invite.claimedOrgId && <span className="block text-muted-foreground">{invite.claimedOrgId}</span>}
                </td>
                <td className="max-w-[220px] px-3 py-2 break-words text-muted-foreground">{invite.note}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  <LocalDate value={invite.createdAt} locale="en-US" options={{ month: "short", day: "numeric" }} />
                </td>
                <td className="px-3 py-2 text-right">
                  {invite.status === "invited" && <RevokeButton inviteId={invite.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
