import { inngest, type GtmEvents } from "../client";
import { generateDigestsForAllActiveSegments } from "@/lib/gtm-digest";
import { type InngestStep } from "./shared";

export const DEFAULT_DIGEST_CRON = process.env.GTM_DIGEST_CRON || "0 6 * * *"; // Daily at 6:00 AM UTC

export interface GenerateDigestResult {
  totalSegmentsProcessed: number;
  results: Array<{
    segmentId: string;
    organizationId: string;
    digestId: string;
    sentCount: number;
    bookingRate: number;
    isSmallSample: boolean;
  }>;
}

/**
 * Step 2: Scheduled Inngest function that computes performance metrics
 * and generates AI executive summaries per ICP segment for active organizations.
 */
export async function executeGenerateDigest(
  filter?: { organizationId?: string; segmentId?: string },
  step?: InngestStep
): Promise<GenerateDigestResult> {
  return await generateDigestsForAllActiveSegments({
    organizationIdFilter: filter?.organizationId,
    segmentIdFilter: filter?.segmentId,
  });
}

export const generateDigestFunction = inngest.createFunction(
  {
    id: "gtm-generate-segment-digest",
    name: "GTM: Generate Periodic Segment Performance Digests",
    triggers: [
      { cron: DEFAULT_DIGEST_CRON },
      { event: "gtm/digest.generate" },
    ],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/digest.generate"] | { data: {} };
    step: InngestStep;
  }) => {
    const data = (event as any)?.data;
    const organizationId = data?.organizationId;
    const segmentId = data?.segmentId;

    return await step.run("generate-active-segment-digests", async () => {
      return await executeGenerateDigest(
        { organizationId, segmentId },
        step
      );
    });
  }
);
