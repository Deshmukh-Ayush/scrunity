import { Inngest, realtime } from "inngest";
import { z } from "zod";

export type GtmEvents = {
  "gtm/research.requested": {
    data: {
      researchRunId: string;
    };
  };
  "gtm/research.explore_competitors": {
    data: {
      researchRunId: string;
    };
  };
  "gtm/research.define_segments": {
    data: {
      researchRunId: string;
    };
  };
  "gtm/campaign.find_companies": {
    data: {
      outreachCampaignId: string;
    };
  };
  "gtm/campaign.find_contacts": {
    data: {
      outreachCampaignId: string;
    };
  };
  "gtm/campaign.qualify_contacts": {
    data: {
      outreachCampaignId: string;
    };
  };
  "gtm/campaign.write_emails": {
    data: {
      outreachCampaignId: string;
    };
  };
  "gtm/campaign.send_emails": {
    data: {
      outreachCampaignId: string;
    };
  };
  "gtm/mailbox.poll_replies": {
    data?: {
      mailboxId?: string;
    };
  };
  "gtm/digest.generate": {
    data?: {
      organizationId?: string;
      segmentId?: string;
    };
  };
};

const isCloudDeployment =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.RAILWAY_ENVIRONMENT) ||
  Boolean(process.env.RENDER) ||
  Boolean(process.env.FLY_APP_NAME) ||
  Boolean(process.env.AWS_EXECUTION_ENV) ||
  (Boolean(process.env.BASE_URL) &&
    !process.env.BASE_URL?.includes("localhost") &&
    !process.env.BASE_URL?.includes("127.0.0.1") &&
    !process.env.BASE_URL?.includes("192.168."));

export const isDev =
  process.env.INNGEST_DEV === "true" ||
  Boolean(process.env.INNGEST_BASE_URL) ||
  !isCloudDeployment;

export const inngest = new Inngest({
  id: "gtm-agent",
  baseUrl: process.env.INNGEST_BASE_URL || (isDev ? "http://127.0.0.1:8288" : undefined),
  eventKey: isDev ? undefined : process.env.INNGEST_EVENT_KEY,
  signingKey: isDev ? undefined : process.env.INNGEST_SIGNING_KEY,
  isDev,
});

export const stageStartedPayload = z.object({
  stage: z.string(),
  message: z.string().optional(),
});

export const stageCompletedPayload = z.object({
  stage: z.string(),
  summary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
