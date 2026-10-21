"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import { DataTable, DataTableMessage, NumberCell, TextCell, type DataTableColumn } from "@/components/ui/data-table"
import { LocalDate } from "@/components/ui/local-date"
import { IMPORT_COPY as COPY } from "@/lib/contact-import/copy"
import type { PublicImport } from "@/lib/contact-import/types"
import { cn } from "@/lib/utils"
import { DeleteListDialog } from "./delete-list-dialog"

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }

/**
 * Imported lists on the Data sources page: name, date, counts, who uploaded
 * it, and Delete list (owners and admins). `onDelete` is injectable so the
 * testing route can show every state without a request.
 */
export function ImportedLists({
  initialImports,
  canManage,
  onDelete = deleteList,
}: {
  initialImports: PublicImport[]
  canManage: boolean
  onDelete?: (id: string) => Promise<boolean>
}) {
  const [imports, setImports] = React.useState(initialImports)
  const [confirming, setConfirming] = React.useState<PublicImport | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const confirm = async () => {
    if (!confirming) return
    setDeleting(true)
    const ok = await onDelete(confirming.id)
    setDeleting(false)
    if (!ok) return toast.error(COPY.deleteFailed)
    setImports((list) => list.filter((l) => l.id !== confirming.id))
    setConfirming(null)
    toast.success(COPY.deletedToast)
  }

  const columns: DataTableColumn<PublicImport>[] = [
    { id: "name", header: "List", type: "text", className: "min-w-40", cell: (l) => <TextCell value={l.fileName} className="font-medium text-fg-strong" />, sortValue: (l) => l.fileName },
    { id: "date", header: "Imported", type: "date", className: "w-32", cell: (l) => <LocalDate value={l.createdAt} options={DATE_OPTIONS} />, sortValue: (l) => l.createdAt },
    { id: "people", header: "People", type: "number", className: "w-24", cell: (l) => <NumberCell value={l.counts.imported} />, sortValue: (l) => l.counts.imported },
    { id: "rejected", header: "Not imported", type: "number", className: "w-28", cell: (l) => <NumberCell value={l.counts.duplicates + l.counts.invalid + l.counts.suppressed} /> },
    { id: "by", header: "Uploaded by", type: "text", className: "min-w-32", cell: (l) => <TextCell value={l.uploadedByName ?? "Former member"} muted /> },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Actions",
            type: "actions" as const,
            className: "w-28",
            cell: (l: PublicImport) => (
              <Button variant="ghost" size="sm" onClick={() => setConfirming(l)} aria-label={`${COPY.deleteAction}: ${l.fileName}`}>
                {COPY.deleteAction}
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <section aria-labelledby="imported-lists-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="imported-lists-title" className="text-section text-fg-strong">
            {COPY.listsTitle}
          </h2>
          <p className="text-body text-fg-muted">{COPY.listsDescription}</p>
        </div>
        {canManage && imports.length > 0 && (
          <Link href="/dashboard/settings/data-sources/import" className={cn(buttonVariants({ variant: "secondary" }))}>
            {COPY.listsImportAction}
          </Link>
        )}
      </div>
      <DataTable
        label={COPY.listsTitle}
        columns={columns}
        rows={imports}
        rowKey={(l) => l.id}
        defaultSort={{ columnId: "date", direction: "desc" }}
        empty={
          <DataTableMessage
            title="No lists yet"
            description={canManage ? COPY.listsEmpty : COPY.managerOnly}
            action={
              canManage ? (
                <Link href="/dashboard/settings/data-sources/import" className={cn(buttonVariants({ variant: "secondary" }))}>
                  {COPY.listsImportAction}
                </Link>
              ) : undefined
            }
          />
        }
      />
      <DeleteListDialog list={confirming} onOpenChange={(open) => !open && setConfirming(null)} onConfirm={confirm} submitting={deleting} />
    </section>
  )
}

async function deleteList(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/gtm/data-sources/imports/${encodeURIComponent(id)}`, { method: "DELETE" })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}
