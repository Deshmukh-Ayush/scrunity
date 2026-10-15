import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getPlatformAdmin } from "@/lib/platform-admin"
import { ComponentTester } from "@/components/playground/testing/component-tester"

export const metadata: Metadata = {
  title: "Component testing",
  robots: { index: false, follow: false },
}

/**
 * Internal component testing route (PLATFORM_ADMIN_EMAILS only). src/proxy.ts
 * already answers everyone else with a 404; the check is repeated here.
 */
export default async function ComponentTestingPage() {
  if (!(await getPlatformAdmin(await headers()))) notFound()

  return <ComponentTester />
}
