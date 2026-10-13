import { z } from "zod"
import { CURRENCIES, isCountryCode } from "@/lib/geo/countries"

/** The user's own ARR or TAM: a whole amount plus its currency. */
const moneyAmountSchema = z.object({
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency: z.enum(CURRENCIES),
})

/** Target market and own-metrics fields accepted when a research run is created. */
export const targetMarketInputSchema = z.object({
  targetCountryCode: z
    .string()
    .trim()
    .length(2, "Target country is required")
    .transform((code) => code.toUpperCase())
    .refine(isCountryCode, "Unknown country code"),
  targetRegion: z
    .string()
    .trim()
    .max(100, "Region must be under 100 characters")
    .optional()
    .nullable()
    .transform((region) => region || null),
  ownArr: moneyAmountSchema.optional().nullable(),
  ownTam: moneyAmountSchema.optional().nullable(),
})

export type TargetMarketInput = z.infer<typeof targetMarketInputSchema>
