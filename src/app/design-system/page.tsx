import type { Metadata } from "next"
import { DesignSystemShell } from "@/components/design-system/design-system-shell"

export const metadata: Metadata = {
  title: "Design system",
  description: "Scrunity's tokens and components, with every interactive state.",
}

/**
 * Public design system. Not in the proxy matcher, so no session is needed.
 * Every showcase entry renders fixtures only (no database, no API calls), so
 * it is safe to show to anyone; the admin-only testing route under
 * /playground shows the same registry.
 */
export default function DesignSystemPage() {
  return <DesignSystemShell />
}
