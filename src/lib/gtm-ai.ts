import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";

export const primaryModel = groq("openai/gpt-oss-120b");
export const fallbackModel = groq("openai/gpt-oss-20b");

/**
 * Runs structured generation using primary model with fallback to secondary model.
 */
export async function generateStructuredWithFallback<T>({
  schema,
  system,
  prompt,
}: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
}): Promise<T> {
  try {
    const { output } = await generateText({
      model: primaryModel,
      output: Output.object({ schema }),
      system,
      prompt,
    });
    if (output) return output as T;
  } catch (err: any) {
    console.warn(
      "[GTM AI Fallback] Primary model error. Falling back to secondary model:",
      err?.message || err
    );
  }

  const { output } = await generateText({
    model: fallbackModel,
    output: Output.object({ schema }),
    system,
    prompt,
  });

  if (!output) {
    throw new Error("Both primary and fallback AI models failed to produce output.");
  }

  return output as T;
}

import type { SynthesizedCompanyProfile } from "@/db/schema";

// -------------------------------------------------------------
// Stage 1: Company Profile Synthesis
// -------------------------------------------------------------
export const synthesizedCompanyProfileSchema = z.object({
  summary: z
    .string()
    .describe(
      "A synthesized one-paragraph executive summary of what the company does, their primary value proposition, target customer, and strategic positioning."
    ),
  industry: z
    .string()
    .describe(
      "Inferred industry or category (e.g. 'Open Source Scheduling Infrastructure', 'Developer Tools', 'B2B Sales Automation')"
    ),
  productFocus: z
    .string()
    .describe("Core product focus, flagship features, and delivery capabilities"),
  targetCustomerLanguage: z
    .string()
    .describe(
      "Target customer language, buyer personas, and customer segment terminology actually found on the website"
    ),
  signals: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe(
      "Notable strategic signals observed (e.g. self-serve vs enterprise motion, open-source, pricing structure, regulatory/compliance focus, company scale implications)"
    ),
});

export async function synthesizeCompanyProfile({
  companyName,
  websiteUrl,
  companySize,
  companyDescription,
  contextDoc,
  scrapedContent,
}: {
  companyName: string;
  websiteUrl: string;
  companySize?: string | null;
  companyDescription?: string | null;
  contextDoc?: string | null;
  scrapedContent?: string | null;
}): Promise<SynthesizedCompanyProfile> {
  const result = await generateStructuredWithFallback({
    schema: synthesizedCompanyProfileSchema,
    system:
      "You are a principal B2B market researcher and GTM strategist. Synthesize a comprehensive, authoritative company profile from raw website content, About page details, company size, and onboarding context.\n" +
      "Do NOT simply regurgitate raw marketing text. Extract true positioning, core capabilities, target customer language, and strategic signals.\n" +
      "Reflect the company's operating scale based on their team size (e.g., 1-10 early-stage/nimble, 11-50 growing challenger, 51-200 scaling mid-market, 200+ established enterprise), highlighting what this scale implies for their commercial focus and market approach.",
    prompt:
      `Company Name: ${companyName}\n` +
      `Website: ${websiteUrl}\n` +
      `Team Size / Company Size: ${companySize || "Unknown"}\n` +
      `User-Provided Description: ${companyDescription || "None provided"}\n` +
      (contextDoc ? `Context Document: ${contextDoc.slice(0, 2000)}\n` : "") +
      (scrapedContent
        ? `Scraped Website & About Page Content:\n${scrapedContent.slice(0, 8000)}`
        : ""),
  });

  return result;
}

// -------------------------------------------------------------
// Stage 2: Competitor search queries
// -------------------------------------------------------------
const competitorQueriesSchema = z.object({
  queries: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("3 to 5 high-intent Google search queries to discover competitors"),
});

