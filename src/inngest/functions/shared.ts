import { inngest } from "../client";
import type { GetStepTools } from "inngest";

export type InngestStep = GetStepTools<typeof inngest>;
export type RealtimePublishArgs = Parameters<typeof inngest.realtime.publish>;

// Helper to safely publish realtime events (gracefully ignores errors in local dev without Inngest Cloud)
export async function safeRealtimePublish(
  topicRef: RealtimePublishArgs[0],
  data: RealtimePublishArgs[1]
): Promise<void> {
  try {
    if (process.env.INNGEST_SIGNING_KEY) {
      await inngest.realtime.publish(topicRef, data);
    }
  } catch (err) {
    console.warn("[Inngest Realtime Publish Notice]:", (err as Error).message);
  }
}
