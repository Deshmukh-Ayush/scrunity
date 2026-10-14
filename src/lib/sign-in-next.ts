/**
 * Where to send someone after sign-in when they came from a link that needs
 * an account (a team invitation). Only same-site invitation paths are
 * accepted, so `?next=` can never become an open redirect.
 */
export function safeSignInNext(next: string | null | undefined): string | null {
  if (!next) return null
  return /^\/invite\/org\/[A-Za-z0-9_-]{1,100}$/.test(next) ? next : null
}