export async function generateCompetitorSearchQueries({
  companyName,
  companyDescription,
  companySize,
  synthesizedProfile,
  contextDoc,
}: {
  companyName: string;
  companyDescription: string;
  companySize?: string | null;
  synthesizedProfile?: SynthesizedCompanyProfile | null;
  contextDoc?: string | null;
}): Promise<string[]> {
  const result = await generateStructuredWithFallback({
    schema: competitorQueriesSchema,
    system:
      "You are a B2B Go-To-Market and competitive intelligence strategist. Generate 3 to 5 realistic search queries that a buyer would search on Google to find commercial alternatives and competing software/services in this domain.\n\n" +
      "CRITICAL - Calibrate queries directly to company size and competitive tier:\n" +
      "- Small companies (1-10 employees): Generate queries targeting direct agile peers, lightweight software, open-source or indie tools, and SMB/startup alternatives (e.g. self-hosted, lightweight, modern startup tools).\n" +
      "- Mid-size companies (11-50, 51-200 employees): Generate queries targeting scaling commercial platforms, mid-market SaaS alternatives, and category challengers.\n" +
      "- Large enterprise companies (200+ employees): Generate queries targeting enterprise-grade solutions, market leaders, platforms with SOC2/HIPAA compliance, workforce management, and enterprise procurement alternatives.\n\n" +
      "Focus on the core category, value proposition, and software tools. Avoid mentioning the company name itself.",
    prompt:
      `Company Name: ${companyName}\n` +
      `Company Size: ${companySize || "Unknown"} employees\n` +
      `Description: ${companyDescription}\n` +
      (synthesizedProfile
        ? `Synthesized Summary: ${synthesizedProfile.summary}\nIndustry/Category: ${synthesizedProfile.industry}\nProduct Focus: ${synthesizedProfile.productFocus}\n`
        : "") +
      (contextDoc ? `Additional Context: ${contextDoc.slice(0, 1500)}` : ""),
  });

  return result.queries;
}

// -------------------------------------------------------------
// Stage 3: ICP Segments Definition
// -------------------------------------------------------------
const icpSegmentItemSchema = z.object({
  name: z.string().describe("Crisp, recognizable segment name (e.g. 'Seed-Stage FinTech Founders')"),
  painPoint: z
    .string()
    .describe("The acute, urgent problem this segment experiences that our product solves"),
  criteria: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("Specific qualification criteria (e.g. business model, tech stack, team size)"),
  candidateSearchTerms: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("Search queries to find real companies fitting this ICP on Google"),
  estimatedSizeLabel: z
    .string()
    .describe(
      "LLM best-guess estimate of total addressable market size (e.g. '~8,000 companies in US/EU'). Explicitly approximate."
    ),
});

const icpSegmentsResponseSchema = z.object({
  segments: z.array(icpSegmentItemSchema).min(4).max(6),
});

