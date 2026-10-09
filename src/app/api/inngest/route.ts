import { serve } from "inngest/next";
import { inngest, isDev } from "@/inngest/client";
import { gtmFunctions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: gtmFunctions,
});
