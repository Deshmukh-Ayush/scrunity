import type { Metadata } from "next"
import { Container } from "@/components/layout/container"
import { Home } from "@/components/home/home"
import { getTenantContext } from "@/lib/tenant-context"

export const metadata: Metadata = {
  title: "Home | Scrunity",
}

export default async function HomePage() {
  const { user } = await getTenantContext()
  const firstName = user?.name?.trim().split(/\s+/)[0] || null

  return (
    <Container width="prose">
      <Home firstName={firstName} />
    </Container>
  )
}
