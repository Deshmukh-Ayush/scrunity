import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/utils/db";
import { member, organization } from "@/db/schema";
import { eq } from "drizzle-orm";

// /onboarding is kept public for UI development and testing
const protectedPaths = ["/dashboard", "/api/billing", "/api/gtm"];

export async function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const isSignIn = pathname === "/sign-in";
    const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

    if (!isSignIn && !isProtected) {
      return NextResponse.next();
    }

    const testOrgParam = request.nextUrl.searchParams.get("test_org") || request.cookies.get("test_org")?.value;
    const isLocalhost = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session && isLocalhost && testOrgParam && isProtected) {
      const [testOrg] = await db
        .select()
        .from(organization)
        .where(eq(organization.id, testOrgParam));

      if (testOrg) {
        const [testMember] = await db
          .select()
          .from(member)
          .where(eq(member.organizationId, testOrgParam))
          .limit(1);

        const requestHeaders = new Headers(request.headers);
        requestHeaders.delete("x-user-id");
        requestHeaders.delete("x-user-name");
        requestHeaders.delete("x-user-email");
        requestHeaders.delete("x-user-image");
        requestHeaders.delete("x-org-id");
        requestHeaders.delete("x-org-role");

        requestHeaders.set("x-user-id", testMember?.userId || "test-user-id");
        requestHeaders.set("x-user-name", "Test User");
        requestHeaders.set("x-user-email", "test@scrunity.com");
        requestHeaders.set("x-org-id", testOrg.id);
        requestHeaders.set("x-org-role", testMember?.role || "owner");

        const response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        response.cookies.set("test_org", testOrg.id, { path: "/", httpOnly: false });
        return response;
      }
    }

    if (!session) {
      if (isProtected) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
      return NextResponse.next();
    }

    if (isSignIn) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // --- Pass resolved identity to render via request headers ---
    // IMPORTANT: strip any client-supplied versions of these headers FIRST,
    // before setting our own resolved values — preventing header-spoofing attacks.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("x-user-id");
    requestHeaders.delete("x-user-name");
    requestHeaders.delete("x-user-email");
    requestHeaders.delete("x-user-image");
    requestHeaders.delete("x-org-id");
    requestHeaders.delete("x-org-role");

    requestHeaders.set("x-user-id", session.user.id);
    requestHeaders.set("x-user-name", session.user.name || "");
    requestHeaders.set("x-user-email", session.user.email || "");
    requestHeaders.set("x-user-image", session.user.image || "");

    // Set org id from the session's active organization
    const activeOrgId = session.session?.activeOrganizationId || "";
    if (activeOrgId) {
      requestHeaders.set("x-org-id", activeOrgId);
    }

    // Guard dashboard route: ensure user has an organization or redirect to onboarding
    if (pathname.startsWith("/dashboard")) {
      const userId = session.user.id;
      const orgMemberships = await db
        .select({ role: member.role, organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, userId));

      if (orgMemberships.length === 0 && pathname !== "/onboarding") {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }

      const activeMembership = activeOrgId
        ? orgMemberships.find((m) => m.organizationId === activeOrgId)
        : orgMemberships[0];

      if (activeMembership) {
        if (!activeOrgId) {
          requestHeaders.set("x-org-id", activeMembership.organizationId);
        }
        requestHeaders.set("x-org-role", activeMembership.role);
      }
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    console.error("proxy middleware error:", err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/sign-in",
    "/onboarding",
    "/dashboard/:path*",
    "/api/billing/:path*",
    "/api/gtm/:path*",
  ],
};
