import { Badge } from "@/components/ui/badge"
import { formatMoneyAmount, formatTargetMarket } from "@/lib/geo/countries"

/** Research-run fields that describe where the user sells and their own size. */
export interface MarketContextFields {
  targetCountryCode?: string | null
  targetRegion?: string | null
  ownArrAmount?: number | null
  ownArrCurrency?: string | null
  ownTamAmount?: number | null
  ownTamCurrency?: string | null
}

function Fact({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
      <Badge variant="neutral" className="h-4 px-1.5 font-normal">
        {source}
      </Badge>
    </span>
  )
}

/**
 * Target market plus the user's own ARR/TAM. User figures are labelled as theirs;
 * when TAM is missing we say so rather than showing a model guess in its place.
 */
export function MarketContextSummary({ run }: { run: MarketContextFields }) {
  const market = formatTargetMarket(run.targetCountryCode, run.targetRegion)
  const tam = formatMoneyAmount(run.ownTamAmount, run.ownTamCurrency)
  const arr = formatMoneyAmount(run.ownArrAmount, run.ownArrCurrency)
  if (!market && !tam && !arr) return null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {market && (
        <span>
          <span className="text-muted-foreground">Target market: </span>
          <span className="font-medium text-foreground">{market}</span>
        </span>
      )}
      {tam ? (
        <Fact label="Your TAM" value={tam} source="Provided by you" />
      ) : (
        <span className="text-muted-foreground">
          TAM not provided. Segment sizes below are AI estimates (unverified).
        </span>
      )}
      {arr && <Fact label="Your ARR" value={arr} source="Provided by you" />}
    </div>
  )
}

/** A model-generated segment size, never presented as measured data. */
export function AiSizeEstimate({ label }: { label?: string | null }) {
  if (!label) return null
  return (
    <span className="text-xs text-muted-foreground italic">
      Est. size: {label} · AI estimate (unverified)
    </span>
  )
}
