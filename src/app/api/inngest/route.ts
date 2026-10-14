import { NextResponse } from "next/server";
import { serve } from "inngest/next";
import { inngest, isDev } from "@/inngest/client";
import { gtmFunctions } from "@/inngest/functions";

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
