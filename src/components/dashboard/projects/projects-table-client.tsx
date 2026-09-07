"use client"

import * as React from "react"
import { ProjectTableItem } from "./projects-table-types"
import { ProjectsSearchFilters } from "./projects-search-filters"
import { WorkspaceEmptyState, FilterEmptyState } from "./projects-empty-state"
import { ProjectsTableRow } from "./projects-table-row"
import { DataTableShell } from "@/components/dashboard/shared/data-table-shell"

export type { ProjectTableItem }

interface ProjectsTableClientProps {
  projects: ProjectTableItem[]
  totalWorkspaceCount?: number
}

const TABLE_HEADERS = ["Project", "Status", "Contract Value", "Deliverables", "Team", "Updated", "Action"]

export function ProjectsTableClient({
  projects,
  totalWorkspaceCount = projects.length,
}: ProjectsTableClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredProjects = React.useMemo(() => {
    if (!searchQuery.trim()) return projects
    const q = searchQuery.toLowerCase()
    return projects.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(q)
      const descMatch = p.description ? p.description.toLowerCase().includes(q) : false
      return nameMatch || descMatch
    })
  }, [projects, searchQuery])

  return (
    <div className="flex flex-col gap-3.5">
      {/* Search & Status & Sort Command Toolbar */}
      {totalWorkspaceCount > 0 && (
        <ProjectsSearchFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}

      {/* Table Container */}
      {totalWorkspaceCount === 0 ? (
        <div className="rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-shadow">
          <div className="rounded-lg bg-white dark:bg-neutral-950">
            <WorkspaceEmptyState />
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-shadow">
          <div className="rounded-lg bg-white dark:bg-neutral-950">
            <FilterEmptyState
              searchQuery={searchQuery}
              onClear={() => setSearchQuery("")}
            />
          </div>
        </div>
      ) : (
        <DataTableShell headers={TABLE_HEADERS}>
          {filteredProjects.map((project) => (
            <ProjectsTableRow key={project.id} project={project} />
          ))}
        </DataTableShell>
      )}
    </div>
  )
}
