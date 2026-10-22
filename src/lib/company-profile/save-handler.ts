import { MANAGER_ROLES } from "@/lib/api-role-policy"
import { COMPANY_PROFILE_COPY } from "./copy"
import {
  saveCompanyProfileSchema,
  type CompanyProfileInput,
  type CompanyProfileView,
  type ResearchFormMode,
} from "./input"

export interface SaveProfileDeps {
  save: (organizationId: string, userId: string, input: CompanyProfileInput, mode: ResearchFormMode) => Promise<void>
  load: (organizationId: string, role: string) => Promise<CompanyProfileView>
}

export type SaveProfileResult =
  | { status: 200; body: CompanyProfileView }
  | { status: 400 | 403; body: { error: string; details?: unknown } }

/**
 * PUT /api/gtm/company-profile without the HTTP and DB layers: the role is
 * checked here too, not only by the proxy, before the body is validated or
 * anything is written. The route passes the real store; tests pass stubs.
 */
export async function handleSaveCompanyProfile(
  auth: { userId: string; orgId: string; role: string },
  body: unknown,
  deps: SaveProfileDeps
): Promise<SaveProfileResult> {
  if (!MANAGER_ROLES.has(auth.role)) {
    return { status: 403, body: { error: COMPANY_PROFILE_COPY.membersReadOnly } }
  }
  const parsed = saveCompanyProfileSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, body: { error: COMPANY_PROFILE_COPY.invalid, details: parsed.error.issues } }
  }
  const { researchFormMode, ...input } = parsed.data
  await deps.save(auth.orgId, auth.userId, input, researchFormMode)
  return { status: 200, body: await deps.load(auth.orgId, auth.role) }
}