export async function generateIcpSegments({
  companyName,
  companyDescription,
  companySize,
  synthesizedProfile,
  competitors,
  contextDoc,
}: {
  companyName: string;
  companyDescription: string;
  companySize?: string | null;
  synthesizedProfile?: SynthesizedCompanyProfile | null;
  competitors: Array<{ name: string; domain: string; description: string }>;
  contextDoc?: string | null;
}) {
  const compSummary = competitors
    .map((c) => `- ${c.name} (${c.domain}): ${c.description}`)
    .slice(0, 10)
    .join("\n");

  const result = await generateStructuredWithFallback({
    schema: icpSegmentsResponseSchema,
    system:
      "You are an expert GTM strategist. Propose 4 to 6 distinct, actionable Ideal Customer Profile (ICP) segments for this business. Each segment must have an acute pain point, strict qualification criteria, search terms to find real companies, and an estimated size label clearly marked as an approximation. Do not invent fictitious company names — candidate companies will be sourced via live search.\n\n" +
      "CRITICAL - Tailor ICP segments directly to company size and operational capacity:\n" +
      "- For small teams (1-10 employees): Define ICP segments that a nimble team can effectively sell to and support without huge bureaucratic sales cycles — e.g. early-stage founders, indie developers, boutique agencies, seed-stage startups, and agile teams seeking fast setup and immediate time-to-value.\n" +
      "- For mid-market teams (11-50, 51-200 employees): Define ICP segments spanning growing scaleups, mid-market department leads, and modern high-growth companies with dedicated team budgets.\n" +
      "- For enterprise teams (200+ employees): Define ICP segments targeting enterprise buyers, VP/Director-level stakeholders, global organizations, compliance-sensitive industries (healthcare, finance, government), and large multi-team enterprise accounts.\n\n" +
      "Ensure segment names, qualification criteria, pain points, candidate search terms, and estimated market size reflect this company size calibration.",
    prompt:
      `Company: ${companyName}\n` +
      `Company Size: ${companySize || "Unknown"} employees\n` +
      `Description: ${companyDescription}\n` +
      (synthesizedProfile
        ? `Synthesized Profile: ${synthesizedProfile.summary}\nCategory: ${synthesizedProfile.industry}\nProduct Focus: ${synthesizedProfile.productFocus}\nTarget Customer Language on Site: ${synthesizedProfile.targetCustomerLanguage}\nNotable Signals: ${synthesizedProfile.signals?.join("; ")}\n`
        : "") +
      (contextDoc ? `Context: ${contextDoc.slice(0, 1500)}\n` : "") +
      `Known Competitors:\n${compSummary}`,
  });

  return result.segments;
}

// -------------------------------------------------------------
// Stage 4: Prospect Company Search Queries
// -------------------------------------------------------------
const prospectSearchQueriesSchema = z.object({
  queries: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Google search queries to locate real websites of companies matching this ICP"),
});

export async function generateProspectSearchQueries({
  segmentName,
  painPoint,
  criteria,
}: {
  segmentName: string;
  painPoint: string;
  criteria: string[];
}): Promise<string[]> {
  const result = await generateStructuredWithFallback({
    schema: prospectSearchQueriesSchema,
    system:
      "You are an outbound sales researcher. Generate 3 to 5 targeted search queries to find real company websites that fit this ICP segment. Use operators or relevant keywords like software, platform, company, agency, or industry keywords.",
    prompt: `Segment: ${segmentName}\nPain Point: ${painPoint}\nCriteria:\n${criteria
      .map((c) => `- ${c}`)
      .join("\n")}`,
  });

  return result.queries;
}

// -------------------------------------------------------------
// Stage 5: Target Job Function Mapping
// -------------------------------------------------------------
const jobFunctionSchema = z.object({
  jobFunctions: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe("Target decision-maker job titles/roles (e.g. 'Founder', 'Head of Sales', 'VP Engineering')"),
  searchKeyword: z
    .string()
    .describe("Short search term for LinkedIn snippet search, e.g. 'Founder OR CEO'"),
});

export async function deriveTargetJobFunction({
  segmentName,
  painPoint,
  criteria,
}: {
  segmentName: string;
  painPoint: string;
  criteria: string[];
}) {
  return await generateStructuredWithFallback({
    schema: jobFunctionSchema,
    system:
      "You are a sales development leader. Given an ICP segment, determine the exact decision-maker roles most likely to purchase or champion a solution for their pain point. Do not use generic fallback roles if the segment specifies a role.",
    prompt: `Segment: ${segmentName}\nPain Point: ${painPoint}\nCriteria: ${criteria.join(", ")}`,
  });
}

// -------------------------------------------------------------
// Stage 6: Personalized Outreach Email Drafting
// -------------------------------------------------------------
const emailDraftSchema = z.object({
  subject: z
    .string()
    .min(5)
    .max(80)
    .describe("Catchy, non-spammy subject line under 8 words"),

  body: z
    .string()
    .min(250)
    .max(1200)
    .refine((value) => !value.includes("..."), {
      message: "Do not use ellipses or truncated sentences.",
    })
    .refine((value) => {
      const sentenceCount = value
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter(Boolean).length;

      return sentenceCount >= 3 && sentenceCount <= 5;
    }, {
      message: "Email body must contain 3 to 5 complete sentences.",
    })
    .describe(
      "Complete personalized cold outreach email of 3-5 sentences, roughly 250-500 characters. Never truncate the message and never use ellipses."
    ),
});

