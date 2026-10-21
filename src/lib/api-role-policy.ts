/**
 * Which /api/gtm/* calls need an owner or admin. Enforced once, centrally, in
 * src/proxy.ts with the role from the member row. Members can read everything
 * in their organization, generate drafts and use chat; owners and admins can
 * also launch, send, approve/reject, delete, restart and manage the mailbox.
 * No `server-only` import so the proxy can use it.
 */
const MANAGER_ROUTES: { methods: string[]; pattern: RegExp }[] = [
  // Launching work that spends budget
  { methods: ["POST"], pattern: /^\/api\/gtm\/campaigns$/ },
  { methods: ["POST"], pattern: /^\/api\/gtm\/research-runs$/ },
  { methods: ["PATCH"], pattern: /^\/api\/gtm\/research-runs\/[^/]+$/ },
  { methods: ["POST"], pattern: /^\/api\/gtm\/research-runs\/[^/]+\/restart-stage$/ },
  { methods: ["POST"], pattern: /^\/api\/gtm\/segments\/[^/]+\/digest$/ },
  // Campaign control: send, approve/reject, restart, company selection
  { methods: ["POST"], pattern: /^\/api\/gtm\/campaigns\/[^/]+\/(send|rerun|restart-stage|confirm-selection|drafts)$/ },
  { methods: ["POST"], pattern: /^\/api\/gtm\/campaigns\/[^/]+\/drafts\/[^/]+$/ },
  { methods: ["POST"], pattern: /^\/api\/gtm\/leads\/[^/]+\/send$/ },
  // Mailbox: connect, reconnect, disconnect
  { methods: ["DELETE"], pattern: /^\/api\/gtm\/mailbox$/ },
  { methods: ["GET", "POST"], pattern: /^\/api\/gtm\/mailbox\/(connect|callback|imap-smtp\/connect|microsoft\/connect|microsoft\/callback)$/ },
  // Data sources (the organization's own provider accounts): connect, disconnect
  { methods: ["POST", "DELETE"], pattern: /^\/api\/gtm\/data-sources\/[^/]+$/ },
  // Imported lists: upload (POST .../imports, matched above) and delete
  { methods: ["DELETE"], pattern: /^\/api\/gtm\/data-sources\/imports\/[^/]+$/ },
  // Deleting shared records
  { methods: ["DELETE"], pattern: /^\/api\/gtm\/chat\/conversations\/[^/]+$/ },
]

export const MANAGER_ROLES = new Set(["owner", "admin"])

export function requiresManagerRole(method: string, pathname: string): boolean {
  return MANAGER_ROUTES.some((r) => r.methods.includes(method.toUpperCase()) && r.pattern.test(pathname))
}
