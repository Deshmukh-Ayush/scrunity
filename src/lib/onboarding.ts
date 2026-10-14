import "server-only"
import crypto from "node:crypto"
import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { ONBOARDING_ORG_SOURCE, onboardingOrganizationId } from "@/lib/onboarding-id"
import { db } from "@/utils/db"
import { member, organization } from "@/db/schema"
import { claimPilotInvite } from "@/lib/pilot/claim"

export type OnboardingResult =
  | { status: "created" | "resumed" | "existing"; organizationId: string }
  | { status: "unauthorized" | "invalid_name" | "slug_unavailable" }

const MAX_NAME_LENGTH = 80

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

/**
 * Slugs to try, in order. The second is stable per user, so two concurrent
 * submits from the same user try the same slugs and collide on the org id
 * rather than racing to two different slugs.
 */
function slugCandidates(name: string, userId: string) {
  const base = slugify(name) || "workspace"
  const userHash = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 6)
  return [base, `${base}-${userHash}`, `${base}-${crypto.randomBytes(3).toString("hex")}`]
}

async function firstMembership(userId: string) {
  const [row] = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1)
  return row
}

async function organizationExists(organizationId: string) {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
  return Boolean(row)
}

async function slugTaken(slug: string) {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
  return Boolean(row)
}

/**
 * Adds the user as owner of their onboarding org if they are not already a
 * member. Safe to call any number of times: a duplicate is refused by Better
 * Auth or by the unique (organization_id, user_id) index, and the membership
 * is then read back to confirm it exists.
 */
async function ensureOwnerMembership(organizationId: string, userId: string) {
  try {
    await auth.api.addMember({ body: { organizationId, userId, role: "owner" } })
  } catch {
    // Already a member (or a concurrent request just added it) — checked below.
  }
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
  if (!row) throw new Error(`Could not add owner membership for organization ${organizationId}`)
}

async function ensureActive(reqHeaders: Headers, activeOrgId: string | null | undefined, organizationId: string) {
  if (activeOrgId === organizationId) return
  await auth.api.setActiveOrganization({ headers: reqHeaders, body: { organizationId } })
}

/**
 * Creates the signed-in user's organization (owner membership, set active).
 *
 * Neon's HTTP driver has no interactive transactions, so the writes are
 * ordered to be safely retryable instead: (1) the org row, whose primary key
 * is derived from the user id, (2) the owner membership, (3) the session's
 * active org. Each repeat of this function finishes whichever step is
 * missing, and the org insert itself can only ever succeed once per user.
 */
export async function ensureOnboardingOrganization(
  reqHeaders: Headers,
  rawName: string
): Promise<OnboardingResult> {
  const session = await auth.api.getSession({ headers: reqHeaders })
  if (!session) return { status: "unauthorized" }

  const result = await createOrResumeOrganization(reqHeaders, session, rawName)

  // Pilot access: an invited email's own onboarding org gets the invited plan
  // and credits once (lib/pilot/claim.ts). Runs on every successful submit, so
  // a resubmit finishes a claim that failed halfway. A throw here surfaces as
  // a retryable 500 from /api/onboarding.
  if (
    "organizationId" in result &&
    result.organizationId === onboardingOrganizationId(session.user.id) &&
    session.user.emailVerified
  ) {
    await claimPilotInvite({
      userId: session.user.id,
      email: session.user.email,
      organizationId: result.organizationId,
    })
  }
  return result
}

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>

async function createOrResumeOrganization(
  reqHeaders: Headers,
  session: Session,
  rawName: string
): Promise<OnboardingResult> {
  const userId = session.user.id
  const activeOrgId = session.session.activeOrganizationId

  const name = rawName.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH)
  if (!name) return { status: "invalid_name" }

  // Already onboarded (any org): never create another one.
  const existing = await firstMembership(userId)
  if (existing) {
    await ensureActive(reqHeaders, activeOrgId, existing.organizationId)
    return { status: "existing", organizationId: existing.organizationId }
  }

  // A previous attempt created the org but stopped before the membership.
  const organizationId = onboardingOrganizationId(userId)
  if (await organizationExists(organizationId)) {
    await ensureOwnerMembership(organizationId, userId)
    await ensureActive(reqHeaders, activeOrgId, organizationId)
    return { status: "resumed", organizationId }
  }

  for (const slug of slugCandidates(name, userId)) {
    try {
      // Creates the org, the owner membership and sets it active on the session.
      await auth.api.createOrganization({
        headers: reqHeaders,
        body: { name, slug, metadata: { source: ONBOARDING_ORG_SOURCE } },
      })
      return { status: "created", organizationId }
    } catch (err) {
      // A concurrent submit from this user created the org first: finish it.
      if (await organizationExists(organizationId)) {
        await ensureOwnerMembership(organizationId, userId)
        await ensureActive(reqHeaders, activeOrgId, organizationId)
        return { status: "existing", organizationId }
      }
      if (await slugTaken(slug)) continue
      throw err
    }
  }
  return { status: "slug_unavailable" }
}
