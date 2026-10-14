/**
 * Verifies that src/proxy.ts fails closed: when resolving the session throws
 * (auth/DB outage), protected pages redirect to /sign-in and protected APIs
 * get a JSON error, while public paths stay public. Calls the proxy function
 * in-process with a stubbed `auth.api.getSession`; no server, no DB writes.
 *
 *   npx tsx scripts/test-proxy-fail-closed.ts
 */
import "dotenv/config"
import { NextRequest } from "next/server"
import { auth } from "../src/lib/auth"
import { proxy } from "../src/proxy"

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`)
  if (!ok) process.exitCode = 1
}

function describe(res: Response) {
  const location = res.headers.get("location")
  const passThrough = res.headers.get("x-middleware-next") === "1"
  return `${res.status}${location ? ` -> ${location}` : ""}${passThrough ? " (passed through)" : ""}`
}

async function main() {
  // Simulate an auth/database outage inside the proxy.
  ;(auth.api as { getSession: unknown }).getSession = async () => {
    throw new Error("simulated session lookup failure")
  }
  const origError = console.error
  console.error = () => {}

  const run = (path: string) => proxy(new NextRequest(new URL(path, "http://localhost:3000")))

  const dashboard = await run("/dashboard")
  check("/dashboard is not passed through", dashboard.headers.get("x-middleware-next") !== "1", describe(dashboard))
  check(
    "/dashboard redirects to /sign-in",
    dashboard.status === 307 && (dashboard.headers.get("location") ?? "").includes("/sign-in"),
    describe(dashboard)
  )

  const onboarding = await run("/onboarding")
  check("/onboarding redirects to /sign-in", (onboarding.headers.get("location") ?? "").includes("/sign-in"), describe(onboarding))

  const api = await run("/api/gtm/campaigns")
  check("/api/gtm/campaigns gets a 5xx JSON error", api.status >= 500 && api.status < 600, describe(api))

  const admin = await run("/api/admin/invites")
  check("/api/admin/invites is not passed through", admin.headers.get("x-middleware-next") !== "1", describe(admin))

  const signIn = await run("/sign-in")
  check("/sign-in (public) stays reachable", signIn.headers.get("x-middleware-next") === "1", describe(signIn))

  const webhook = await run("/api/billing/webhook")
  check("/api/billing/webhook (signature-auth) stays reachable", webhook.headers.get("x-middleware-next") === "1", describe(webhook))

  console.error = origError
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
