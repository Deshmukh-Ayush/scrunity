import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import {
  ActionsCell,
  DateCell,
  EntityCell,
  NumberCell,
  StatusCell,
  TextCell,
  type DataTableColumn,
} from "@/components/ui/data-table"
import { cn } from "@/lib/utils"
import {
  campaignStageLabel,
  isAwaitingApproval,
  type CampaignBucket,
  type PipelineStatus,
} from "../pipeline-status"
import type { CampaignRow } from "./types"

/** A campaign row plus its status, computed once per render (stalled needs the clock). */
export interface CampaignTableRow extends CampaignRow {
  status: PipelineStatus<CampaignBucket>
  name: string
  lastActivity: string
}

const time = (value: string | null | undefined) =>
  value ? new Date(value).getTime() : null

export const campaignColumns: DataTableColumn<CampaignTableRow>[] = [
  {
    id: "campaign",
    header: "Campaign",
    type: "entity",
    cell: (row) => (
      <EntityCell
        name={row.name}
        href={`/dashboard/campaigns/${row.campaign.id}`}
      />
    ),
    sortValue: (row) => row.name,
  },
  {
    id: "status",
    header: "Status",
    type: "status",
    cell: (row) => (
      <StatusCell
        label={row.status.label}
        tone={row.status.tone}
        icon={row.status.icon}
      />
    ),
    sortValue: (row) => row.status.label,
  },
  {
    id: "stage",
    header: "Stage",
    type: "text",
    cell: (row) => <TextCell value={campaignStageLabel(row.campaign)} />,
    sortValue: (row) => campaignStageLabel(row.campaign),
  },
  {
    id: "verified",
    header: "Verified leads",
    type: "number",
    cell: (row) => {
      const outcome = row.campaign.leadSearchOutcome
      return outcome ? (
        <NumberCell value={outcome.verified} of={outcome.target} />
      ) : (
        <NumberCell value={null} />
      )
    },
    sortValue: (row) => row.campaign.leadSearchOutcome?.verified ?? null,
  },
  {
    id: "drafts",
    header: "Drafts",
    type: "number",
    cell: (row) => <NumberCell value={row.stats.drafts} />,
    sortValue: (row) => row.stats.drafts,
  },
  {
    id: "sent",
    header: "Sent",
    type: "number",
    cell: (row) => <NumberCell value={row.stats.sent} />,
    sortValue: (row) => row.stats.sent,
  },
  {
    id: "replies",
    header: "Replies",
    type: "number",
    cell: (row) => <NumberCell value={row.stats.replies} />,
    sortValue: (row) => row.stats.replies,
  },
  {
    id: "activity",
    header: "Last activity",
    type: "date",
    cell: (row) => <DateCell value={row.lastActivity} mode="relative" />,
    sortValue: (row) => time(row.lastActivity),
  },
  {
    id: "created",
    header: "Created",
    type: "date",
    cell: (row) => <DateCell value={row.campaign.createdAt} />,
    sortValue: (row) => time(row.campaign.createdAt),
  },
  {
    id: "action",
    header: "Action",
    type: "actions",
    cell: (row) => {
      // Founder decision: "Review drafts" is the one brand action, even in rows.
      const review = isAwaitingApproval(row.campaign)
      return (
        <ActionsCell>
          <Link
            href={`/dashboard/campaigns/${row.campaign.id}`}
            className={cn(
              buttonVariants({
                size: "sm",
                variant: review ? "brand" : "secondary",
              })
            )}
          >
            {review ? "Review drafts" : "View pipeline"}
          </Link>
        </ActionsCell>
      )
    },
  },
]
