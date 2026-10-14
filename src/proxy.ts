import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/utils/db";
import { member, organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isPlatformAdminUser } from "@/lib/platform-admin-emails";
import { safeSignInNext } from "@/lib/sign-in-next";
import { MANAGER_ROLES, requiresManagerRole } from "@/lib/api-role-policy";

const protectedPaths = ["/dashboard", "/api/billing", "/api/gtm", "/api/onboarding", "/api/admin"];

// Platform admin area (PLATFORM_ADMIN_EMAILS). Anyone else gets a plain 404.
const isAdminPath = (pathname: string) =>
  pathname === "/dashboard/admin" ||
  pathname.startsWith("/dashboard/admin/") ||
  pathname === "/api/admin" ||
  pathname.startsWith("/api/admin/");

function adminNotFound(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // No route matches this path, so the app's not-found page renders with a 404.
  return NextResponse.rewrite(new URL("/404", request.url));
}

/**
 * `?test_org=` impersonation for local scripts. Requires a non-production build
 * AND ALLOW_TEST_ORG=true in the server's own environment (off by default).
 */
function testOrgBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_TEST_ORG === "true";
}

// Called server-to-server by Dodo Payments with no session cookie. Exempt from
// session auth by exact path only; the route verifies Dodo's webhook signature
// on the raw body instead (src/app/api/billing/webhook/route.ts).
const sessionlessPaths = new Set(["/api/billing/webhook"]);

export async function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    if (sessionlessPaths.has(pathname)) {
      return NextResponse.next();
    }

    const isSignIn = pathname === "/sign-in";
    const isOnboarding = pathname === "/onboarding";
    const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

    if (!isSignIn && !isOnboarding && !isProtected) {
      return NextResponse.next();
    }

    // Local test impersonation (?test_org=<orgId>). Off unless the server process
    // itself opts in, and never in a production build: the hostname comes from the
    // request, so it cannot be the only guard (a LAN client passed it before).
    const testOrgParam = testOrgBypassEnabled()
      ? request.nextUrl.searchParams.get("test_org") || request.cookies.get("test_org")?.value
      : null;
    const isLocalhost = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";

    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Checked before the localhost test_org bypass: impersonation never reaches admin.
    if (isAdminPath(pathname) && !isPlatformAdminUser(session?.user)) {
      return adminNotFound(request);
    }

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
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (isProtected || isOnboarding) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
      return NextResponse.next();
    }

    if (isSignIn) {
      const next = safeSignInNext(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(next ?? "/dashboard", request.url));
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

    // The organization is resolved on every protected request from a membership
    // row, never from the session alone: a removed member's session may still
    // name the org as active. x-org-id / x-org-role are only set from that row.
    const activeOrgId = session.session?.activeOrganizationId || "";
    const orgMemberships = await db
      .select({ role: member.role, organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, session.user.id));
    const activeMembership = activeOrgId
      ? orgMemberships.find((m) => m.organizationId === activeOrgId)
      : orgMemberships[0];

    // Dashboard needs an organization (none -> onboarding); onboarding is only
    // for users without one (has one -> dashboard).
    if (isOnboarding) {
      if (orgMemberships.length > 0) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (pathname.startsWith("/dashboard") && orgMemberships.length === 0) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // Active org that is no longer one of the user's memberships: API calls are
    // refused outright; pages fall back to the user's first remaining org.
    if (activeOrgId && !activeMembership && pathname.startsWith("/api/") && pathname !== "/api/onboarding") {
      return NextResponse.json(
        { error: "You are no longer a member of this organization." },
        { status: 403 }
      );
    }
    const resolved = activeMembership ?? orgMemberships[0];
    if (resolved) {
      requestHeaders.set("x-org-id", resolved.organizationId);
      requestHeaders.set("x-org-role", resolved.role);
    }

    // Role policy for /api/gtm/* (src/lib/api-role-policy.ts), from the member row.
    if (
      resolved &&
      requiresManagerRole(request.method, pathname) &&
      !MANAGER_ROLES.has(resolved.role)
    ) {
      return NextResponse.json(
        { error: "Only organization owners and admins can do this." },
        { status: 403 }
      );
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    // Fail closed: if the session or membership lookup fails we cannot know
    // who this is, so protected paths are refused; public paths stay public.
    console.error("proxy middleware error:", err);
    const { pathname } = request.nextUrl;
    if (isAdminPath(pathname)) return adminNotFound(request);
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "We couldn't verify your session. Please try again in a moment." },
        { status: 503 }
      );
    }
    if (pathname === "/onboarding" || protectedPaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.redirect(new URL("/sign-in?error=session_unavailable", request.url));
    }
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
    "/api/onboarding",
    "/api/admin/:path*",
  ],
};
