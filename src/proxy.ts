import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/utils/db";
import { member, organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isPlatformAdminUser } from "@/lib/platform-admin-emails";
import { safeSignInNext } from "@/lib/sign-in-next";

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

    const testOrgParam = request.nextUrl.searchParams.get("test_org") || request.cookies.get("test_org")?.value;
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

    // Set org id from the session's active organization
    const activeOrgId = session.session?.activeOrganizationId || "";
    if (activeOrgId) {
      requestHeaders.set("x-org-id", activeOrgId);
    }

    // Dashboard needs an organization (none -> onboarding); onboarding is only
    // for users without one (has one -> dashboard).
    if (pathname.startsWith("/dashboard") || isOnboarding) {
      const userId = session.user.id;
      const orgMemberships = await db
        .select({ role: member.role, organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, userId));

      if (isOnboarding) {
        if (orgMemberships.length > 0) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        return NextResponse.next({ request: { headers: requestHeaders } });
      }

      if (orgMemberships.length === 0) {
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
