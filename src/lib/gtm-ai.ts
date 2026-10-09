import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { SynthesizedCompanyProfile, SegmentDigestMetrics } from "@/db/schema";

export const primaryModel = groq("openai/gpt-oss-120b");
export const gtmModel = primaryModel;
export const fallbackModel = groq("openai/gpt-oss-20b");

/**
 * Runs structured generation using primary model with fallback to secondary model.
 * Enforces hard provider-agnostic output token caps (maxTokens -> maxOutputTokens).
 */
export async function generateStructuredWithFallback<T>({
  schema,
  system,
  prompt,
  maxTokens,
}: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  try {
    const { output } = await generateText({
      model: primaryModel,
      output: Output.object({ schema }),
      system,
      prompt,
      maxOutputTokens: maxTokens,
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
    maxOutputTokens: maxTokens,
  });

  if (!output) {
    throw new Error("Both primary and fallback AI models failed to produce output.");
  }

  return output as T;
}

// -------------------------------------------------------------
// Stage 1: Company Profile Synthesis
// -------------------------------------------------------------
export const synthesizedCompanyProfileSchema = z.object({
  summary: z
    .string()
    .describe(
      "A synthesized one-paragraph executive summary under 80 words of what the company does, primary value proposition, and customer positioning."
    ),
  industry: z
    .string()
    .describe("Inferred industry or category under 8 words (e.g. 'Developer Tools', 'Open Source Scheduling Infrastructure')"),
  productFocus: z
    .string()
    .describe("Core product focus and flagship capabilities under 25 words"),
  targetCustomerLanguage: z
    .string()
    .describe(
      "Target customer segment and buyer persona terminology under 25 words"
    ),
  signals: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "2 to 4 notable commercial signals observed, each under 15 words"
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
    maxTokens: 1200,
    system:
      "You are a principal B2B market researcher and GTM strategist. Synthesize an authoritative, highly concise company profile from raw website content, About page details, company size, and onboarding context.\n\n" +
      "CONCISENESS RULES:\n" +
      "- 'summary' MUST be exactly one single paragraph, strictly under 80 words.\n" +
      "- 'industry' must be under 8 words.\n" +
      "- 'productFocus' must be under 25 words.\n" +
      "- 'targetCustomerLanguage' must be under 25 words.\n" +
      "- 'signals' must be 2 to 4 bullet strings, each under 15 words.\n" +
      "- NEVER restate the task, NEVER provide preamble or conversational filler, and NEVER explain your reasoning.\n" +
      "- DO NOT include caveats, hedging, or meta-commentary.",
    prompt:
      `Company Name: ${companyName}\n` +
      `Website: ${websiteUrl}\n` +
      `Team Size / Company Size: ${companySize || "Unknown"}\n` +
      `User-Provided Description: ${companyDescription || "None provided"}\n` +
      (contextDoc ? `Context Document: ${contextDoc.slice(0, 1500)}\n` : "") +
      (scrapedContent
        ? `Scraped Website & About Page Content:\n${scrapedContent.slice(0, 6000)}`
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
    .describe("3 to 5 high-intent Google search queries, each 2 to 5 words long"),
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
    maxTokens: 600,
    system:
      "You are a B2B Go-To-Market strategist. Generate 3 to 5 realistic search queries that a buyer would search on Google to find commercial alternatives and competing software/services in this domain.\n\n" +
      "CONCISENESS RULES:\n" +
      "- Each query must be a crisp 2 to 5 words search query (e.g. 'open source scheduling infrastructure', 'enterprise calendar scheduling api').\n" +
      "- DO NOT explain your reasoning, DO NOT include numbered lists or preambles, and DO NOT add boolean search operator tutorials.\n" +
      "- Avoid mentioning the company name itself.",
    prompt:
      `Company Name: ${companyName}\n` +
      `Company Size: ${companySize || "Unknown"} employees\n` +
      `Description: ${companyDescription}\n` +
      (synthesizedProfile
        ? `Synthesized Summary: ${synthesizedProfile.summary}\nIndustry/Category: ${synthesizedProfile.industry}\nProduct Focus: ${synthesizedProfile.productFocus}\n`
        : "") +
      (contextDoc ? `Additional Context: ${contextDoc.slice(0, 1000)}` : ""),
  });

  return result.queries;
}

export async function generateFallbackCompetitors({
  companyName,
  companyDescription,
  companySize,
}: {
  companyName: string;
  companyDescription: string;
  companySize?: string;
}): Promise<Array<{ name: string; domain: string; description: string }>> {
  try {
    const result = await generateStructuredWithFallback({
      schema: z.object({
        competitors: z
          .array(
            z.object({
              name: z.string().describe("Company or product brand name"),
              domain: z.string().describe("Real web domain, e.g. zapier.com"),
              description: z.string().describe("Exactly 1 sentence under 15 words describing positioning"),
            })
          )
          .min(3)
          .max(5),
      }),
      maxTokens: 600,
      system:
        "You are a B2B market intelligence expert. Return 3 to 5 realistic commercial competitors.\n" +
        "CONCISENESS RULES: Descriptions must be exactly 1 sentence under 15 words. No preamble, no explanation, no task restatement.",
      prompt:
        `Generate 3 to 5 realistic commercial competitors for:\n` +
        `Company Name: ${companyName}\n` +
        `Description: ${companyDescription}\n` +
        `Size: ${companySize || "Unknown"}`,
    });
    return result.competitors;
  } catch (err) {
    console.warn("[generateFallbackCompetitors] Error, using static fallback:", err);
    return [
      { name: "Alternative A", domain: "alternative.io", description: `Competitor in the ${companyName} category.` },
      { name: "Alternative B", domain: "competitorsolution.com", description: `Market alternative to ${companyName}.` },
      { name: "Alternative C", domain: "competecloud.com", description: `Category solution addressing similar needs.` },
    ];
  }
}

// -------------------------------------------------------------
// Stage 3: ICP Segments Definition
// -------------------------------------------------------------
const icpSegmentItemSchema = z.object({
  name: z.string().describe("Crisp, recognizable segment name under 6 words (e.g. 'Seed-Stage FinTech Founders')"),
  painPoint: z
    .string()
    .describe("1 to 2 direct sentences under 30 words describing the acute problem"),
  criteria: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("2 to 4 specific qualification criteria, each under 10 words"),
  candidateSearchTerms: z
    .array(z.string())
    .min(2)
    .max(3)
    .describe("2 to 3 Google search queries to find real companies, each 2 to 5 words"),
  estimatedSizeLabel: z
    .string()
    .describe(
      "Approximate market size label under 10 words (e.g. '~8,000 companies in US/EU')"
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
    .slice(0, 8)
    .join("\n");

  const result = await generateStructuredWithFallback({
    schema: icpSegmentsResponseSchema,
    maxTokens: 1500,
    system:
      "You are an expert GTM strategist. Propose 4 to 6 distinct, actionable Ideal Customer Profile (ICP) segments for this business.\n\n" +
      "CONCISENESS RULES:\n" +
      "- Segment name: under 6 words.\n" +
      "- Pain point: 1 to 2 direct sentences, strictly under 30 words.\n" +
      "- Criteria: 2 to 4 short items, under 10 words each.\n" +
      "- candidateSearchTerms: 2 to 3 search phrases, 2 to 5 words each.\n" +
      "- estimatedSizeLabel: strictly under 10 words.\n" +
      "- NEVER restate the task, NEVER provide preamble or conversational filler, and NEVER explain your reasoning.\n" +
      "- DO NOT invent fictitious company names — candidate companies are sourced via live search.",
    prompt:
      `Company: ${companyName}\n` +
      `Company Size: ${companySize || "Unknown"} employees\n` +
      `Description: ${companyDescription}\n` +
      (synthesizedProfile
        ? `Synthesized Profile: ${synthesizedProfile.summary}\nCategory: ${synthesizedProfile.industry}\nProduct Focus: ${synthesizedProfile.productFocus}\n`
        : "") +
      (contextDoc ? `Context: ${contextDoc.slice(0, 1000)}\n` : "") +
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
    .describe("Google search queries to locate real websites matching this ICP, each 2 to 6 words"),
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
    maxTokens: 600,
    system:
      "You are an outbound sales researcher. Generate 3 to 5 targeted search queries to find real company websites that fit this ICP segment.\n" +
      "CONCISENESS RULES: Each query must be 2 to 6 words. No explanations, no task restatement, no search syntax tutorials.",
    prompt: `Segment: ${segmentName}\nPain Point: ${painPoint}\nCriteria:\n${criteria
      .map((c) => `- ${c}`)
      .join("\n")}`,
  });

  return result.queries;
}

const fallbackProspectCompaniesSchema = z.object({
  companies: z
    .array(
      z.object({
        name: z.string().describe("Company brand or legal name"),
        domain: z.string().describe("Clean root domain, e.g. 'stripe.com'"),
        description: z
          .string()
          .describe("1-sentence description under 15 words of what this company does"),
        location: z.string().default("United States"),
      })
    )
    .min(4)
    .max(6),
});

export async function generateFallbackProspectCompanies({
  segmentName,
  painPoint,
  criteria,
}: {
  segmentName: string;
  painPoint: string;
  criteria: string[];
}): Promise<
  Array<{ name: string; domain: string; description: string; location: string }>
> {
  const result = await generateStructuredWithFallback({
    schema: fallbackProspectCompaniesSchema,
    maxTokens: 800,
    system:
      "You are a B2B sales intelligence specialist. Identify 4 to 6 real, active, well-known companies whose profile matches this ICP segment.\n" +
      "CONCISENESS RULES: Descriptions must be 1 sentence under 15 words. No preamble, no task restatement, no fictitious domains.",
    prompt: `Segment: ${segmentName}\nPain Point: ${painPoint}\nCriteria:\n${criteria
      .map((c) => `- ${c}`)
      .join("\n")}`,
  });
  return result.companies;
}

// -------------------------------------------------------------
// Stage 5: Target Job Function Mapping
// -------------------------------------------------------------
const jobFunctionSchema = z.object({
  jobFunctions: z
    .array(z.string())
    .min(1)
    .max(2)
    .describe("1 to 2 target decision-maker job titles under 4 words each (e.g. 'Head of Sales', 'VP Engineering')"),
  searchKeyword: z
    .string()
    .describe("Short search term under 4 words for LinkedIn snippet search, e.g. 'Founder OR CEO'"),
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
    maxTokens: 500,
    system:
      "You are a sales development leader. Given an ICP segment, determine the exact decision-maker roles most likely to purchase or champion a solution for their pain point.\n" +
      "CONCISENESS RULES: Output only 1 to 2 exact job titles and a short search keyword. No explanatory notes, no preamble, no task restatement.",
    prompt: `Segment: ${segmentName}\nPain Point: ${painPoint}\nCriteria: ${criteria.join(", ")}`,
  });
}

// -------------------------------------------------------------
// Stage 6: Personalized Outreach Email Drafting
// -------------------------------------------------------------
const emailDraftSchema = z.object({
  subject: z
    .string()
    .describe("Catchy, non-spammy subject line strictly under 7 words"),

  body: z
    .string()
    .describe(
      "Complete personalized cold outreach email strictly under 120 words total, exactly 3 to 4 complete sentences. No meta-commentary, no ellipses."
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
    maxTokens: 800,
    system:
      "You are an elite B2B sales copywriter writing personalized cold outreach.\n\n" +
      "CONCISENESS RULES:\n" +
      "- Total email body MUST be strictly under 120 words and contain exactly 3 to 4 complete sentences.\n" +
      "- Subject line MUST be strictly under 7 words.\n" +
      "- NEVER include meta-commentary about why you wrote the email.\n" +
      "- NEVER explain the sales psychology or reasoning behind your wording.\n" +
      "- NEVER include disclaimers, hedging, or 'Here is your email:' preamble.\n" +
      "- Output ONLY the final personalized outreach email.\n\n" +
      "Structure:\n" +
      "1. Friendly greeting using their first name.\n" +
      "2. Specific personalization line referencing one concrete detail from their company.\n" +
      "3. Direct reference to the specific pain point and how our company uniquely helps.\n" +
      "4. One single, low-friction, polite call to action.",
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
  reasoning: z.string().describe("1 to 2 direct sentences under 30 words explaining classification rationale"),
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
    maxTokens: 500,
    system:
      "You are an email intent classification engine. Classify the prospect's reply into exactly one category: 'interested', 'not_interested', 'question', 'auto_reply', or 'unclear'.\n\n" +
      "CONCISENESS RULES:\n" +
      "- 'reasoning' must be 1 to 2 concise sentences, strictly under 30 words total.\n" +
      "- DO NOT restate the prospect email, DO NOT explain reasoning steps, and DO NOT hedge.\n" +
      "- Be decisive and accurate.",
    prompt:
      `Original Email Subject: ${originalSubject || "N/A"}\n` +
      `Original Email Body: ${originalBody || "N/A"}\n` +
      `Prospect Reply:\n"${replyText}"`,
  });
}

const bookingReplySchema = z.object({
  body: z.string().describe("Short 2-3 sentence friendly reply under 60 words containing booking link"),
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
      maxTokens: 500,
      system:
        "You are writing a brief, warm reply to an interested prospect who responded positively to our outreach.\n\n" +
        "CONCISENESS RULES:\n" +
        "- Keep it to 2-3 sentences max, strictly under 60 words total.\n" +
        "- Include the exact booking link provided.\n" +
        "- No preamble, no postscript, no filler.",
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
export const segmentDigestSummarySchema = z.object({
  headline: z
    .string()
    .describe("1-sentence executive takeaway under 20 words summarizing performance"),
  whatIsConverting: z
    .string()
    .describe("Specific observations under 50 words on what is converting"),
  whatIsNotConverting: z
    .string()
    .describe("Points of friction, non-interest, or bounces under 50 words"),
  sampleSizeAssessment: z
    .string()
    .describe(
      "Plain-language note under 40 words on statistical reliability vs small directional sample"
    ),
  recommendedAction: z
    .string()
    .describe(
      "Concrete strategic recommendation on budget allocation under 35 words"
    ),
  narrativeText: z
    .string()
    .describe(
      "1 to 2 cohesive paragraphs under 140 words total uniting all findings"
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
    "You are a principal B2B Go-To-Market analyst and founder advisor evaluating outbound campaign performance per ICP segment.\n\n" +
    "CONCISENESS RULES:\n" +
    "- headline: exactly 1 sentence under 20 words.\n" +
    "- whatIsConverting and whatIsNotConverting: each strictly under 50 words.\n" +
    "- sampleSizeAssessment: strictly under 40 words.\n" +
    "- recommendedAction: strictly under 35 words.\n" +
    "- narrativeText: 1 to 2 paragraphs, strictly under 140 words total.\n" +
    "- Ground every observation strictly in the provided metrics. NEVER invent numbers or add conversational preamble.\n" +
    (isSmallSample
      ? "- CRITICAL: Sample size is SMALL (" +
        metrics.sentCount +
        " sent < 20). State explicitly that volume is directional only and advise collecting more data before major budget shifts.\n"
      : "- Sample size is statistically reliable (" +
        metrics.sentCount +
        " sent). Provide decisive recommendations.\n") +
    "- Maintain a candid, concise executive tone.";

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
      maxTokens: 1500,
      system,
      prompt,
    });
    return result;
  } catch (err) {
    console.warn("[GTM AI] Error generating segment digest with LLM, using deterministic summary fallback:", err);
    const sampleNote = isSmallSample
      ? `Sample size is currently ${metrics.sentCount} sent emails (below the 20-email threshold). Rates are early directional signals.`
      : `Sample size of ${metrics.sentCount} emails provides a reliable statistical baseline.`;
    const headline = metrics.meetingsBookedCount > 0
      ? `Segment "${segmentName}" demonstrates positive conversion with ${metrics.meetingsBookedCount} booked meeting(s).`
      : `Segment "${segmentName}" has generated ${metrics.repliedCount} replies across ${metrics.sentCount} sent emails.`;
    const converting = metrics.meetingsBookedCount > 0 || metrics.replyBreakdown.interested > 0
      ? `${metrics.replyBreakdown.interested} interested reply(ies) and ${metrics.meetingsBookedCount} booked meeting(s) indicate messaging resonance.`
      : `Initial outreach initiated. Awaiting further engagement.`;
    const friction = metrics.bouncedCount > 0 || metrics.replyBreakdown.notInterested > 0
      ? `Observed ${metrics.bouncedCount} bounce(s) and ${metrics.replyBreakdown.notInterested} non-interested reply(ies).`
      : `No significant objections recorded.`;
    const recommendation = isSmallSample
      ? `Maintain current campaign cadence to expand sample size before adjusting budget.`
      : metrics.bookingRate > 3
      ? `Double down: Segment shows strong economics. Increase prospecting volume.`
      : `Refine value proposition before allocating additional outreach budget.`;

    return {
      headline,
      whatIsConverting: converting,
      whatIsNotConverting: friction,
      sampleSizeAssessment: sampleNote,
      recommendedAction: recommendation,
      narrativeText: `${headline} ${converting} ${friction} ${sampleNote} Recommendation: ${recommendation}`,
    };
  }
}
