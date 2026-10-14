import { decryptToken } from "@/lib/encryption"

export interface MailboxOAuthState {
  orgId: string
  userId: string
  ts: number
}

/** How long a connect link stays valid. */
const MAX_AGE_MS = 10 * 60 * 1000

/**
 * Verifies the encrypted `state` of a mailbox OAuth callback. It must decrypt,
 * be at most 10 minutes old, and belong to the user and organization of the
 * session finishing the flow (proxy-resolved x-user-id / x-org-id), so a
 * connect link started by someone else can't attach a mailbox to their org.
 */
export function verifyMailboxOAuthState(
  state: string,
  reqHeaders: Headers
): { ok: true; state: MailboxOAuthState } | { ok: false; reason: string } {
  let parsed: MailboxOAuthState
  try {
    parsed = JSON.parse(decryptToken(state)) as MailboxOAuthState
  } catch {
    return { ok: false, reason: "invalid_or_expired_state" }
  }
  if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > MAX_AGE_MS || parsed.ts > Date.now() + 60_000) {
    return { ok: false, reason: "invalid_or_expired_state" }
  }
  const sessionUser = reqHeaders.get("x-user-id")
  const sessionOrg = reqHeaders.get("x-org-id")
  if (!sessionUser || parsed.userId !== sessionUser || !sessionOrg || parsed.orgId !== sessionOrg) {
    return { ok: false, reason: "state_session_mismatch" }
  }
  return { ok: true, state: parsed }
}