export async function generateOutreachEmailDraft({
  contactName,
  contactTitle,
  companyName,
  companyDescription,
  segmentPainPoint,
  senderCompanyName,
  senderCompanyDescription,
}: {
  contactName: string;
  contactTitle: string;
  companyName: string;
  companyDescription: string;
  segmentPainPoint: string;
  senderCompanyName: string;
  senderCompanyDescription: string;
}) {
  const firstName = contactName.split(" ")[0] || contactName;

  return await generateStructuredWithFallback({
    schema: emailDraftSchema,
    system:
  "You are an elite B2B sales copywriter writing personalized cold outreach.\n" +
  "Write a COMPLETE email. NEVER truncate the email. NEVER use '...' or ellipses.\n" +
  "The body MUST contain exactly 3 to 5 complete sentences and should be roughly 250 to 500 characters.\n" +
  "Follow this structure:\n" +
  "1. Friendly greeting using their first name.\n" +
  "2. Specific personalization line referencing one concrete detail from their company description.\n" +
  "3. Direct reference to the specific pain point they likely experience and how our company uniquely helps.\n" +
  "4. One single, low-friction, polite call to action.\n" +
  "5. End with a complete sentence.\n" +
  "No buzzwords, no pushy sales jargon, no generic templates.",
    prompt: `Prospect: ${firstName} (${contactTitle}) at ${companyName}\nProspect Company Details: ${companyDescription}\nTarget Pain Point: ${segmentPainPoint}\nOur Company: ${senderCompanyName}\nWhat We Do: ${senderCompanyDescription}`,
  });
}

// -------------------------------------------------------------
// Stage 8: Reply Intent Classification & Booking Response
// -------------------------------------------------------------
export type ReplyIntent =
  | "interested"
  | "not_interested"
  | "question"
  | "auto_reply"
  | "unclear";

const replyIntentSchema = z.object({
  intent: z.enum([
    "interested",
    "not_interested",
    "question",
    "auto_reply",
    "unclear",
  ]),
  reasoning: z.string().describe("1-sentence explanation of classification"),
});

export async function classifyReplyIntent({
  replyText,
  originalSubject,
  originalBody,
}: {
  replyText: string;
  originalSubject?: string;
  originalBody?: string;
}): Promise<{ intent: ReplyIntent; reasoning: string }> {
  // Pre-filter obvious out of office / auto-replies
  const lower = replyText.toLowerCase();
  if (
    lower.includes("out of the office") ||
    lower.includes("out of office") ||
    lower.includes("automatic reply") ||
    lower.includes("auto-reply") ||
    lower.includes("away from my email") ||
    lower.includes("on annual leave") ||
    lower.includes("maternity leave") ||
    lower.includes("paternity leave")
  ) {
    return {
      intent: "auto_reply",
      reasoning: "Detected out-of-office or automated responder keywords.",
    };
  }

  return await generateStructuredWithFallback({
    schema: replyIntentSchema,
    system:
      "You are an email intent classification engine. Classify the prospect's reply into exactly one of:\n" +
      "- 'interested': Prospect expresses willingness to meet, talk, see a demo, or learn more.\n" +
      "- 'not_interested': Prospect declines, unsubscribes, says no, or asks to be removed.\n" +
      "- 'question': Prospect asks a clarifying question about features, pricing, or company before deciding.\n" +
      "- 'auto_reply': Automated out-of-office message, vacation responder, or delivery receipt.\n" +
      "- 'unclear': Vague, ambiguous, or empty message.\n" +
      "Be decisive and accurate.",
    prompt:
      `Original Email Subject: ${originalSubject || "N/A"}\n` +
      `Original Email Body: ${originalBody || "N/A"}\n` +
      `Prospect Reply:\n"${replyText}"`,
  });
}

