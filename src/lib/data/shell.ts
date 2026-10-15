import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { organization } from "@/db/schema"
import { getAiCreditBalance } from "@/lib/gtm-ai-credits"

/**
 * What the app shell's sidebar shows: the workspace name and the credits
 * left this period. A failed credit lookup hides the pill instead of
 * breaking every page.
 */
export async function getShellData(organizationId: string) {
  const [[org], balance] = await Promise.all([
    db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1),
    getAiCreditBalance(organizationId).catch((err) => {
      console.error("[shell] credit balance unavailable:", err)
      return null
    }),
  ])

  return {
    workspaceName: org?.name ?? null,
    creditsRemaining: balance?.creditsRemaining ?? null,
  }
}

export type ShellData = Awaited<ReturnType<typeof getShellData>>
