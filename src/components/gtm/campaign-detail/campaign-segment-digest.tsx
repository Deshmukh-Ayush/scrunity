"use client"

import { SegmentDigestCard } from "../segment-digest-card"
import { useCampaignDetail } from "./campaign-detail-root"

/** Segment performance digest for the campaign's ICP segment. */
export function CampaignSegmentDigest() {
  const { data } = useCampaignDetail()
  return (
    <div className="space-y-3 border-t pt-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Segment Intelligence & Performance Digest
        </h3>
        <p className="text-xs text-muted-foreground">
          Aggregated conversion metrics, ICP resonance analysis, and autonomous
          campaign learning notes.
        </p>
      </div>
      <SegmentDigestCard
        segmentId={data.segment.id}
        segmentName={data.segment.name}
      />
    </div>
  )
}
