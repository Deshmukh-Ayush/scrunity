import type { Metadata } from "next"
import { Container } from "@/components/layout/container"
import { CompanySettings } from "@/components/company-profile/company-settings"
import { COMPANY_PROFILE_COPY } from "@/lib/company-profile/copy"

export const metadata: Metadata = {
  title: "Company profile | Scrunity",
  description: "The company details new research runs start from.",
}

export default function CompanyProfilePage() {
  return (
    <Container width="page" className="flex max-w-3xl flex-col gap-6 py-6 md:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg-strong">{COMPANY_PROFILE_COPY.pageTitle}</h1>
        <p className="text-body text-fg-muted">{COMPANY_PROFILE_COPY.pageDescription}</p>
      </div>
      <CompanySettings />
    </Container>
  )
}
