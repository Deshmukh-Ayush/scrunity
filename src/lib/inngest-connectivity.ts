import { isDev } from "@/inngest/client";
import { getPipelineExecutor } from "@/lib/pipeline/executor";

export interface InngestConnectivityStatus {
  connected: boolean;
  isDev: boolean;
  statusText: string;
}

export async function checkInngestConnectivity(): Promise<InngestConnectivityStatus> {
  // The in-process executor runs stages without Inngest, so it can't be "offline".
  if (getPipelineExecutor() === "direct") {
    return { connected: true, isDev, statusText: "Pipeline stages run in-process" };
  }

  if (isDev) {
    try {
      const baseUrl = process.env.INNGEST_BASE_URL || "http://127.0.0.1:8288";
      const res = await fetch(baseUrl, {
        method: "GET",
        signal: AbortSignal.timeout(1500),
      });
      // Inngest dev server returns 200 or 404 on root, but responds to HTTP requests
      return {
        connected: res.status < 500,
        isDev: true,
        statusText: "Inngest dev server is running and reachable",
      };
    } catch {
      return {
        connected: false,
        isDev: true,
        statusText: "Inngest dev server is offline (port 8288 unreachable)",
      };
    }
  }

  return {
    connected: true,
    isDev: false,
    statusText: "Inngest Cloud mode active",
  };
}

const CONNECTIVITY_CACHE_TTL_MS = 15_000;
let cachedCheck: { expiresAt: number; result: Promise<InngestConnectivityStatus> } | null = null;

/**
 * Same as checkInngestConnectivity, but reuses the last result for a few seconds.
 * For status displays that are polled every few seconds; anything that makes a
 * dispatch decision should call checkInngestConnectivity directly.
 */
export function getCachedInngestConnectivity(): Promise<InngestConnectivityStatus> {
  const now = Date.now();
  if (!cachedCheck || cachedCheck.expiresAt <= now) {
    cachedCheck = { expiresAt: now + CONNECTIVITY_CACHE_TTL_MS, result: checkInngestConnectivity() };
  }
  return cachedCheck.result;
}
