import { auth } from "@/lib/auth";
import { db } from "@/utils/db";
import { member } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";

type SessionType = Awaited<ReturnType<typeof auth.api.getSession>>;
type UserType = NonNullable<SessionType>["user"];

export interface TenantContextResult {
  session: SessionType | null;
  user: UserType | null;
  organizationId: string;
  memberRole?: "owner" | "agency" | "client" | string;
  error?: string;
  status?: number;
}

/**
 * Deep module that resolves session, active organization, and member role in one unified call.
 * Wrapped in React.cache() for per-request deduplication across layouts and server components.
 *
 * Fast path: when the proxy (src/proxy.ts) has already resolved the session, active org,
 * and membership role, it injects x-user-id / x-org-id / x-org-role request headers. This
 * avoids a second auth.api.getSession() call and a duplicate member query in the render phase.
 * Fallback: full resolution for routes not covered by the proxy matcher.
 */
export const getTenantContext = cache(async function getTenantContext(
  reqHeaders?: Headers
): Promise<TenantContextResult> {
  const reqH = reqHeaders || (await headers());

  // Fast path: proxy already resolved identity into request headers
  const proxyUserId = reqH.get("x-user-id");
  const proxyOrgId = reqH.get("x-org-id");
  const proxyOrgRole = reqH.get("x-org-role");

  if (proxyUserId && proxyOrgId) {
    return {
      session: null,
      user: {
        id: proxyUserId,
        name: reqH.get("x-user-name") || "",
        email: reqH.get("x-user-email") || "",
        image: reqH.get("x-user-image") || null,
      } as UserType,
      organizationId: proxyOrgId,
      memberRole: proxyOrgRole || undefined,
    };
  }

  // Fallback: full resolution (routes outside the proxy matcher)
  const session = await auth.api.getSession({ headers: reqH });

  if (!session || !session.user) {
    return { session: null, user: null, organizationId: "", error: "Unauthorized", status: 401 };
  }

  let organizationId = session.session?.activeOrganizationId;

  // Fallback: list user's organizations if activeOrganizationId is not set on session
  if (!organizationId) {
    const orgs = await auth.api.listOrganizations({ headers: reqH });
    if (orgs && orgs.length > 0) {
      organizationId = orgs[0].id;
    }
  }

  if (!organizationId) {
    return {
      session,
      user: session.user,
      organizationId: "",
      error: "No active organization found",
      status: 400,
    };
  }

  // Look up user's membership role in the organization
  const [orgMember] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)));

  // The session can name an org the user was removed from: no membership, no org.
  if (!orgMember) {
    return {
      session,
      user: session.user,
      organizationId: "",
      error: "Not a member of this organization",
      status: 403,
    };
  }

  return {
    session,
    user: session.user,
    organizationId,
    memberRole: orgMember?.role,
  };
});
