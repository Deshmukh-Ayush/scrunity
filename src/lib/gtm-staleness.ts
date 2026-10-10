export const STAGE_STALENESS_THRESHOLDS_MS: Record<string, number> = {
  // Stages 1-3: Research Run stages
  research_company: 3 * 60 * 1000, // 3 minutes
  research_competitors: 3 * 60 * 1000, // 3 minutes
  define_segments: 3 * 60 * 1000, // 3 minutes

  // Stages 4-7: Campaign stages
  find_companies: 3 * 60 * 1000, // 3 minutes
  find_contacts: 4 * 60 * 1000, // 4 minutes (multiple external lookups + MX checks)
  write_emails: 3 * 60 * 1000, // 3 minutes
  send_emails: 5 * 60 * 1000, // 5 minutes (supports 30-90s throttled delay per draft)

  // Stages 8-9: Mailbox poll & digest
  poll_replies: 3 * 60 * 1000,
  generate_digest: 3 * 60 * 1000,

  default: 3 * 60 * 1000,
};

// If a stage was dispatched but no progress was ever recorded (worker never picked it up),
// flag as stalled after this duration
export const DISPATCH_PICKUP_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export interface StageStalenessResult {
  isStalled: boolean;
  isDispatchedWaiting: boolean;
  elapsedMs: number;
  thresholdMs: number;
  lastProgressTimestamp: Date | null;
  stageStartedTimestamp: Date | null;
  explanation: string;
}

export function formatElapsedHuman(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${hours}h ${remMinutes}m`;
}

export function checkStageStaleness({
  stage,
  status,
  stageStartedAt,
  lastProgressAt,
  createdAt,
  recentActivityAt,
}: {
  stage: string;
  status: string;
  stageStartedAt?: Date | string | null;
  lastProgressAt?: Date | string | null;
  createdAt?: Date | string | null;
  recentActivityAt?: Date | string | null;
}): StageStalenessResult {
  // Only in_progress stages can become stalled
  if (status !== "in_progress") {
    return {
      isStalled: false,
      isDispatchedWaiting: false,
      elapsedMs: 0,
      thresholdMs: 0,
      lastProgressTimestamp: null,
      stageStartedTimestamp: null,
      explanation: "",
    };
  }

  const thresholdMs =
    STAGE_STALENESS_THRESHOLDS_MS[stage] || STAGE_STALENESS_THRESHOLDS_MS.default;

  const now = Date.now();
  const started = stageStartedAt
    ? new Date(stageStartedAt)
    : createdAt
    ? new Date(createdAt)
    : new Date();

  // Find effective last progress date (explicit lastProgressAt or recentActivityAt like last draft sentAt)
  let lastProgress: Date | null = null;
  if (lastProgressAt) {
    lastProgress = new Date(lastProgressAt);
  } else if (recentActivityAt) {
    lastProgress = new Date(recentActivityAt);
  }

  let elapsedMs: number;
  let isStalled = false;
  let isDispatchedWaiting = false;

  if (lastProgress) {
    elapsedMs = Math.max(0, now - lastProgress.getTime());
    isStalled = elapsedMs > thresholdMs;
  } else {
    // Stage was dispatched but worker has never reported progress
    elapsedMs = Math.max(0, now - started.getTime());
    // Use the stage threshold (or dispatch pickup threshold if lower)
    const effectiveThreshold = Math.min(thresholdMs, DISPATCH_PICKUP_THRESHOLD_MS);
    isStalled = elapsedMs > effectiveThreshold;
    isDispatchedWaiting = !isStalled;
  }

  let explanation = "";
  if (isStalled) {
    const elapsedText = formatElapsedHuman(elapsedMs);
    if (!lastProgress) {
      explanation = `No update from the pipeline in over ${elapsedText} — this usually means the background job runner isn't running or didn't pick up the event.`;
    } else {
      explanation = `No update from the pipeline in over ${elapsedText} (last progress was recorded at ${lastProgress.toLocaleTimeString()}) — this usually means the background job runner isn't running or didn't pick up the event.`;
    }
  }

  return {
    isStalled,
    isDispatchedWaiting,
    elapsedMs,
    thresholdMs,
    lastProgressTimestamp: lastProgress,
    stageStartedTimestamp: started,
    explanation,
  };
}
