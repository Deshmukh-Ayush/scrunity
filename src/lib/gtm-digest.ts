import { db } from "@/utils/db";
import {
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmMeeting,
  gtmSegmentDigest,
  type SegmentDigestMetrics,
} from "@/db/schema";
import { eq, and, inArray, gte, lte, desc } from "drizzle-orm";
import {
  generateSegmentDigestSummary,
  type SegmentDigestSummaryResult,
} from "@/lib/gtm-ai";

export const SMALL_SAMPLE_THRESHOLD = 20;

export interface ComputedSegmentMetricsResult {
  segmentId: string;
  segmentName: string;
  painPoint: string;
  companyName: string;
  organizationId: string;
  campaignIds: string[];
  periodStart: Date;
  periodEnd: Date;
  metrics: SegmentDigestMetrics;
}

/**
 * Step 1: Computes raw and derived performance metrics for an ICP segment over a time window.
 * Default window begins when the segment's first campaign was created.
 */
export async function computeSegmentMetrics({
  segmentId,
  periodStart,
  periodEnd,
}: {
  segmentId: string;
  periodStart?: Date;
  periodEnd?: Date;
}): Promise<ComputedSegmentMetricsResult> {
  // 1. Fetch segment and associated research run
  const [segmentData] = await db
    .select({
      segment: gtmIcpSegment,
      researchRun: gtmResearchRun,
    })
    .from(gtmIcpSegment)
    .innerJoin(
      gtmResearchRun,
      eq(gtmIcpSegment.researchRunId, gtmResearchRun.id)
    )
    .where(eq(gtmIcpSegment.id, segmentId));

  if (!segmentData) {
    throw new Error(`ICP Segment ${segmentId} not found`);
  }

  const { segment, researchRun } = segmentData;

  // 2. Fetch all outreach campaigns for this segment
  const campaigns = await db
    .select()
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.icpSegmentId, segmentId));

  const campaignIds = campaigns.map((c) => c.id);

  // 3. Resolve evaluation time window
  const resolvedEnd = periodEnd || new Date();
  let resolvedStart = periodStart;

  if (!resolvedStart) {
    if (campaigns.length > 0) {
      // Find earliest campaign createdAt
      const campaignDates = campaigns
        .map((c) => new Date(c.createdAt).getTime())
        .filter((t) => !isNaN(t));
      if (campaignDates.length > 0) {
        resolvedStart = new Date(Math.min(...campaignDates));
      }
    }

    if (!resolvedStart) {
      resolvedStart = new Date(segment.createdAt);
    }
  }

  // If no campaigns exist for this segment yet, return zeroed metrics with small-sample flag
  if (campaignIds.length === 0) {
    const zeroMetrics: SegmentDigestMetrics = {
      sentCount: 0,
      openedCount: 0,
      repliedCount: 0,
      bouncedCount: 0,
      replyBreakdown: {
        interested: 0,
        notInterested: 0,
        question: 0,
        autoReply: 0,
        unclear: 0,
      },
      meetingsBookedCount: 0,
      replyRate: 0,
      interestedReplyRate: 0,
      bookingRate: 0,
      isSmallSample: true,
      sampleSizeWarning:
        "No outreach campaigns have been launched for this segment yet.",
    };

    return {
      segmentId,
      segmentName: segment.name,
      painPoint: segment.painPoint,
      companyName: researchRun.companyName,
      organizationId: researchRun.organizationId,
      campaignIds: [],
      periodStart: resolvedStart,
      periodEnd: resolvedEnd,
      metrics: zeroMetrics,
    };
  }

  // 4. Fetch all drafts belonging to these campaigns
  const drafts = await db
    .select({
      id: gtmEmailDraft.id,
      status: gtmEmailDraft.status,
      sentAt: gtmEmailDraft.sentAt,
      campaignId: gtmEmailDraft.outreachCampaignId,
    })
    .from(gtmEmailDraft)
    .where(inArray(gtmEmailDraft.outreachCampaignId, campaignIds));

  // Count sent drafts within the period window
  const sentDrafts = drafts.filter((d) => {
    if (d.status !== "sent") return false;
    if (d.sentAt) {
      const sentTime = new Date(d.sentAt).getTime();
      return (
        sentTime >= resolvedStart!.getTime() && sentTime <= resolvedEnd.getTime()
      );
    }
    return true;
  });

  const sentDraftIds = sentDrafts.map((d) => d.id);
  const allDraftIds = drafts.map((d) => d.id);
  const sentCount = sentDrafts.length;

  // 5. Query email events for drafts belonging to this segment
  let openedCount = 0;
  let repliedCount = 0;
  let bouncedCount = 0;
  const replyBreakdown = {
    interested: 0,
    notInterested: 0,
    question: 0,
    autoReply: 0,
    unclear: 0,
  };

  if (allDraftIds.length > 0) {
    const events = await db
      .select()
      .from(gtmEmailEvent)
      .where(
        and(
          inArray(gtmEmailEvent.emailDraftId, allDraftIds),
          gte(gtmEmailEvent.occurredAt, resolvedStart),
          lte(gtmEmailEvent.occurredAt, resolvedEnd)
        )
      );

    for (const ev of events) {
      if (ev.type === "opened") {
        openedCount++;
      } else if (ev.type === "bounced") {
        bouncedCount++;
      } else if (ev.type === "replied") {
        repliedCount++;
        switch (ev.classifiedIntent) {
          case "interested":
            replyBreakdown.interested++;
            break;
          case "not_interested":
            replyBreakdown.notInterested++;
            break;
          case "question":
            replyBreakdown.question++;
            break;
          case "auto_reply":
            replyBreakdown.autoReply++;
            break;
          default:
            replyBreakdown.unclear++;
            break;
        }
      }
    }
  }

  // 6. Query booked meetings tied to this segment's campaigns
  const meetings = await db
    .select()
    .from(gtmMeeting)
    .where(
      and(
        inArray(gtmMeeting.outreachCampaignId, campaignIds),
        eq(gtmMeeting.status, "booked"),
        gte(gtmMeeting.createdAt, resolvedStart),
        lte(gtmMeeting.createdAt, resolvedEnd)
      )
    );

  const meetingsBookedCount = meetings.length;

  // 7. Calculate plain rates (as percentage of sent count, 0 if sentCount === 0)
  const replyRate =
    sentCount > 0 ? Number(((repliedCount / sentCount) * 100).toFixed(1)) : 0;
  const interestedReplyRate =
    sentCount > 0
      ? Number(((replyBreakdown.interested / sentCount) * 100).toFixed(1))
      : 0;
  const bookingRate =
    sentCount > 0
      ? Number(((meetingsBookedCount / sentCount) * 100).toFixed(1))
      : 0;

  // 8. Statistical sample size threshold check
  const isSmallSample = sentCount < SMALL_SAMPLE_THRESHOLD;
  const sampleSizeWarning = isSmallSample
    ? `Sample size is under ${SMALL_SAMPLE_THRESHOLD} emails (${sentCount} sent). Conversion rates are early directional signals and not statistically significant.`
    : null;

  const metrics: SegmentDigestMetrics = {
    sentCount,
    openedCount,
    repliedCount,
    bouncedCount,
    replyBreakdown,
    meetingsBookedCount,
    replyRate,
    interestedReplyRate,
    bookingRate,
    isSmallSample,
    sampleSizeWarning,
  };

  return {
    segmentId,
    segmentName: segment.name,
    painPoint: segment.painPoint,
    companyName: researchRun.companyName,
    organizationId: researchRun.organizationId,
    campaignIds,
    periodStart: resolvedStart,
    periodEnd: resolvedEnd,
    metrics,
  };
}

