/**
 * Times GET /api/gtm/leads in-process (the route handler itself, with the
 * proxy's identity headers) on the same org, N runs after one warm-up.
 * Read-only.
 *
 *   npx tsx scripts/time-leads-route.ts <organizationId> [runs]
 */
import "dotenv/config"
import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "../src/utils/db"
import { member } from "../src/db/schema"
import { GET } from "../src/app/api/gtm/leads/route"

async function main() {
  const orgId = process.argv[2]
  const runs = Number(process.argv[3] ?? 10)
  if (!orgId) throw new Error("usage: time-leads-route.ts <organizationId> [runs]")
  const [m] = await db.select().from(member).where(eq(member.organizationId, orgId)).limit(1)
  const call = async () => {
    const req = new NextRequest("http://localhost:3000/api/gtm/leads?page=1&pageSize=20", {
      headers: { "x-user-id": m.userId, "x-org-id": orgId, "x-org-role": m.role },
    })
    const t0 = performance.now()
    const res = await GET(req)
    const body = await res.json()
    return { ms: performance.now() - t0, status: res.status, total: body.total, leads: body.leads?.length, campaigns: body.campaigns?.length }
  }
  const warm = await call()
  console.log("warm-up:", warm)
  const times: number[] = []
  for (let i = 0; i < runs; i++) times.push((await call()).ms)
  times.sort((a, b) => a - b)
  const median = times[Math.floor(times.length / 2)]
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  console.log(`runs=${runs} median=${median.toFixed(0)}ms mean=${mean.toFixed(0)}ms min=${times[0].toFixed(0)}ms max=${times[times.length - 1].toFixed(0)}ms`)
}
main().then(() => process.exit(0))
