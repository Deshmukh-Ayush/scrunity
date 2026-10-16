import type { ReactNode } from "react"

/**
 * Column types decide alignment and default width behavior:
 * - text: truncates with an ellipsis; the full value is in `title`
 * - entity: 16px logo or letter tile + name; carries the row's primary link
 * - status: a semantic badge
 * - date: a <time>, relative or absolute
 * - number: right-aligned, tabular figures
 * - actions: right-aligned button or link, a separate focusable control
 */
export type DataTableColumnType =
  | "text"
  | "entity"
  | "status"
  | "date"
  | "number"
  | "actions"

export type SortDirection = "asc" | "desc"
export type SortValue = string | number | null | undefined

export interface DataTableColumn<T> {
  id: string
  /** Header text, sentence case. Actions columns keep it for screen readers only. */
  header: string
  type: DataTableColumnType
  cell: (row: T) => ReactNode
  /** Makes the column sortable; nulls always sort last. */
  sortValue?: (row: T) => SortValue
  /** Tailwind width class for the column, e.g. "w-40" or "min-w-56". */
  className?: string
}

export interface DataTableSort {
  columnId: string
  direction: SortDirection
}
