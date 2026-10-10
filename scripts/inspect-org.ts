import { db } from "@/utils/db";
import { organization, gtmAiCreditPeriod, gtmAiCreditTransaction } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const orgId = "86snq4dK6csMTuqNM4ly6EdZxRLiOVaW";
  const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
  console.log("Org:", org);

  const periods = await db.select().from(gtmAiCreditPeriod).where(eq(gtmAiCreditPeriod.organizationId, orgId));
  console.log("Periods for org:", periods);

  const txs = await db.select().from(gtmAiCreditTransaction).where(eq(gtmAiCreditTransaction.organizationId, orgId));
  console.log("Txs for org:", txs);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
