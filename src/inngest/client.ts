import { Inngest, realtime } from "inngest";
import { z } from "zod";

export type GtmEvents = {
  "gtm/research.requested": {
    data: {
      researchRunId: string;
    };
  };
  "gtm/campaign.find_companies": {
    data: {
      outreachCampaignId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "gtm-agent",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

export const stageStartedPayload = z.object({
  stage: z.string(),
  message: z.string().optional(),
});

export const stageCompletedPayload = z.object({
  stage: z.string(),
  summary: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const stageFailedPayload = z.object({
  stage: z.string(),
  error: z.string(),
});

export const researchRunChannel = realtime.channel({
  name: (researchRunId: string) => `gtm:run:${researchRunId}`,
  topics: {
    started: {
      schema: stageStartedPayload,
    },
    completed: {
      schema: stageCompletedPayload,
    },
    failed: {
      schema: stageFailedPayload,
    },
  },
});

export const outreachCampaignChannel = realtime.channel({
  name: (campaignId: string) => `gtm:campaign:${campaignId}`,
  topics: {
    started: {
      schema: stageStartedPayload,
    },
    completed: {
      schema: stageCompletedPayload,
    },
    failed: {
      schema: stageFailedPayload,
    },
  },
});
