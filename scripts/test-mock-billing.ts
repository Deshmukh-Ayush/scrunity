/**
 * Verifies the simulated-checkout gate in POST /api/billing/checkout. With no
 * Dodo price IDs configured, a checkout must either be refused and grant
 * nothing (production, or development without the flag), or be simulated
 * (development with ALLOW_MOCK_BILLING=true). Uses only plans/actions that
 * have no price ID, so the route never calls Dodo.
 *
 *   # refused: production build (flag set or not), or `npm run dev` without the flag
 *   EXPECT=refused npx tsx scripts/test-mock-billing.ts
 *   # allowed: ALLOW_MOCK_BILLING=true npm run dev
 *   EXPECT=allowed npx tsx scripts/test-mock-billing.ts
 *
 * Creates a throwaway user and org and deletes them at the end.
 */
import "dotenv/config"
import crypto from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { db } from "../src/utils/db"
import { organization, user } from "../src/db/schema"
import { onboardingOrganizationId } from "../src/lib/onboarding-id"
import { check, createdUserIds, http, newUser, onboard, orgCredits } from "./support/pilot-test-helpers"

const expect = process.env.EXPECT
if (expect !== "refused" && expect !== "allowed") throw new Error("Set EXPECT=refused or EXPECT=allowed")

// Price IDs are inlined at build time; this test needs them absent for these actions.
for (const key of ["NEXT_PUBLIC_DODO_PILOT_PRICE_ID", "NEXT_PUBLIC_DODO_TOPUP_PRICE_ID", "NEXT_PUBLIC_DODO_EXTRA_SEAT_PRICE_ID"]) {
  if (process.env[key]) throw new Error(`${key} is set; this test needs it unset so no Dodo call can happen`)
}

const tag = crypto.randomBytes(4).toString("hex")

async function state(orgId: string) {
  const [org] = await db.select({ extraSeats: organization.extraSeats }).from(organization).where(eq(organization.id, orgId))
  const credits = await orgCredits(orgId)
  return { plan: credits.plan, credits: credits.creditsRemaining, ledgerRows: credits.ledger.length, extraSeats: org?.extraSeats }
}

async function main() {
  const u = await newUser(`mock-billing-${tag}@scrunity-test.invalid`)
  const onboarded = await onboard(u.cookie, `Mock Billing ${tag}`)
  if (!onboarded.ok) throw new Error(`onboarding failed: ${onboarded.status}`)
  const orgId = onboardingOrganizationId(u.userId)
  const before = await state(orgId)
  console.log(`Expecting: ${expect}. Before:`, before)

  const actions = [
    { action: "subscribe", plan: "pilot" },
    { action: "topup", quantity: 1 },
    { action: "extra_seat", quantity: 1 },
  ]
  for (const body of actions) {
    const res = await http("/api/billing/checkout", { method: "POST", cookie: u.cookie, body })
    const data = await res.json()
    if (expect === "refused") {
      check(`${body.action}: refused with the payments-not-enabled message`,
        res.status === 503 && /Online payments aren't enabled yet; contact \S+@\S+/.test(data.error ?? ""),
        `${res.status} ${data.error ?? JSON.stringify(data)}`)
    } else {
      check(`${body.action}: simulated in development`, res.status === 200 && data.devSimulated === true, `${res.status} ${JSON.stringify(data)}`)
    }
  }

  const after = await state(orgId)
  console.log("After:", after)
  if (expect === "refused") {
    check("no plan granted", after.plan === "free", after.plan)
    check("no credits granted", after.credits === 0, `${after.credits}`)
    check("no seats granted", after.extraSeats === 0, `${after.extraSeats}`)
    check("no ledger rows written", after.ledgerRows === before.ledgerRows, `${before.ledgerRows} -> ${after.ledgerRows}`)
  } else {
    check("plan simulated (pilot)", after.plan === "pilot", after.plan)
    check("credits = 300 pilot + 100 top-up", after.credits === 400, `${after.credits}`)
    check("one extra seat", after.extraSeats === 1, `${after.extraSeats}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.delete(organization).where(inArray(organization.id, createdUserIds.map(onboardingOrganizationId)))
    await db.delete(user).where(inArray(user.id, createdUserIds))
    console.log(`Cleanup: removed ${createdUserIds.length} user(s) and their org`)
    process.exit()
  })
