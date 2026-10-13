import { notFound } from "next/navigation"
import { getTenantContext } from "@/lib/tenant-context"
import { getCampaignDetail, listCampaignDrafts } from "@/lib/data/campaigns"
import { getConnectedMailbox } from "@/lib/data/mailbox"
import { getCachedInngestConnectivity } from "@/lib/inngest-connectivity"
import { asJson } from "@/lib/data/serialize"
import { CampaignDetailRoot } from "./campaign-detail-root"
import { CampaignDetailHeader } from "./campaign-detail-header"
import { PipelineStatusBanner } from "./pipeline-status-banner"
import { MailboxStatusBar } from "./mailbox-status-bar"
import { StageStepper } from "./stage-stepper"
import { DraftReviewSection } from "./draft-review-section"
import { ProspectsPanel } from "./prospects-panel"
import { CampaignSegmentDigest } from "./campaign-segment-digest"
import type { CampaignData, Draft, MailboxInfo } from "./types"

/**
 * Server-fetches one campaign and composes the detail view from its parts.
 * Unknown or other-org campaigns render the root not-found page.
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
      className="mx-auto max-w-5xl space-y-8"
    >
      <CampaignDetailHeader />
      <PipelineStatusBanner />
      <MailboxStatusBar />
      <StageStepper />
      <DraftReviewSection />
      <ProspectsPanel />
      <CampaignSegmentDigest />
    </CampaignDetailRoot>
  )
}
