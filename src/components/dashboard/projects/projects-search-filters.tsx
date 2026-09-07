"use client"

import * as React from "react"
import { DashboardFilterToolbar } from "@/components/dashboard/shared/dashboard-filter-toolbar"

interface ProjectsSearchFiltersProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
}

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Action needed", value: "action" },
  { label: "On track", value: "on_track" },
  { label: "Completed", value: "completed" },
]

const sortOptions = [
  { label: "Recently updated", value: "updated" },
  { label: "Contract value", value: "value" },
  { label: "Deliverables count", value: "deliverables" },
]

export function ProjectsSearchFilters({
  searchQuery,
  setSearchQuery,
}: ProjectsSearchFiltersProps) {
  return (
    <DashboardFilterToolbar
      searchConfig={{
        value: searchQuery,
        onChange: setSearchQuery,
        placeholder: "Search projects...",
        ariaLabel: "Search projects by name or description",
      }}
      statusConfig={{
        key: "status",
        defaultValue: "all",
        options: statusOptions,
      }}
      sortConfig={{
        key: "sort",
        defaultValue: "updated",
        options: sortOptions,
      }}
    />
  )
}
