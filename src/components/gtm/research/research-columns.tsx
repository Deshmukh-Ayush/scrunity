import {
  DateCell,
  EntityCell,
  NumberCell,
  StatusCell,
  TextCell,
  type DataTableColumn,
} from "@/components/ui/data-table"
import type { PipelineStatus, ResearchBucket } from "../pipeline-status"
import type { ResearchRunItem } from "../campaigns-overview/types"

/** A research run plus its status, computed once per render (stalled needs the clock). */
export interface ResearchTableRow extends ResearchRunItem {
  display: PipelineStatus<ResearchBucket>
  domain: string
}

/** "https://www.acme.com/about" → "acme.com". Falls back to the stored value. */
export function domainOf(url: string) {
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`
    return new URL(withScheme).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export const researchColumns: DataTableColumn<ResearchTableRow>[] = [
  {
    id: "company",
    header: "Company",
    type: "entity",
    // The row opens the run's segments view (the detail panel under the table).
    cell: (row) => (
      <EntityCell
        name={row.companyName}
        href={`/dashboard/research?run=${row.id}`}
        imageUrl={row.logoUrl}
      />
    ),
    sortValue: (row) => row.companyName,
  },
  {
    id: "website",
    header: "Website",
    type: "text",
    cell: (row) => <TextCell value={row.domain} muted className="max-w-48" />,
    sortValue: (row) => row.domain,
  },
  {
    id: "description",
    header: "Description",
    type: "text",
    cell: (row) => (
      <TextCell value={row.companyDescription} muted className="max-w-96" />
    ),
  },
  {
    id: "status",
    header: "Status",
    type: "status",
    cell: (row) => (
      <StatusCell
        label={row.display.label}
        tone={row.display.tone}
        icon={row.display.icon}
      />
    ),
    sortValue: (row) => row.display.label,
  },
  {
    id: "segments",
    header: "Segments",
    type: "number",
    cell: (row) => <NumberCell value={row.segmentCount ?? null} />,
    sortValue: (row) => row.segmentCount ?? null,
  },
  {
    id: "started",
    header: "Started",
    type: "date",
    cell: (row) => <DateCell value={row.createdAt} />,
    sortValue: (row) => new Date(row.createdAt).getTime(),
  },
]
