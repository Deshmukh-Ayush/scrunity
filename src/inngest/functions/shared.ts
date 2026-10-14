import { inngest, isDev } from "../client";
import type { GetStepTools } from "inngest";

export type InngestStep = GetStepTools<typeof inngest>;
export type RealtimePublishArgs = Parameters<typeof inngest.realtime.publish>;

/**
 * Whether there is a realtime endpoint to publish to. Deployed: Inngest Cloud
 * with a signing key. Local: only when the Inngest dev server is in use
 * (PIPELINE_EXECUTOR=inngest, INNGEST_DEV=true or INNGEST_BASE_URL); with the
 * default in-process executor nothing listens on :8288, so publishing would
 * only fail with "fetch failed" on every stage.
 */
function realtimeConfigured(): boolean {
  if (!isDev) return Boolean(process.env.INNGEST_SIGNING_KEY);
  return (
    process.env.PIPELINE_EXECUTOR === "inngest" ||
    process.env.INNGEST_DEV === "true" ||
    Boolean(process.env.INNGEST_BASE_URL)
  );
}

let loggedRealtimeSkip = false;

// Helper to safely publish realtime events (skips quietly when no realtime endpoint is configured)
export async function safeRealtimePublish(
  topicRef: RealtimePublishArgs[0],
  data: RealtimePublishArgs[1]
): Promise<void> {
  if (!realtimeConfigured()) {
    if (!loggedRealtimeSkip) {
      loggedRealtimeSkip = true;
      console.info(
        "[Inngest Realtime] No realtime endpoint configured in this environment; skipping progress publishes."
      );
    }
    return;
  }
  try {
    await inngest.realtime.publish(topicRef, data);
  } catch (err) {
    console.warn("[Inngest Realtime Publish Notice]:", (err as Error).message);
  }
}