const bookingReplySchema = z.object({
  body: z.string().describe("Short 2-3 sentence friendly reply with booking link"),
});

export async function composeInterestedBookingReply({
  recipientName,
  bookingUrl,
  replyText,
}: {
  recipientName: string;
  bookingUrl: string;
  replyText?: string;
}): Promise<string> {
  const firstName = recipientName.split(" ")[0] || recipientName;

  try {
    const result = await generateStructuredWithFallback({
      schema: bookingReplySchema,
      system:
        "You are writing a brief, warm reply to an interested prospect who responded positively to our outreach.\n" +
        "Keep it to 2-3 sentences max. Thank them for responding and direct them to pick a convenient time via the booking link.\n" +
        "Include the exact booking link provided.",
      prompt: `Prospect Name: ${firstName}\nBooking URL: ${bookingUrl}\nTheir Reply: "${replyText || "Sounds good, let's talk"}"`,
    });
    if (result.body && result.body.includes(bookingUrl)) {
      return result.body;
    }
  } catch (err) {
    console.warn("[GTM AI] Fallback to standard booking template:", err);
  }

  // Guaranteed fallback template
  return (
    `Hi ${firstName},\n\n` +
    `Thanks for getting back to me! I would love to connect and share more. ` +
    `Feel free to pick a time that works best for you here: ${bookingUrl}\n\n` +
    `Looking forward to speaking with you!`
  );
}

// -------------------------------------------------------------
// Stage 9: Segment Performance Digest LLM Synthesis
// -------------------------------------------------------------
import type { SegmentDigestMetrics } from "@/db/schema";

export const segmentDigestSummarySchema = z.object({
  headline: z
    .string()
    .describe("1-sentence high-level executive takeaway summarizing segment performance"),
  whatIsConverting: z
    .string()
    .describe("Specific insights on what is converting or showing positive responsiveness"),
  whatIsNotConverting: z
    .string()
    .describe("Points of friction, non-interest reasons, bounces, or silence"),
  sampleSizeAssessment: z
    .string()
    .describe(
      "Explicit plain-language note on whether sample size is statistically significant or small/directional"
    ),
  recommendedAction: z
    .string()
    .describe(
      "Concrete strategic recommendation on budget allocation (e.g., expand sample size, scale up spend, or refine pain point/targeting)"
    ),
  narrativeText: z
    .string()
    .describe(
      "A cohesive 2-3 paragraph synthesis uniting all findings into an executive report for founders"
    ),
});

export type SegmentDigestSummaryResult = z.infer<typeof segmentDigestSummarySchema>;

