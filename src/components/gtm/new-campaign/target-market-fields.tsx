"use client"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  COUNTRIES,
  CURRENCIES,
  REGION_SUGGESTIONS,
  countryCodeFromName,
  type Currency,
} from "@/lib/geo/countries"
import { OptionalMark } from "./optional-mark"
import type { CompanyFormValues } from "./types"

const CURRENCY_ITEMS = CURRENCIES.map((c) => ({ value: c, label: c }))

/** An amount with its currency: a Select for the currency, digits only in the input. */
function MoneyField({
  id,
  label,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
}: {
  id: string
  label: string
  amount: string
  currency: Currency
  onAmountChange: (value: string) => void
  onCurrencyChange: (value: Currency) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} <OptionalMark />
      </FieldLabel>
      <div className="flex gap-2">
        <Select
          items={CURRENCY_ITEMS}
          value={currency}
          onValueChange={(value) => {
            if (value) onCurrencyChange(value as Currency)
          }}
        >
          <SelectTrigger aria-label={`${label} currency`} className="w-24 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          inputMode="numeric"
          placeholder="2500000"
          className="tabular-nums"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value.replace(/[^\d]/g, ""))}
        />
      </div>
    </Field>
  )
}

/**
 * Target country (typeahead over the country list) and region, then the
 * user's own ARR and TAM. The country must match the list; the error shows
 * as soon as typed text matches no country, and again on submit.
 */
export function TargetMarketFields({
  values,
  onChange,
  countryError,
}: {
  values: CompanyFormValues
  onChange: (patch: Partial<CompanyFormValues>) => void
  countryError?: string
}) {
  const countryCode = countryCodeFromName(values.targetCountry)
  const regionSuggestions = (countryCode && REGION_SUGGESTIONS[countryCode]) || []
  const typedNoMatch = values.targetCountry.trim() !== "" && !countryCode
  const error = countryError ?? (typedNoMatch ? "Choose a country from the list." : undefined)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={Boolean(error) || undefined}>
          <FieldLabel htmlFor="targetCountry">Country</FieldLabel>
          <Input
            id="targetCountry"
            list="target-country-options"
            placeholder="India"
            autoComplete="off"
            value={values.targetCountry}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "targetCountry-error" : undefined}
            onChange={(e) => onChange({ targetCountry: e.target.value, targetRegion: "" })}
          />
          <datalist id="target-country-options">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.name} />
            ))}
          </datalist>
          <FieldError id="targetCountry-error">{error}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="targetRegion">
            Region or state <OptionalMark />
          </FieldLabel>
          <Input
            id="targetRegion"
            list="target-region-options"
            placeholder={regionSuggestions[0] ?? "Maharashtra"}
            autoComplete="off"
            maxLength={100}
            value={values.targetRegion}
            aria-describedby="targetRegion-help"
            onChange={(e) => onChange({ targetRegion: e.target.value })}
          />
          <datalist id="target-region-options">
            {regionSuggestions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
          <FieldDescription id="targetRegion-help">Leave empty to cover the whole country.</FieldDescription>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="ownArr"
          label="Your annual revenue (ARR)"
          amount={values.arrAmount}
          currency={values.arrCurrency}
          onAmountChange={(arrAmount) => onChange({ arrAmount })}
          onCurrencyChange={(arrCurrency) => onChange({ arrCurrency })}
        />
        <MoneyField
          id="ownTam"
          label="Your market size (TAM)"
          amount={values.tamAmount}
          currency={values.tamCurrency}
          onAmountChange={(tamAmount) => onChange({ tamAmount })}
          onCurrencyChange={(tamCurrency) => onChange({ tamCurrency })}
        />
      </div>
    </>
  )
}
