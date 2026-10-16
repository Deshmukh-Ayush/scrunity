"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowDown, ArrowUp, ArrowUpDown } from "@/components/ui/icons"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type {
  DataTableColumn,
  DataTableColumnType,
  DataTableSort,
  SortValue,
} from "./types"

/**
 * Dense, typed table on a white surface (shadow-surface, radius 10). Only
 * single-side hairlines inside: under the header and under each row.
 *
 * - Semantic <table> with an aria-label; <th scope="col">; sortable headers
 *   are real buttons and the sorted <th> carries aria-sort.
 * - Rows: 36px (compact 32px), 12px cell padding, text-body cells, text-meta
 *   muted headers. Hover tints the row. No onClick on <tr>.
 * - Row link: the entity cell holds the one real, focusable link (keyboard,
 *   screen readers). With `rowHref`, every other non-action cell also gets a
 *   mouse-only overlay link to the same place (tabIndex -1, aria-hidden), so
 *   the whole row is clickable and middle-click opens a tab. Per-cell overlays
 *   instead of one ::after stretched over the <tr>: WebKit ignores
 *   position: relative on table rows, which sent clicks to the wrong row.
 *   Actions cells get no overlay; their controls stay separate.
 * - The table scrolls inside a focusable region (role="region"). The header
 *   sticks when the region has a max height. Below 768px the first column
 *   sticks while the rest scrolls.
 * - States: loading (skeleton rows), empty and error (one centered message
 *   with its own action), passed as nodes.
 * - More than `pageSize` rows: a simple Previous / Next pager.
 */

const ALIGN_END: DataTableColumnType[] = ["number", "actions"]

const DENSITY = {
  default: "h-9",
  compact: "h-8",
} as const

