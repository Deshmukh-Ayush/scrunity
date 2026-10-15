"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  CheckCircleSolid,
  XCircleSolid,
  AlertTriangleSolid,
} from "@/components/icons/status"
import {
  ActionsCell,
  DataTable,
  DataTableMessage,
  DateCell,
  EntityCell,
  FilterChips,
  NumberCell,
  StatusCell,
  TextCell,
  type DataTableColumn,
} from "@/components/ui/data-table"

/** Fixture rows for the testing route only (never shown in the product). */
interface DemoRow {
  id: string
  name: string
  domain: string
  description: string
  status: "Done" | "Failed" | "Stalled" | "Running"
  leads: number | null
  updated: string
}

const NOW = Date.UTC(2026, 9, 16, 12)
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

const STATUS = {
  Done: {
    tone: "success",
    icon: <CheckCircleSolid data-icon="inline-start" />,
  },
  Failed: { tone: "danger", icon: <XCircleSolid data-icon="inline-start" /> },
  Stalled: {
    tone: "warning",
    icon: <AlertTriangleSolid data-icon="inline-start" />,
  },
  Running: { tone: "neutral", icon: undefined },
} as const

const ROWS: DemoRow[] = [
  {
    id: "1",
    name: "Northwind Analytics",
    domain: "northwind.io",
    description: "Product analytics for logistics teams",
    status: "Done",
    leads: 12,
    updated: hoursAgo(2),
  },
  {
    id: "2",
    name: "Lattice Freight",
    domain: "latticefreight.com",
    description: "Freight brokerage software",
    status: "Running",
    leads: 4,
    updated: hoursAgo(20),
  },
  {
    id: "3",
    name: "Acme Robotics",
    domain: "acme-robotics.co",
    description: "Warehouse robots",
    status: "Stalled",
    leads: null,
    updated: hoursAgo(80),
  },
  {
    id: "4",
    name: "Bluefin Health",
    domain: "bluefin.health",
    description: "Care coordination for clinics",
    status: "Failed",
    leads: 0,
    updated: hoursAgo(400),
  },
]

const LONG_ROW: DemoRow = {
  id: "long",
  name: "International Enterprise Logistics & Advanced Technology Solutions Corporation of North America",
  domain: "international-enterprise-logistics-advanced-technology.example",
  description:
    "A very long description that keeps going well past the width of its column so it has to truncate with an ellipsis and keep the full text in the title attribute",
  status: "Running",
  leads: 1234567,
  updated: hoursAgo(1),
}

const COLUMNS: DataTableColumn<DemoRow>[] = [
  {
    id: "name",
    header: "Company",
    type: "entity",
    cell: (row) => <EntityCell name={row.name} href="#data-table" />,
    sortValue: (row) => row.name,
  },
  {
    id: "domain",
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
      <TextCell value={row.description} muted className="max-w-72" />
    ),
  },
  {
    id: "status",
    header: "Status",
    type: "status",
    cell: (row) => (
      <StatusCell
        label={row.status}
        tone={STATUS[row.status].tone}
        icon={STATUS[row.status].icon}
      />
    ),
    sortValue: (row) => row.status,
  },
  {
    id: "leads",
    header: "Verified leads",
    type: "number",
    cell: (row) => <NumberCell value={row.leads} />,
    sortValue: (row) => row.leads,
  },
  {
    id: "updated",
    header: "Last activity",
    type: "date",
    cell: (row) => <DateCell value={row.updated} mode="relative" />,
    sortValue: (row) => new Date(row.updated).getTime(),
  },
  {
    id: "action",
    header: "Action",
    type: "actions",
    cell: () => (
      <ActionsCell>
        <Button size="sm">View pipeline</Button>
      </ActionsCell>
    ),
  },
]

/** Many columns: the same data repeated so the table scrolls sideways. */
const WIDE_COLUMNS: DataTableColumn<DemoRow>[] = [
  ...COLUMNS.slice(0, -1),
  ...["Region", "Industry", "Headcount", "Owner", "Source", "Stage"].map(
    (header) => ({
      id: header.toLowerCase(),
      header,
      type: "text" as const,
      cell: (row: DemoRow) => (
        <TextCell value={`${header} for ${row.name.split(" ")[0]}`} />
      ),
    })
  ),
  COLUMNS[COLUMNS.length - 1],
]

const MANY_ROWS: DemoRow[] = Array.from({ length: 60 }, (_, i) => ({
  ...ROWS[i % ROWS.length],
  id: `many-${i}`,
  name: `${ROWS[i % ROWS.length].name} ${i + 1}`,
  updated: hoursAgo(i * 3),
}))

function Labeled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-meta text-fg-muted">{label}</h3>
      {children}
    </section>
  )
}

/** Every DataTable state, one after another, for the testing route. */
export function DataTableShowcase() {
  const [chip, setChip] = React.useState("all")
  const chips = [
    { value: "running", label: "Running", count: 1 },
    { value: "stalled", label: "Stalled", count: 1 },
    { value: "done", label: "Done", count: 1 },
  ]
  return (
    <div className="flex w-full flex-col gap-10">
      <Labeled label="Default (sortable headers, row link on the name, action on the right) with filter chips">
        <FilterChips
          label="Filter by status"
          chips={chips}
          value={chip}
          onChange={setChip}
          total={4}
        />
        <DataTable
          label="Demo companies"
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
          defaultSort={{ columnId: "updated", direction: "desc" }}
        />
      </Labeled>
      <Labeled label="Compact density (32px rows)">
        <DataTable
          label="Demo companies, compact"
          density="compact"
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
        />
      </Labeled>
      <Labeled label="Loading">
        <DataTable
          label="Demo companies, loading"
          loading
          columns={COLUMNS}
          rows={[]}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
        />
      </Labeled>
      <Labeled label="Empty">
        <DataTable
          label="Demo companies, empty"
          columns={COLUMNS}
          rows={[]}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
          empty={
            <DataTableMessage
              title="No companies yet"
              description="Companies appear here once a campaign finds them."
              action={<Button size="sm">Start a campaign</Button>}
            />
          }
        />
      </Labeled>
      <Labeled label="Error">
        <DataTable
          label="Demo companies, error"
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
          error={
            <DataTableMessage
              role="alert"
              title="Companies didn't load"
              description="Check your connection, then try again."
              action={<Button size="sm">Try again</Button>}
            />
          }
        />
      </Labeled>
      <Labeled label="Long text (truncates; full value in the title)">
        <DataTable
          label="Demo companies, long text"
          columns={COLUMNS}
          rows={[LONG_ROW, ...ROWS.slice(0, 1)]}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
        />
      </Labeled>
      <Labeled label="Many columns (scrolls sideways inside the focusable region)">
        <DataTable
          label="Demo companies, many columns"
          columns={WIDE_COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
        />
      </Labeled>
      <Labeled label="60 rows: pager at 25, sticky header in a 320px-tall region">
        <DataTable
          label="Demo companies, many rows"
          columns={COLUMNS}
          rows={MANY_ROWS}
          rowKey={(r) => r.id}
          rowHref={() => "#data-table"}
          regionClassName="max-h-80"
        />
      </Labeled>
    </div>
  )
}
