"use client"

import * as React from "react"
import { ClientTableItem } from "./clients-table-types"
import { ClientsSearchFilters } from "./clients-search-filters"
import { WorkspaceClientEmptyState, FilterClientEmptyState } from "./clients-empty-state"
import { ClientsTableRow } from "./clients-table-row"
import { DataTableShell } from "@/components/dashboard/shared/data-table-shell"

export type { ClientTableItem }

interface ClientsTableClientProps {
  clients: ClientTableItem[]
  initialStatus?: "all" | "active" | "invited"
}

const TABLE_HEADERS = ["Client", "Status", "Projects", "Total Value", "Joined / Invited", "Action"]

export function ClientsTableClient({ clients, initialStatus = "all" }: ClientsTableClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "invited">(
    initialStatus === "active" || initialStatus === "invited" ? initialStatus : "all"
  )

  React.useEffect(() => {
    if (initialStatus === "active" || initialStatus === "invited") {
      setStatusFilter(initialStatus)
    } else {
      setStatusFilter("all")
    }
  }, [initialStatus])

  const filteredClients = React.useMemo(() => {
    return clients.filter((c) => {
      const name = c.name || ""
      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === "all" ? true : c.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [clients, searchQuery, statusFilter])

  const activeCount = clients.filter((c) => c.status === "active").length
  const invitedCount = clients.filter((c) => c.status === "invited").length

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Status Filter Controls */}
      <ClientsSearchFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalCount={clients.length}
        activeCount={activeCount}
        invitedCount={invitedCount}
      />

      {/* Table Shell */}
      {clients.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-shadow">
          <div className="rounded-lg bg-white dark:bg-neutral-950">
            <WorkspaceClientEmptyState />
          </div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-shadow">
          <div className="rounded-lg bg-white dark:bg-neutral-950">
            <FilterClientEmptyState
              searchQuery={searchQuery}
              onClear={() => {
                setSearchQuery("")
                setStatusFilter("all")
              }}
            />
          </div>
        </div>
      ) : (
        <DataTableShell headers={TABLE_HEADERS}>
          {filteredClients.map((client) => (
            <ClientsTableRow key={client.id} client={client} />
          ))}
        </DataTableShell>
      )}
    </div>
  )
}
