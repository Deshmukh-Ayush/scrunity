import { pipelineStageFunctions } from "./pipeline-stages";
import { sendEmailsFunction } from "./send-emails";
import { pollRepliesFunction } from "./poll-replies";
import { generateDigestFunction } from "./generate-digest";

export * from "./research-company";
export * from "./explore-competitors";
export * from "./define-segments";
export * from "./find-companies";
export * from "./find-contacts";
export * from "./write-emails";
export * from "./send-emails";
export * from "./poll-replies";
export * from "./generate-digest";

// Every GTM Inngest function, registered by the /api/inngest serve route.
// Stages 1-6 run through the shared stage runner (pipeline-stages.ts).
export const gtmFunctions = [
  ...pipelineStageFunctions,
  sendEmailsFunction,
  pollRepliesFunction,
  generateDigestFunction,
];
