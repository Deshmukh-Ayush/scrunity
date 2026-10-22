import { countryNameFromCode, formatMoneyAmount } from "@/lib/geo/countries"
import { COMPANY_SIZE_LABELS, websiteForDisplay } from "@/lib/company-profile/form"
import type { CompanyProfileInput } from "@/lib/company-profile/input"
import { COMPANY_PROFILE_COPY as COPY } from "@/lib/company-profile/copy"

type Row = { label: string; value: string }

/** The four facts the New research run card shows. */
export function summaryRows(values: CompanyProfileInput): Row[] {
  return [
    { label: COPY.summaryCompany, value: values.companyName },
    { label: COPY.summaryWebsite, value: websiteForDisplay(values.websiteUrl) },
    { label: COPY.summaryReach, value: countryNameFromCode(values.targetCountryCode) ?? values.targetCountryCode },
    { label: COPY.summaryRegion, value: values.targetRegion ?? COPY.wholeCountry },
  ]
}

/** Every saved field, for a member's read-only view in Settings. */
function allRows(values: CompanyProfileInput): Row[] {
  const [company, website, reach, region] = summaryRows(values)
  const rows: Array<Row | null> = [
    company,
    website,
    { label: "Company size", value: COMPANY_SIZE_LABELS[values.companySize] },
    { label: "Country", value: reach.value },
    { label: "Region or state", value: region.value },
    values.ownArr ? { label: "Your annual revenue (ARR)", value: formatMoneyAmount(values.ownArr.amount, values.ownArr.currency) ?? "" } : null,
    values.ownTam ? { label: "Your market size (TAM)", value: formatMoneyAmount(values.ownTam.amount, values.ownTam.currency) ?? "" } : null,
    { label: "What your company does", value: values.companyDescription },
    values.contextDoc ? { label: "Supporting document", value: values.contextDocFileName ?? "Attached" } : null,
  ]
  return rows.filter((row): row is Row => Boolean(row))
}

/**
 * Saved company details as a description list: the compact four on the New
 * research run card, or every field for members who can't edit Settings.
 */
export function ProfileDetails({ values, variant = "summary" }: { values: CompanyProfileInput; variant?: "summary" | "full" }) {
  const rows = variant === "summary" ? summaryRows(values) : allRows(values)
  return (
    <dl className={variant === "summary" ? "grid gap-x-6 gap-y-3 sm:grid-cols-2" : "flex flex-col gap-3"}>
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-meta text-fg-muted">{row.label}</dt>
          <dd className="text-body break-words whitespace-pre-line text-fg-strong">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