/**
 * Step 2: Generates an AI-synthesized performance digest for a segment and records it in `gtm_segment_digest`.
 */
export async function generateSegmentDigest({
  segmentId,
  periodStart,
  periodEnd,
}: {
  segmentId: string;
  periodStart?: Date;
  periodEnd?: Date;
}) {
  const computed = await computeSegmentMetrics({
    segmentId,
    periodStart,
    periodEnd,
  });

  // Synthesize executive digest summary via LLM
  const summaryResult: SegmentDigestSummaryResult =
    await generateSegmentDigestSummary({
      segmentName: computed.segmentName,
      painPoint: computed.painPoint,
      companyName: computed.companyName,
      metrics: computed.metrics,
      periodStart: computed.periodStart,
      periodEnd: computed.periodEnd,
    });

  // Assemble full readable report summary for storage
  const formattedSummary = summaryResult.narrativeText;

  // Persist into gtm_segment_digest
  const [digest] = await db
    .insert(gtmSegmentDigest)
    .values({
      organizationId: computed.organizationId,
      icpSegmentId: segmentId,
      periodStart: computed.periodStart,
      periodEnd: computed.periodEnd,
      metrics: computed.metrics,
      summary: formattedSummary,
      generatedAt: new Date(),
    })
    .returning();

  return {
    digest,
    structuredSummary: summaryResult,
    computed,
  };
}

/**
 * Returns the latest stored digest for a given segment.
 */
export async function getLatestSegmentDigest(segmentId: string) {
  const [latest] = await db
    .select()
    .from(gtmSegmentDigest)
    .where(eq(gtmSegmentDigest.icpSegmentId, segmentId))
    .orderBy(desc(gtmSegmentDigest.generatedAt))
    .limit(1);

  return latest || null;
}

/**
 * Generates digests for all segments with campaigns across active organizations.
 */
export async function generateDigestsForAllActiveSegments({
  organizationIdFilter,
  segmentIdFilter,
}: {
  organizationIdFilter?: string;
  segmentIdFilter?: string;
} = {}) {
  // Query distinct segments that have at least one outreach campaign
  const query = db
    .selectDistinct({
      segmentId: gtmOutreachCampaign.icpSegmentId,
      organizationId: gtmResearchRun.organizationId,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    );

  const activeSegmentRows = await query;

  const filtered = activeSegmentRows.filter((row) => {
    if (organizationIdFilter && row.organizationId !== organizationIdFilter) {
      return false;
    }
    if (segmentIdFilter && row.segmentId !== segmentIdFilter) {
      return false;
    }
    return true;
  });

  const results: Array<{
    segmentId: string;
    organizationId: string;
    digestId: string;
    sentCount: number;
    bookingRate: number;
    isSmallSample: boolean;
  }> = [];

  for (const item of filtered) {
    try {
      const generated = await generateSegmentDigest({
        segmentId: item.segmentId,
      });
      results.push({
        segmentId: item.segmentId,
        organizationId: item.organizationId,
        digestId: generated.digest.id,
        sentCount: generated.computed.metrics.sentCount,
        bookingRate: generated.computed.metrics.bookingRate,
        isSmallSample: generated.computed.metrics.isSmallSample,
      });
    } catch (err) {
      console.error(
        `[Generate Digests] Failed to generate digest for segment ${item.segmentId}:`,
        err
      );
    }
  }

  return {
    totalSegmentsProcessed: results.length,
    results,
  };
}
