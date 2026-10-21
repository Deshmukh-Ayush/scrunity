import type { Metadata } from "next"
import Link from "next/link"
import { Container } from "@/components/layout/container"
import { ImportFlow } from "@/components/contact-import/import-flow"
import { ArrowLeft } from "@/components/ui/icons"
import { MANAGER_ROLES } from "@/lib/api-role-policy"
import { IMPORT_COPY } from "@/lib/contact-import/copy"
import { CSV_IMPORT_MAX_MB, getCsvImportMaxRows } from "@/lib/contact-import/limits"
import { getTenantContext } from "@/lib/tenant-context"

export const metadata: Metadata = {
  title: "Import a list | Scrunity",
  description: "Upload a CSV of people your campaigns should reach.",
}

export default async function ImportListPage() {
  // Session state only (the proxy's role header); uploads are refused for members in the proxy too.
  const { memberRole } = await getTenantContext()
  const canManage = MANAGER_ROLES.has(memberRole ?? "member")
  return (
    <Container width="page" className="flex max-w-4xl flex-col gap-6 py-6 md:py-8">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/settings/data-sources"
          className="inline-flex w-fit items-center gap-1 rounded-sm text-body text-fg-muted hover:text-fg-strong focus-ring"
        >
          <ArrowLeft className="size-4" />
          {IMPORT_COPY.backToDataSources}
        </Link>
        <h1 className="text-title text-fg-strong">{IMPORT_COPY.pageTitle}</h1>
        <p className="text-body text-fg-muted">{IMPORT_COPY.pageDescription}</p>
      </div>
      {canManage ? (
        <ImportFlow maxRows={getCsvImportMaxRows()} maxMb={CSV_IMPORT_MAX_MB} />
      ) : (
        <p className="rounded-xl border border-transparent bg-surface p-4 text-body text-fg-default shadow-surface">
          {IMPORT_COPY.managerOnly}
        </p>
      )}
    </Container>
  )
}
