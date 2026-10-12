import "dotenv/config";
import { db } from "../src/utils/db";
import { gtmSuppressionEntry } from "../src/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  console.log("=== Platform-Wide Suppression Table Inspection ===");
  const entries = await db
    .select()
    .from(gtmSuppressionEntry)
    .orderBy(desc(gtmSuppressionEntry.createdAt))
    .limit(100);

  console.log(`Total entries found (displaying up to 100): ${entries.length}\n`);

  for (const entry of entries) {
    console.log(
      `[${entry.id}] Email: ${entry.email || "(null: domain-level)"} | Domain: ${entry.domain} | Reason: ${entry.reason}`
    );
    console.log(
      `   Real Send Bounce: ${entry.isRealSendBounce} | Status Code: ${entry.statusCode || "N/A"} | Org: ${entry.sourceOrgId || "N/A"}`
    );
    if (entry.rawSnippet) {
      console.log(`   Snippet: ${entry.rawSnippet.slice(0, 120)}...`);
    }
    console.log(`   Created: ${entry.createdAt.toISOString()}`);
    console.log("------------------------------------------------------------------");
  }
}

main()
  .catch((err) => {
    console.error("Error inspecting suppression entries:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
