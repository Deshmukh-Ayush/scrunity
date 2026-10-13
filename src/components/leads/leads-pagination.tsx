import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LEADS_PAGE_SIZE } from "./types"

/** "Showing x to y of n" with previous/next page controls. */
export function LeadsPagination({
  page,
  totalPages,
  total,
  disabled,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  disabled: boolean
  onPageChange: (page: number) => void
}) {
  const startRecord = total === 0 ? 0 : (page - 1) * LEADS_PAGE_SIZE + 1
  const endRecord = Math.min(page * LEADS_PAGE_SIZE, total)

  return (
    <nav
      aria-label="Leads pagination"
      className="flex flex-col items-center justify-between gap-3 pt-1 text-xs text-muted-foreground sm:flex-row"
    >
      <div>
        Showing{" "}
        <span className="font-medium text-foreground">{startRecord}</span> to{" "}
        <span className="font-medium text-foreground">{endRecord}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> leads
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || disabled}
          className="h-8 gap-1 px-2.5 text-xs"
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <span className="px-2 text-xs font-medium text-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || disabled}
          className="h-8 gap-1 px-2.5 text-xs"
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  )
}
