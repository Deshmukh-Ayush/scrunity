"use client"

import { useState } from "react"
import { CreditCard } from "@/components/ui/icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** Opens the Dodo Payments customer portal in the current tab. */
export function ManagePortalButton() {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    try {
      setLoading(true)
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json()
      if (!res.ok)
        throw new Error(data.error || "Failed to load customer portal")
      if (data.url) window.location.href = data.url
    } catch (err: any) {
      toast.error(err.message || "Failed to open billing portal")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={openPortal}
      disabled={loading}
      className="gap-1.5"
    >
      <CreditCard className="h-3.5 w-3.5" />
      {loading ? "Loading..." : "Manage in Dodo Portal"}
    </Button>
  )
}
