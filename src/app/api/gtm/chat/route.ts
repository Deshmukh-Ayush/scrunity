import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  streamText,
  isStepCount,
  toUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { gtmModel } from "@/lib/gtm-ai";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { createGtmAgentTools } from "@/lib/chat/agent-tools";

export const maxDuration = 60;

function buildChatSystemPrompt(userName?: string, companyName?: string): string {
  const userGreeting = userName
    ? `You are speaking with ${userName}. Address them naturally when appropriate.`
    : "";
  const companyContext = companyName
    ? `Workspace primary company: ${companyName}.`
    : "";

  return `You are Scrunity's autonomous GTM Agent, an intelligent Go-To-Market and outbound pipeline co-pilot.
${userGreeting}
${companyContext}

Capabilities & Responsibilities:
- Inspect active and completed campaigns, current stages, prospect discovery counts, and draft approvals.
- Query discovered prospect companies, verified decision-maker contacts, job titles, and emails.
- Review market intelligence: competitor domains, positioning criteria, and ICP segment definitions.
- Report performance digests, open/reply rates, and learnings across ICP segments.
- Correct and retrigger research runs with updated descriptions if requested.

Principles:
1. TOOL-FIRST FOR INTERNAL DATA: When asked about campaigns, prospects, contacts, segments, competitors, or pipeline metrics, ALWAYS query your internal tools first. Never guess or hallucinate statistics or contact records.
2. CONCISE & ACTIONABLE: Provide crisp, high-signal responses. Summarize findings directly without conversational filler or stating what you are about to do.
3. CONVERSATIONAL COLLABORATION: When answering about campaign status or prospects, suggest next actions (e.g. approving pending drafts, launching a campaign, or refining an ICP segment).`;
}

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const body = await req.json().catch(() => ({}));
    const { messages, companyName } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required." },
        { status: 400 }
      );
    }

    const tools = createGtmAgentTools(auth.orgId, auth.userId);

    const result = streamText({
      model: gtmModel,
      system: buildChatSystemPrompt(undefined, companyName),
      messages,
      stopWhen: isStepCount(5),
      tools,
      onError: ({ error }) => {
        console.error("[POST /api/gtm/chat] streamText error during generation/synthesis:", {
          message: (error as any)?.message,
          stack: (error as any)?.stack,
          cause: (error as any)?.cause,
        });
      },
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: (err) => {
          console.error("[POST /api/gtm/chat] toUIMessageStream synthesis error:", err);
          const msg = (err as any)?.message || "Service temporarily unavailable";
          return `Couldn't summarize the pipeline data — try asking again. (${msg})`;
        },
      }),
    });
  } catch (err: any) {
    console.error("[POST /api/gtm/chat] Streaming error:", err);
    return NextResponse.json(
      { error: "GTM chat stream error", message: err.message },
      { status: 500 }
    );
  }
}
