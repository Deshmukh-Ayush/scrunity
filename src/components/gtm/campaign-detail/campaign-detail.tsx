import { notFound } from "next/navigation"
import { getTenantContext } from "@/lib/tenant-context"
import { getCampaignDetail, listCampaignDrafts } from "@/lib/data/campaigns"
import { getConnectedMailbox } from "@/lib/data/mailbox"
import { getCachedInngestConnectivity } from "@/lib/inngest-connectivity"
import { asJson } from "@/lib/data/serialize"
import { CampaignDetailRoot } from "./campaign-detail-root"
import { CampaignDetailHeader } from "./campaign-detail-header"
import { CampaignProcessCard } from "./campaign-process-card"
import { MailboxStatusBar } from "./mailbox-status-bar"
import { StageDetail } from "./stage-detail"
import type { CampaignData, Draft, MailboxInfo } from "./types"

/**
 * Server-fetches one campaign and composes the detail view from its parts:
 * header, mailbox line, the process card (five stages), then the picked
 * stage's detail. Unknown or other-org campaigns render the root not-found page.
 *
 * Parked, as on the Campaigns page: the segment performance digest
 * (CampaignSegmentDigest -> SegmentDigestCard, with Recompute digest) used to
 * render last here. Its component (./campaign-segment-digest.tsx), routes and
 * cron are unchanged; to bring it back, render <CampaignSegmentDigest /> after
 * <StageDetail />.
 */
export async function CampaignDetail({ campaignId }: { campaignId: string }) {
  const { organizationId } = await getTenantContext()
  if (!organizationId) notFound()

  // All four reads are independent. Drafts are keyed by campaign id only, so they
  // are discarded below unless getCampaignDetail confirms the org owns the campaign.
  const [detail, drafts, mailbox, inngestConnectivity] = await Promise.all([
    getCampaignDetail(campaignId, organizationId),
    listCampaignDrafts(campaignId),
    getConnectedMailbox(organizationId),
    getCachedInngestConnectivity(),
  ])
  if (!detail) notFound()

  return (
    <CampaignDetailRoot
      campaignId={campaignId}
      initialData={asJson<CampaignData>({ ...detail, inngestConnectivity })}
      initialDrafts={asJson<Draft[]>(drafts)}
      initialMailbox={asJson<MailboxInfo | null>(mailbox)}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-3">
        <CampaignDetailHeader />
        <MailboxStatusBar />
      </div>
      <CampaignProcessCard />
      <StageDetail />
    </CampaignDetailRoot>
  )
}
