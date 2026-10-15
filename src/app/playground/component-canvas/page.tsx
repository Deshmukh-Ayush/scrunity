import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getPlatformAdmin } from "@/lib/platform-admin"
import { ComponentCanvas } from "@/components/playground/component-canvas/component-canvas"
import { RegistryGroups } from "@/components/playground/component-canvas/registry-groups"
import { InventoryGroups } from "@/components/playground/component-canvas/inventory-groups"

export const metadata: Metadata = {
  title: "Component canvas",
  robots: { index: false, follow: false },
}

/**
 * Internal component canvas (PLATFORM_ADMIN_EMAILS only). src/proxy.ts already
 * answers everyone else with a 404; the check is repeated here against the session.
 */
export default async function ComponentCanvasPage() {
  if (!(await getPlatformAdmin(await headers()))) notFound()

  return (
    <ComponentCanvas>
      <RegistryGroups />
      <InventoryGroups />
    </ComponentCanvas>
  )
}