export async function generateSegmentDigestSummary({
  segmentName,
  painPoint,
  companyName,
  metrics,
  periodStart,
  periodEnd,
}: {
  segmentName: string;
  painPoint: string;
  companyName: string;
  metrics: SegmentDigestMetrics;
  periodStart: Date;
  periodEnd: Date;
}): Promise<SegmentDigestSummaryResult> {
  const isSmallSample = metrics.isSmallSample;
  const system =
    "You are a principal B2B Go-To-Market analyst and founder advisor. " +
    "You evaluate outbound campaign performance per ICP segment to guide budget allocation and message market fit.\n\n" +
    "CORE RULES:\n" +
    "- Ground every observation strictly in the provided metrics: sent, opened, replied, bounced, intent breakdown, and booked meetings.\n" +
    "- Do NOT invent scores, artificial rankings, or qualification grades.\n" +
    "- All conversion rates are plain percentages (reply rate, interested-reply rate, booking rate).\n" +
    (isSmallSample
      ? "- CRITICAL: The sample size is SMALL (under 20 sent emails: " +
        metrics.sentCount +
        " sent). You MUST EXPLICITLY state in plain language that this volume is too small to draw statistically reliable conclusions. Present the rates as early directional signals only, and explicitly advise gathering additional sample volume before committing significant budget changes.\n"
      : "- Sample size is statistically meaningful (" +
        metrics.sentCount +
        " sent). Provide confident, decisive recommendations on budget allocation.\n") +
    "- Maintain a clear, candid, and professional executive tone.";

  const prompt =
    `Company: ${companyName}\n` +
    `ICP Segment: ${segmentName}\n` +
    `Pain Point Target: ${painPoint}\n` +
    `Evaluation Window: ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}\n\n` +
    `Performance Metrics:\n` +
    `- Emails Sent: ${metrics.sentCount}\n` +
    `- Emails Opened: ${metrics.openedCount}\n` +
    `- Emails Replied: ${metrics.repliedCount} (Reply Rate: ${metrics.replyRate}%)\n` +
    `- Bounces: ${metrics.bouncedCount}\n` +
    `- Reply Breakdown: Interested: ${metrics.replyBreakdown.interested}, Questions: ${metrics.replyBreakdown.question}, Not Interested: ${metrics.replyBreakdown.notInterested}, Auto-reply: ${metrics.replyBreakdown.autoReply}, Unclear: ${metrics.replyBreakdown.unclear}\n` +
    `- Interested Reply Rate: ${metrics.interestedReplyRate}%\n` +
    `- Meetings Booked: ${metrics.meetingsBookedCount} (Booking Rate: ${metrics.bookingRate}%)\n` +
    `- Statistical Sample Status: ${isSmallSample ? `SMALL SAMPLE WARNING (${metrics.sentCount} sent < 20)` : "Sufficient Sample Size"}`;

  try {
    const result = await generateStructuredWithFallback({
      schema: segmentDigestSummarySchema,
      system,
      prompt,
    });
    return result;
  } catch (err) {
    console.warn("[GTM AI] Error generating segment digest with LLM, using deterministic summary fallback:", err);
    // Deterministic fallback if LLM models fail
    const sampleNote = isSmallSample
      ? `Sample size is currently ${metrics.sentCount} sent emails (below the 20-email statistical threshold). Conversion rates are directional early signals and should not yet be used for major budget commitments.`
      : `Sample size of ${metrics.sentCount} emails provides a reliable statistical baseline.`;
    const headline = metrics.meetingsBookedCount > 0
      ? `Segment "${segmentName}" demonstrates positive conversion with ${metrics.meetingsBookedCount} booked meeting(s).`
      : `Segment "${segmentName}" has generated ${metrics.repliedCount} replies across ${metrics.sentCount} sent emails.`;
    const converting = metrics.meetingsBookedCount > 0 || metrics.replyBreakdown.interested > 0
      ? `${metrics.replyBreakdown.interested} interested reply(ies) and ${metrics.meetingsBookedCount} booked meeting(s) indicate resonant messaging on "${painPoint}".`
      : `Initial outreach initiated. Awaiting further positive engagement.`;
    const friction = metrics.bouncedCount > 0 || metrics.replyBreakdown.notInterested > 0
      ? `Observed ${metrics.bouncedCount} bounce(s) and ${metrics.replyBreakdown.notInterested} non-interested reply(ies).`
      : `No significant objections or deliverability issues recorded.`;
    const recommendation = isSmallSample
      ? `Maintain current campaign cadence to expand sample size to at least 20-50 sent emails before adjusting budget allocation.`
      : metrics.bookingRate > 3
      ? `Double down: Segment shows strong unit economics. Increase prospecting volume.`
      : `Refine value proposition or targeting criteria before allocating additional outreach budget.`;

    return {
      headline,
      whatIsConverting: converting,
      whatIsNotConverting: friction,
      sampleSizeAssessment: sampleNote,
      recommendedAction: recommendation,
      narrativeText: `${headline}\n\n${converting}\n\n${friction}\n\n${sampleNote}\n\nRecommendation: ${recommendation}`,
    };
  }
}

