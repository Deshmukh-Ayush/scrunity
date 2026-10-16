import type {
  BatchLookupOutcome,
  EmailLookupInput,
} from "@/lib/providers/types"
import { runAlexandria, type FirecrawlClientDeps } from "./client"
import { withReservedCredits, type CreditLedger } from "./credits"
import { FirecrawlDataError } from "./errors"
import {
  parseWorkEmailData,
  WORK_EMAIL_BATCH_SIZE,
  WORK_EMAIL_CAPABILITY,
  WORK_EMAIL_CREDITS_PER_RECORD,
  workEmailCall,
} from "./work-email"

/**
 * One batch of work-email lookups (1-10 people, one request). Credits are
 * reserved for the whole batch (20 per person) before the request and settled
 * with the creditsCost Firecrawl returns. Each person gets a result or the
 * error of their own call.
 */
export async function lookupWorkEmailBatch(
  inputs: EmailLookupInput[],
  { ledger, deps }: { ledger: CreditLedger; deps: FirecrawlClientDeps }
): Promise<BatchLookupOutcome[]> {
  if (inputs.length === 0) return []
  if (inputs.length > WORK_EMAIL_BATCH_SIZE)
    throw new Error(`At most ${WORK_EMAIL_BATCH_SIZE} people per batch.`)
  const estimate = inputs.length * WORK_EMAIL_CREDITS_PER_RECORD
  return withReservedCredits(
    ledger,
    estimate,
    WORK_EMAIL_CAPABILITY,
    async () => {
      const results = await runAlexandria(inputs.map(workEmailCall), deps)
      let creditsCost = 0
      const outcomes = results.map((result, i): BatchLookupOutcome => {
        if (!result.ok) {
          // A failed call whose charge is unknown keeps its reservation.
          if (result.error.charged === "unknown")
            creditsCost += WORK_EMAIL_CREDITS_PER_RECORD
          return { result: null, error: result.error }
        }
        creditsCost += result.creditsCost
        try {
          return {
            result: parseWorkEmailData(
              result.data,
              inputs[i],
              result.creditsCost
            ),
            error: null,
          }
        } catch (err) {
          const error =
            err instanceof FirecrawlDataError
              ? err
              : new FirecrawlDataError(
                  "provider_request_failed",
                  "unreadable result"
                )
          return { result: null, error }
        }
      })
      return { value: outcomes, creditsCost }
    }
  )
}
