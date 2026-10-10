import { researchCompanyFunction } from "./research-company";
import { exploreCompetitorsFunction } from "./explore-competitors";
import { defineSegmentsFunction } from "./define-segments";
import { findCompaniesFunction } from "./find-companies";
import { findContactsFunction } from "./find-contacts";
import { qualifyContactsFunction } from "./qualify-contacts";
import { writeEmailsFunction } from "./write-emails";
import { sendEmailsFunction } from "./send-emails";
import { pollRepliesFunction } from "./poll-replies";
import { generateDigestFunction } from "./generate-digest";

export * from "./research-company";
export * from "./explore-competitors";
export * from "./define-segments";
export * from "./find-companies";
export * from "./find-contacts";
export * from "./qualify-contacts";
export * from "./write-emails";
export * from "./send-emails";
export * from "./poll-replies";
export * from "./generate-digest";

// Export array of all GTM Inngest functions for the /api/inngest serve route
export const gtmFunctions = [
  researchCompanyFunction,
  exploreCompetitorsFunction,
  defineSegmentsFunction,
  findCompaniesFunction,
  findContactsFunction,
  qualifyContactsFunction,
  writeEmailsFunction,
  sendEmailsFunction,
  pollRepliesFunction,
  generateDigestFunction,
];

