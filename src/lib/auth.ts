import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/utils/db";
import { organization } from "better-auth/plugins"
import { ONBOARDING_ORG_SOURCE, onboardingOrganizationId } from "@/lib/onboarding-id";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")),
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  trustHost: true,
  trustedOrigins: ["https://scrunity.com", "https://www.scrunity.com", "https://beta.scrunity.com", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"],
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
      },
    }),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }
  }
});
