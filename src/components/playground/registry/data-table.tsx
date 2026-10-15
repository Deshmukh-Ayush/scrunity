import { DataTableShowcase } from "./data-table-demos"
import type { ShowcaseEntry } from "./types"

export const dataTableEntry: ShowcaseEntry = {
  id: "data-table",
  name: "Data table",
  group: "Display",
  description:
    "Dense typed table on a white surface (shadow-surface, radius 10), hairlines only under the header and rows. 36px rows (compact 32px), 12px cell padding, 14/20 cells, 12/16 muted headers. Column types: text, entity, status, date, number, actions. Sortable headers are buttons with aria-sort; the name cell's link covers the row; actions stay separate. States: default, compact, loading, empty, error, long text, many columns, paged.",
  render: () => <DataTableShowcase />,
}
