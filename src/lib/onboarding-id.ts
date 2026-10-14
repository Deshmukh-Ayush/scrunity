/** Metadata marker for the organization created by onboarding. */
export const ONBOARDING_ORG_SOURCE = "onboarding"

/**
 * The id of a user's onboarding organization. Deterministic on purpose: it is
 * the idempotency key that stops a double submit from creating two orgs.
 */
export function onboardingOrganizationId(userId: string): string {
  return `org_${userId}`
}
