import type { Metadata } from "next"
import { Container } from "@/components/layout/container"
import { DataSources } from "@/components/data-sources/data-sources"
import { DATA_SOURCE_COPY } from "@/lib/data-sources/copy"

export const metadata: Metadata = {
  title: "Data sources | Scrunity",
  description: "Connect the Apollo account your campaigns use.",
}

export default function DataSourcesPage() {
  return (
    <Container width="page" className="flex max-w-3xl flex-col gap-6 py-6 md:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg-strong">{DATA_SOURCE_COPY.pageTitle}</h1>
        <p className="text-body text-fg-muted">{DATA_SOURCE_COPY.pageDescription}</p>
      </div>
      <DataSources />
    </Container>
  )
}
