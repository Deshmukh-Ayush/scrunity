import { cache } from "react";
import { db } from "@/utils/db";
import { member, user, organization } from "@/db/schema";
import { eq } from "drizzle-orm";

export const getCachedOrg = cache(async (organizationId: string) => {
  if (!organizationId) return null;
  const [org] = await db.select().from(organization).where(eq(organization.id, organizationId));
  return org;
});

export const getCachedOrgMembers = cache(async (organizationId: string) => {
  if (!organizationId) return [];
  return db
    .select({
      id: member.id,
      role: member.role,
      user: { id: user.id, name: user.name, email: user.email, image: user.image },
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));
});
