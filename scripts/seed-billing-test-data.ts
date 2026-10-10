import { db } from "@/utils/db";
import { organization, gtmAiCreditPeriod, gtmAiCreditTransaction } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

async function main() {
  const orgId = "86snq4dK6csMTuqNM4ly6EdZxRLiOVaW";

  // 1. Update organization to Growth plan with active subscription
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000); // 24 days left

  await db
    .update(organization)
    .set({
      name: "Acme Global Enterprise Technologies Inc.",
      plan: "growth",
      subscriptionStatus: "active",
      currentPeriodEnd: periodEnd,
      extraSeats: 1,
    })
    .where(eq(organization.id, orgId));

  console.log("Updated organization to Growth plan with long name");

  // 2. Ensure an active credit period for Growth plan
  let [period] = await db
    .select()
    .from(gtmAiCreditPeriod)
    .where(eq(gtmAiCreditPeriod.organizationId, orgId));

  if (!period) {
    const periodId = nanoid();
    [period] = await db
      .insert(gtmAiCreditPeriod)
      .values({
        id: periodId,
        organizationId: orgId,
        periodStart: now,
        periodEnd: periodEnd,
        plan: "growth",
        planAllotment: 1800,
        creditsUsed: 420,
        creditsRemaining: 1380,
      })
      .returning();
  } else {
    [period] = await db
      .update(gtmAiCreditPeriod)
      .set({
        periodStart: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        periodEnd: periodEnd,
        plan: "growth",
        planAllotment: 1800,
        creditsUsed: 420,
        creditsRemaining: 1380,
      })
      .where(eq(gtmAiCreditPeriod.id, period.id))
      .returning();
  }

  console.log("Updated credit period:", period);

  // 3. Clear existing test transactions and add diverse transactions
  await db
    .delete(gtmAiCreditTransaction)
    .where(eq(gtmAiCreditTransaction.organizationId, orgId));

  const sampleTxs = [
    {
      type: "debit",
      amount: 1,
      description: "Sent personalized outreach to VP of Growth & Demand Generation at Enterprise Infrastructure Solutions Corp",
      daysAgo: 0,
    },
    {
      type: "debit",
      amount: 25,
      description: "Batch prospect campaign delivery for Q4 FinTech Decision Makers Segment",
      daysAgo: 1,
    },
    {
      type: "topup",
      amount: 200,
      description: "Instant top-up: 2x 100 AI credits pack ($24 one-time payment)",
      daysAgo: 2,
    },
    {
      type: "debit",
      amount: 40,
      description: "Outreach emails dispatched to Seed Stage Founders across North America and Europe",
      daysAgo: 3,
    },
    {
      type: "debit",
      amount: 55,
      description: "Automated sequence step 1 sent to verified technical executives",
      daysAgo: 4,
    },
    {
      type: "period_reset",
      amount: 1800,
      description: "Monthly subscription renewal: allocated 1,800 prospect credits under Growth plan",
      daysAgo: 6,
    },
  ];

  for (const st of sampleTxs) {
    const txDate = new Date(now.getTime() - st.daysAgo * 24 * 60 * 60 * 1000);
    await db.insert(gtmAiCreditTransaction).values({
      id: nanoid(),
      organizationId: orgId,
      periodId: period.id,
      type: st.type as "debit" | "topup" | "period_reset",
      amount: st.amount,
      description: st.description,
      createdAt: txDate,
    });
  }

  console.log("Inserted test transactions with varied descriptions and dates");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
