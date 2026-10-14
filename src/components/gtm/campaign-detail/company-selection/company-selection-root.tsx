"use client"

import * as React from "react"
import { toast } from "sonner"
import { useCampaignDetail } from "../campaign-detail-root"
import type { Company, Contact } from "../types"

interface CompanySelectionContextValue {
  companies: Company[]
  /** Verified decision makers per company id (database-mode contacts only). */
  peopleByCompany: Map<string, Contact[]>
  /** True while the campaign waits at the gate; the table is read-only otherwise. */
  isEditable: boolean
  /** Decision-maker discovery has started, so its columns are shown. */
  showPeople: boolean
  selectedIds: Set<string>
  perCompany: number
  isConfirming: boolean
  toggle: (companyId: string) => void
  selectAll: () => void
  clear: () => void
  confirm: () => Promise<void>
}

const CompanySelectionContext =
  React.createContext<CompanySelectionContextValue | null>(null)

export function useCompanySelection() {
  const ctx = React.useContext(CompanySelectionContext)
  if (!ctx)
    throw new Error(
      "useCompanySelection must be used inside <CompanySelectionRoot>"
    )
  return ctx
}

const PAST_GATE_STAGES = new Set([
  "find_contacts",
  "write_emails",
  "awaiting_approval",
  "send_emails",
  "done_for_now",
  "done",
])

/**
 * Selection state for the company table. Every company starts selected (or as
 * stored, once confirmed); only the confirm call writes anything. Campaign data
 * itself still comes from CampaignDetailRoot's server render and polling.
 */
export function CompanySelectionRoot({
  children,
  ...props
}: React.ComponentProps<"section">) {
  const { data, refresh } = useCampaignDetail()
  const { campaign, companies, contacts } = data
  const isEditable = campaign.currentStage === "awaiting_company_selection"
  const showPeople = PAST_GATE_STAGES.has(campaign.currentStage)

  const [selectedIds, setSelectedIds] = React.useState(
    () =>
      new Set(
        companies
          .filter((c) => c.selectionStatus !== "excluded")
          .map((c) => c.id)
      )
  )
  const [isConfirming, setIsConfirming] = React.useState(false)

  const peopleByCompany = React.useMemo(() => {
    const map = new Map<string, Contact[]>()
    for (const contact of contacts) {
      if (!contact.prospectCompanyId || contact.emailStatus !== "verified")
        continue
      map.set(contact.prospectCompanyId, [
        ...(map.get(contact.prospectCompanyId) ?? []),
        contact,
      ])
    }
    return map
  }, [contacts])

  const toggle = (companyId: string) => {
    if (!isEditable) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  const confirm = async () => {
    if (selectedIds.size === 0 || isConfirming) return
    setIsConfirming(true)
    try {
      const res = await fetch(
        `/api/gtm/campaigns/${campaign.id}/confirm-selection`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyIds: [...selectedIds] }),
        }
      )
      const body = await res.json()
      if (!res.ok)
        throw new Error(body.error || "Could not confirm the selection")
      if (!body.alreadyConfirmed)
        toast.success(body.message || "Selection confirmed")
      await refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not confirm the selection"
      )
    } finally {
      setIsConfirming(false)
    }
  }

  const value: CompanySelectionContextValue = {
    companies,
    peopleByCompany,
    isEditable,
    showPeople,
    selectedIds: isEditable
      ? selectedIds
      : new Set(
          companies
            .filter((c) => c.selectionStatus !== "excluded")
            .map((c) => c.id)
        ),
    perCompany: data.decisionMakersPerCompany ?? 1,
    isConfirming,
    toggle,
    selectAll: () =>
      isEditable && setSelectedIds(new Set(companies.map((c) => c.id))),
    clear: () => isEditable && setSelectedIds(new Set()),
    confirm,
  }

  return (
    <CompanySelectionContext.Provider value={value}>
      <section data-editable={isEditable || undefined} {...props}>
        {children}
      </section>
    </CompanySelectionContext.Provider>
  )
}