function compareValues(a: SortValue, b: SortValue) {
  const aMissing = a === null || a === undefined || a === ""
  const bMissing = b === null || b === undefined || b === ""
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

export interface DataTableProps<T> {
  /** Accessible name for the table and its scroll region. */
  label: string
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Where a row goes; adds the mouse-only overlay link to each cell. */
  rowHref?: (row: T) => string
  defaultSort?: DataTableSort
  density?: keyof typeof DENSITY
  pageSize?: number
  loading?: boolean
  /** Shown instead of rows when there are none (and nothing is loading). */
  empty?: React.ReactNode
  /** Shown instead of rows when loading failed. */
  error?: React.ReactNode
  /** Extra classes for the scroll region, e.g. a max height for a sticky header. */
  regionClassName?: string
}

export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  rowHref,
  defaultSort,
  density = "default",
  pageSize = 25,
  loading = false,
  empty,
  error,
  regionClassName,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<DataTableSort | undefined>(defaultSort)
  // The page belongs to one sort and row count: changing either (a new sort, a
  // filter) starts from page 1. Polling that returns the same rows keeps it.
  const pageKey = `${sort?.columnId}:${sort?.direction}:${rows.length}`
  const [pageState, setPageState] = React.useState({ key: pageKey, page: 0 })
  const page = pageState.key === pageKey ? pageState.page : 0
  const setPage = (next: number) => setPageState({ key: pageKey, page: next })

  const sorted = React.useMemo(() => {
    const column = sort && columns.find((c) => c.id === sort.columnId)
    if (!sort || !column?.sortValue) return rows
    const getValue = column.sortValue
    const factor = sort.direction === "asc" ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = getValue(a)
      const vb = getValue(b)
      // Missing values stay last in both directions.
      if (
        va === null ||
        va === undefined ||
        va === "" ||
        vb === null ||
        vb === undefined ||
        vb === ""
      )
        return compareValues(va, vb)
      return compareValues(va, vb) * factor
    })
  }, [rows, columns, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visible =
    sorted.length > pageSize
      ? sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
      : sorted

  const toggleSort = (columnId: string) =>
    setSort((current) =>
      current?.columnId === columnId
        ? { columnId, direction: current.direction === "asc" ? "desc" : "asc" }
        : { columnId, direction: "asc" }
    )

  const rowHeight = DENSITY[density]
  const message = error ?? (!loading && rows.length === 0 ? empty : null)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-transparent bg-surface shadow-surface transition-[box-shadow,border-color] duration-(--motion-fast) ease-out has-[>[role=region]:focus-visible]:focus-ring motion-reduce:transition-none">
        {message ? (
          // Empty and error: one centered block in the surface, never inside the
          // scrolling table, so it stays readable however wide the columns are.
          <div className="px-4 py-12">{message}</div>
        ) : (
          <div
            role="region"
            aria-label={label}
            tabIndex={0}
            className={cn(
              // The surface draws the ring (its overflow-hidden would clip one drawn here).
              "overflow-auto rounded-lg outline-none",
              "transition-[box-shadow] duration-(--motion-fast) ease-out motion-reduce:transition-none",
              regionClassName
            )}
          >
            <table
              aria-label={label}
              className="w-full border-separate border-spacing-0 text-body"
            >
              <thead>
                <tr>
                  {columns.map((column, index) => (
                    <HeaderCell
                      key={column.id}
                      column={column}
                      first={index === 0}
                      sort={sort}
                      rowHeight={rowHeight}
                      onSort={toggleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows columns={columns} rowHeight={rowHeight} />
                ) : (
                  visible.map((row) => (
                    <tr key={rowKey(row)} className="group/row">
                      {columns.map((column, index) => {
                        const href =
                          rowHref && column.type !== "actions"
                            ? rowHref(row)
                            : null
                        return (
                          <td
                            key={column.id}
                            className={cn(
                              rowHeight,
                              "border-b border-border bg-surface px-3 whitespace-nowrap text-fg-default group-last/row:border-b-0",
                              "transition-[background-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
                              "group-hover/row:bg-canvas group-has-[a[data-row-link]:focus-visible]/row:bg-canvas",
                              ALIGN_END.includes(column.type) && "text-right",
                              href && "relative",
                              index === 0 &&
                                "max-md:sticky max-md:left-0 max-md:z-10",
                              column.className
                            )}
                          >
                            {href && (
                              // Mouse-only twin of the entity cell's link; see the comment above.
                              <Link
                                href={href}
                                tabIndex={-1}
                                aria-hidden="true"
                                className="absolute inset-0"
                              />
                            )}
                            {column.cell(row)}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!message && !loading && sorted.length > pageSize && (
        <Pager
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={sorted.length}
          onPage={setPage}
        />
      )}
    </div>
  )
}

function HeaderCell<T>({
  column,
  first,
  sort,
  rowHeight,
  onSort,
}: {
  column: DataTableColumn<T>
  first: boolean
  sort?: DataTableSort
  rowHeight: string
  onSort: (columnId: string) => void
}) {
  const sorted = sort?.columnId === column.id ? sort.direction : undefined
  const alignEnd = ALIGN_END.includes(column.type)
  const SortIcon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown

  return (
    <th
      scope="col"
      aria-sort={
        sorted === "asc"
          ? "ascending"
          : sorted === "desc"
            ? "descending"
            : undefined
      }
      className={cn(
        rowHeight,
        "sticky top-0 z-20 border-b border-border bg-surface px-3 text-meta whitespace-nowrap text-fg-muted",
        alignEnd ? "text-right" : "text-left",
        first && "max-md:left-0 max-md:z-30",
        column.className
      )}
    >
      {column.type === "actions" ? (
        <span className="sr-only">{column.header}</span>
      ) : column.sortValue ? (
        <button
          type="button"
          onClick={() => onSort(column.id)}
          className={cn(
            "-mx-1 inline-flex h-6 items-center gap-1 rounded-sm border border-transparent px-1 text-meta outline-none",
            "transition-[color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
            "ui-hover:text-fg-strong ui-focus:focus-ring",
            sorted && "text-fg-strong",
            alignEnd && "flex-row-reverse"
          )}
        >
          {column.header}
          <SortIcon
            aria-hidden="true"
            className={cn("size-3.5", !sorted && "text-fg-subtle")}
          />
        </button>
      ) : (
        column.header
      )}
    </th>
  )
}

function SkeletonRows<T>({
  columns,
  rowHeight,
}: {
  columns: DataTableColumn<T>[]
  rowHeight: string
}) {
  return (
    <>
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <tr key={rowIndex} aria-hidden="true">
          {columns.map((column) => (
            <td
              key={column.id}
              className={cn(
                rowHeight,
                "border-b border-border px-3",
                column.className
              )}
            >
              <Skeleton
                className={cn(
                  "h-3.5",
                  column.type === "number"
                    ? "ms-auto w-8"
                    : column.type === "status"
                      ? "w-16"
                      : "w-24"
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function Pager({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}) {
  const first = page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2">
      <p
        className="me-1 text-meta text-fg-muted tabular-nums"
        aria-live="polite"
      >
        {first}–{last} of {total}
      </p>
      <Button size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Button
        size="sm"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  )
}

/** Centered message for the empty and error states: a title, one line and one action. */
export function DataTableMessage({
  title,
  description,
  action,
  role,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  role?: "alert"
}) {
  // The design-system empty state, compact: the surface already gives it room.
  return (
    <EmptyState
      size="sm"
      role={role}
      title={title}
      description={description}
      actions={action}
      className="py-0"
    />
  )
}
