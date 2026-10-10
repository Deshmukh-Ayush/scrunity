import { db } from "@/utils/db";
import { member } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const members = await db.select().from(member).where(eq(member.organizationId, "86snq4dK6csMTuqNM4ly6EdZxRLiOVaW"));
  console.log("Members for test org:", members);
  process.exit(0);
}
main();
