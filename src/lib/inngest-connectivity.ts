import { isDev } from "@/inngest/client";

export interface InngestConnectivityStatus {
  connected: boolean;
  isDev: boolean;
  statusText: string;
}

export async function checkInngestConnectivity(): Promise<InngestConnectivityStatus> {
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
