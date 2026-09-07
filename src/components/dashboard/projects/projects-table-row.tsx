"use client"

import Link from "next/link"
import { ArrowRightIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import { ProjectTableItem } from "./projects-table-types"
import { ProjectsStatusBadge } from "./projects-status-badge"
import { ProjectsProgressBar } from "./projects-progress-bar"
import { AvatarStack } from "@/components/dashboard/shared/avatar-stack"
import { formatCurrency } from "@/lib/currency"

interface ProjectsTableRowProps {
  project: ProjectTableItem
}

export function ProjectsTableRow({ project }: ProjectsTableRowProps) {
  return (
    <tr className="group transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40">
      {/* Project Info */}
      <td className="px-5 py-3.5">
        <div className="flex flex-col min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="font-semibold text-foreground hover:text-brand hover:underline truncate text-sm transition-colors"
          >
            {project.name}
          </Link>
          {project.description ? (
            <span className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
              {project.description}
            </span>
          ) : null}
        </div>
      </td>

      {/* Status Badge */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <ProjectsStatusBadge status={project.status} healthStatus={project.healthStatus} />
      </td>

      {/* Financial Value */}
      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground tabular-nums">
        {project.contractValue !== null && project.contractValue !== undefined ? formatCurrency(project.contractValue, project.currency || "USD") : "--"}
      </td>

      {/* Deliverables Progress */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <ProjectsProgressBar
          approved={project.deliverableStats.approved}
          total={project.deliverableStats.total}
        />
      </td>

      {/* Team Avatars */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <AvatarStack members={project.members} max={3} />
      </td>

      {/* Date Updated */}
      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {format(new Date(project.updatedAt), "MMM d, yyyy")}
      </td>

      {/* Action Link */}
      <td className="px-4 py-3.5 text-right whitespace-nowrap">
        <Link
          href={`/projects/${project.id}`}
          className="group/btn inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-hover transition-[color,transform] active:scale-[0.96] origin-center"
        >
          <span>Open project</span>
          <ArrowRightIcon className="h-3.5 w-3.5 transition-transform duration-150 group-hover/btn:translate-x-0.5" />
        </Link>
      </td>
    </tr>
  )
}
