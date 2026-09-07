"use client"

import { UsersIcon, FunnelXIcon } from "@phosphor-icons/react"
import { motion, useReducedMotion } from "framer-motion"
import { CreateProjectDialog } from "@/components/create-project-dialog"

export function WorkspaceClientEmptyState() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <motion.div
        initial={reduceMotion ? { opacity: 1 } : { scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand mb-4"
      >
        <UsersIcon className="h-6 w-6" />
      </motion.div>
      <h3 className="text-base font-semibold text-foreground">No clients yet</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
        Clients join your workspace when you invite them to collaborate on projects and contracts.
      </p>
      <div className="mt-5">
        <CreateProjectDialog />
      </div>
    </div>
  )
}

interface FilterClientEmptyStateProps {
  searchQuery: string
  onClear: () => void
}

export function FilterClientEmptyState({ searchQuery, onClear }: FilterClientEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
        <FunnelXIcon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">No matching clients</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
        {searchQuery
          ? `No clients match "${searchQuery}". Try adjusting your keywords or clearing the filter.`
          : "No clients match the selected filter. Try switching back to all clients."}
      </p>
      <button
        onClick={onClear}
        className="mt-4 inline-flex items-center justify-center h-8 px-3.5 rounded-full border border-border/60 bg-background text-xs font-semibold text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-900 active:scale-[0.96] transition-[background-color,color,border-color,box-shadow,transform] duration-150 shadow-xs"
      >
        Clear filters
      </button>
    </div>
  )
}
