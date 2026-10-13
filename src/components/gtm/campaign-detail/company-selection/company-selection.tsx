"use client"

import { useCampaignDetail } from "../campaign-detail-root"
import { CompanySelectionRoot } from "./company-selection-root"
import {
  CompanySelectionFooter,
  CompanySelectionGrid,
  CompanySelectionToolbar,
} from "./company-selection-table"

/**
 * The company table for company-database campaigns (nothing for legacy ones).
 * Keyed on the company ids, so a re-run that replaces the companies starts a
 * fresh all-selected state instead of carrying stale ticks over.
 */
export function CompanySelection() {
  const { data } = useCampaignDetail()
  if (!data.usesCompanyDatabase) return null

  return (
    <CompanySelectionRoot
      key={data.companies.map((c) => c.id).join(",")}
      aria-label="Companies"
      className="space-y-3"
    >
      <CompanySelectionToolbar />
      <CompanySelectionGrid />
      <CompanySelectionFooter />
    </CompanySelectionRoot>
  )
}
