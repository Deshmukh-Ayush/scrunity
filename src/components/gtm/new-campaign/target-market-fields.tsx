"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  COUNTRIES,
  CURRENCIES,
  REGION_SUGGESTIONS,
  countryCodeFromName,
  type Currency,
} from "@/lib/geo/countries"
import type { CompanyFormValues } from "./types"

const selectClassName =
  "h-9 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"

function MoneyField({
  id,
  label,
  hint,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
}: {
  id: string
  label: string
  hint: string
  amount: string
  currency: Currency
  onAmountChange: (value: string) => void
  onCurrencyChange: (value: Currency) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <select
          aria-label={`${label} currency`}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as Currency)}
          className={selectClassName}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Input
          id={id}
          inputMode="numeric"
          placeholder="e.g. 2500000"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value.replace(/[^\d]/g, ""))}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Target country/region and the user's own ARR/TAM for the new-campaign form. */
export function TargetMarketFields({
  values,
  onChange,
}: {
  values: CompanyFormValues
  onChange: (patch: Partial<CompanyFormValues>) => void
}) {
  const countryCode = countryCodeFromName(values.targetCountry)
  const regionSuggestions = (countryCode && REGION_SUGGESTIONS[countryCode]) || []
  const countryInvalid = values.targetCountry.trim() !== "" && !countryCode

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="targetCountry">Target Country *</Label>
          <Input
            id="targetCountry"
            list="target-country-options"
            placeholder="Start typing, e.g. India"
            autoComplete="off"
            value={values.targetCountry}
            aria-invalid={countryInvalid || undefined}
            onChange={(e) => onChange({ targetCountry: e.target.value, targetRegion: "" })}
            required
          />
          <datalist id="target-country-options">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name} />
            ))}
          </datalist>
          {countryInvalid && (
            <p className="text-xs text-destructive">Pick a country from the list.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetRegion">Target Region / State</Label>
          <Input
            id="targetRegion"
            list="target-region-options"
            placeholder="Optional, e.g. Delhi"
            autoComplete="off"
            maxLength={100}
            value={values.targetRegion}
            onChange={(e) => onChange({ targetRegion: e.target.value })}
          />
          <datalist id="target-region-options">
            {regionSuggestions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">Leave blank to target the whole country.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="ownArr"
          label="Your ARR"
          hint="Optional. Your own company's annual recurring revenue."
          amount={values.arrAmount}
          currency={values.arrCurrency}
          onAmountChange={(arrAmount) => onChange({ arrAmount })}
          onCurrencyChange={(arrCurrency) => onChange({ arrCurrency })}
        />
        <MoneyField
          id="ownTam"
          label="Your TAM"
          hint="Optional. Your own total addressable market estimate."
          amount={values.tamAmount}
          currency={values.tamCurrency}
          onAmountChange={(tamAmount) => onChange({ tamAmount })}
          onCurrencyChange={(tamCurrency) => onChange({ tamCurrency })}
        />
      </div>
    </>
  )
}
