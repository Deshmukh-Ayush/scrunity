"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LocalDate } from "@/components/ui/local-date"
import type { AdminManualGrant, AdminOrganization } from "@/lib/data/admin"
import { PLAN_OPTIONS, adminRequest, selectClassName } from "./admin-shared"

function GrantCreditsForm({ organization }: { organization: AdminOrganization }) {
  const router = useRouter()
  const [amount, setAmount] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  // One id per filled-in form, so a double click grants once.
  const [requestId, setRequestId] = React.useState(() => crypto.randomUUID())

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await adminRequest(`/api/admin/organizations/${organization.id}/credits`, "POST", {
        amount: Number(amount),
        reason,
        requestId,
      })
      toast.success(`Granted ${amount} credits to ${organization.name}`)
      setAmount("")
      setReason("")
      setRequestId(crypto.randomUUID())
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grant credits")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Credits to add"
        type="number"
        min={1}
        className="h-8 w-24"
        placeholder="Credits"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <Input
        aria-label="Reason"
        className="min-w-[200px] flex-1"
        placeholder="Reason, e.g. paid ₹X directly, invoice 123"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        minLength={3}
      />
      <Button type="submit" size="sm" variant="outline" disabled={isSaving}>
        Add credits
      </Button>
    </form>
  )
}

function SetPlanForm({ organization }: { organization: AdminOrganization }) {
  const router = useRouter()
  const [plan, setPlan] = React.useState<string>(
    (PLAN_OPTIONS as readonly string[]).includes(organization.plan) ? organization.plan : "pilot"
  )
  const [isSaving, setIsSaving] = React.useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (
      !confirm(
        `Set ${organization.name} to the ${plan} plan? This resets their credit balance to the plan allotment (no rollover), exactly like a Dodo subscription activation.`
      )
    ) {
      return
    }
    setIsSaving(true)
    try {
      await adminRequest(`/api/admin/organizations/${organization.id}/plan`, "POST", { plan })
      toast.success(`${organization.name} is now on ${plan}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set plan")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <select
        aria-label="Plan"
        className={`${selectClassName} h-8`}
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
      >
        {PLAN_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={isSaving}>
        Set plan
      </Button>
    </form>
  )
}

/** Organizations with plan and balance, manual grant and set-plan actions, recent grants. */
export function AdminOrganizationsClient({
  organizations,
  grants,
}: {
  organizations: AdminOrganization[]
  grants: AdminManualGrant[]
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Organizations</h2>
          <p className="text-xs text-muted-foreground">
            Current plan and credit balance. Credits are added as a manual grant on top of the current balance.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg shadow-surface">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Organization</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {organizations.map((org) => (
                <tr key={org.id} className="align-top">
                  <td className="px-3 py-2">
                    <span className="font-medium">{org.name}</span>
                    <span className="block text-muted-foreground">{org.ownerEmail ?? "no owner"}</span>
                    <span className="block text-muted-foreground">{org.id}</span>
                  </td>
                  <td className="px-3 py-2">
                    {org.plan}
                    {org.subscriptionStatus && (
                      <span className="block text-muted-foreground">{org.subscriptionStatus}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{org.creditsRemaining}</td>
                  <td className="space-y-2 px-3 py-2">
                    <GrantCreditsForm organization={org} />
                    <SetPlanForm organization={org} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Recent manual grants</h2>
        <div className="overflow-x-auto rounded-lg shadow-surface">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Organization</th>
                <th className="px-3 py-2 font-medium">Credits</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {grants.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    No manual grants yet.
                  </td>
                </tr>
              )}
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    <LocalDate
                      value={grant.createdAt}
                      locale="en-US"
                      options={{ month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }}
                    />
                  </td>
                  <td className="px-3 py-2">{grant.organizationName}</td>
                  <td className="px-3 py-2 font-medium">+{grant.amount}</td>
                  <td className="max-w-[360px] px-3 py-2 break-words text-muted-foreground">{grant.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
