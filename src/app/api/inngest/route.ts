import { NextResponse } from "next/server";
import { serve } from "inngest/next";
import { inngest, isDev } from "@/inngest/client";
import { gtmFunctions } from "@/inngest/functions";

/**
 * Longest one Inngest step (one HTTP call to this route) may run, in seconds:
 * 300 is the Vercel Hobby ceiling. Stages are split so no single step comes
 * near it (Stage 5's search steps stop starting work after 25 s); see CLAUDE.md.
 */
export const maxDuration = 300;

const handlers = serve({
  client: inngest,
  functions: gtmFunctions,
});

/**
 * In dev mode the Inngest SDK accepts unsigned requests. That is only allowed in
 * a development build, or when INNGEST_DEV=true is set explicitly (local
 * Inngest dev server). A production build whose client fell back to dev mode
 * (e.g. started locally or on a LAN for a demo) refuses every request, so
 * nothing can invoke functions unsigned. In cloud mode the SDK verifies the
 * signing key on every request.
 */
const unsignedServeBlocked =
  isDev && process.env.NODE_ENV === "production" && process.env.INNGEST_DEV !== "true";

function refuse() {
  return NextResponse.json(
    { error: "Inngest endpoint disabled: unsigned (dev mode) requests are not accepted in production." },
    { status: 403 }
  );
}

export const GET = unsignedServeBlocked ? refuse : handlers.GET;
export const POST = unsignedServeBlocked ? refuse : handlers.POST;
export const PUT = unsignedServeBlocked ? refuse : handlers.PUT;
