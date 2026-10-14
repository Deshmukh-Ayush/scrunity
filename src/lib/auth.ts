import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/utils/db";
import { session } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { magicLink, organization } from "better-auth/plugins"
import { ONBOARDING_ORG_SOURCE, onboardingOrganizationId } from "@/lib/onboarding-id";
import { MAGIC_LINK_EXPIRES_IN_SECONDS, magicLinkBaseUrl, sendMagicLink } from "@/lib/magic-link";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")),
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustHost: true,
  // The magic-link base URL (NEXT_PUBLIC_APP_URL, e.g. a LAN address or tunnel
  // during demos) must be trusted for its absolute callback URLs.
  trustedOrigins: ["https://scrunity.com", "https://www.scrunity.com", "https://beta.scrunity.com", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", magicLinkBaseUrl()],
  plugins: [
    organization({
      organizationHooks: {
        // The onboarding org gets an id derived from its creator, so a double
        // submit or a retried request can never create a second one: the
        // second insert hits the primary key (see lib/onboarding.ts).
        beforeCreateOrganization: async ({ organization, user }) => {
          if (organization.metadata?.source !== ONBOARDING_ORG_SOURCE) return
          return { data: { id: onboardingOrganizationId(user.id) } }
        },
        // A removed member's sessions must not keep the org active (the proxy
        // also refuses it on every request, this just clears the stale value).
        afterRemoveMember: async ({ member: removed, organization }) => {
          await db
            .update(session)
            .set({ activeOrganizationId: null })
            .where(and(eq(session.userId, removed.userId), eq(session.activeOrganizationId, organization.id)))
        },
      },
    }),
    // Email sign-in for invited customers (Google may be limited to test users).
    // Tokens are stored hashed, expire after 5 minutes and are consumed on first
    // use; lib/magic-link.ts only delivers to invited or existing users.
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
      storeToken: "hashed",
      rateLimit: { window: 60, max: 5 },
      sendMagicLink,
    }),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }
  }
});
