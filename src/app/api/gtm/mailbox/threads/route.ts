import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmEmailDraft,
  gtmEmailEvent,
  gtmContact,
  gtmProspectCompany,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmConnectedMailbox,
} from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";

export interface MailboxMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  timestamp: string;
  body: string;
  isOutbound: boolean;
  classifiedIntent?: string | null;
}

export interface MailboxThread {
  id: string;
  draftId: string;
  threadId: string | null;
  subject: string;
  contact: {
    id: string;
    name: string;
    email: string | null;
    title: string;
    linkedinUrl: string | null;
  };
  company: {
    id: string | null;
    name: string | null;
    domain: string | null;
  };
  campaign: {
    id: string;
    name: string;
  };
  sentAt: string;
  lastActivityAt: string;
  latestSnippet: string;
  latestSender: string;
  classifiedIntent: "interested" | "not_interested" | "question" | "auto_reply" | "unclear" | null;
  hasReply: boolean;
  isUnread: boolean;
  messages: MailboxMessage[];
}

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const intentFilter = searchParams.get("intent");

    // 1. Fetch connected mailbox to resolve sender identity
    const [connectedMailbox] = await db
      .select({
        id: gtmConnectedMailbox.id,
        email: gtmConnectedMailbox.email,
        status: gtmConnectedMailbox.status,
      })
      .from(gtmConnectedMailbox)
      .where(eq(gtmConnectedMailbox.organizationId, auth.orgId));

    // 2. Fetch sent drafts for this org
    const drafts = await db
      .select({
        draftId: gtmEmailDraft.id,
        subject: gtmEmailDraft.subject,
        body: gtmEmailDraft.body,
        status: gtmEmailDraft.status,
        sentAt: gtmEmailDraft.sentAt,
        threadId: gtmEmailDraft.threadId,
        contactId: gtmContact.id,
        contactName: gtmContact.name,
        contactEmail: gtmContact.email,
        contactTitle: gtmContact.title,
        contactLinkedin: gtmContact.linkedinUrl,
        companyId: gtmProspectCompany.id,
        companyName: gtmProspectCompany.name,
        companyDomain: gtmProspectCompany.domain,
        campaignId: gtmOutreachCampaign.id,
        campaignName: gtmIcpSegment.name,
      })
      .from(gtmEmailDraft)
      .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
      .leftJoin(
        gtmProspectCompany,
        eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
      )
      .innerJoin(
        gtmOutreachCampaign,
        eq(gtmEmailDraft.outreachCampaignId, gtmOutreachCampaign.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .innerJoin(
        gtmIcpSegment,
        eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
      )
      .where(
        and(
          eq(gtmResearchRun.organizationId, auth.orgId),
          eq(gtmEmailDraft.status, "sent")
        )
      )
      .orderBy(desc(gtmEmailDraft.sentAt));

    if (!drafts.length) {
      return NextResponse.json({
        mailbox: connectedMailbox || null,
        threads: [],
        total: 0,
      });
    }

    // 3. Query all events for these drafts
    const draftIds = drafts.map((d) => d.draftId);
    const events = await db
      .select({
        id: gtmEmailEvent.id,
        emailDraftId: gtmEmailEvent.emailDraftId,
        type: gtmEmailEvent.type,
        classifiedIntent: gtmEmailEvent.classifiedIntent,
        rawSnippet: gtmEmailEvent.rawSnippet,
        occurredAt: gtmEmailEvent.occurredAt,
      })
      .from(gtmEmailEvent)
      .where(inArray(gtmEmailEvent.emailDraftId, draftIds))
      .orderBy(gtmEmailEvent.occurredAt);

    // Group events by draftId
    const eventsByDraft = new Map<string, typeof events>();
    for (const evt of events) {
      const list = eventsByDraft.get(evt.emailDraftId) || [];
      list.push(evt);
      eventsByDraft.set(evt.emailDraftId, list);
    }

    // 4. Construct threads (one thread per threadId or contactId)
    const threadMap = new Map<string, MailboxThread>();

    for (const d of drafts) {
      const key = d.threadId || d.contactId;
      const draftEvents = eventsByDraft.get(d.draftId) || [];
      const replyEvents = draftEvents.filter((e) => e.type === "replied");

      const mailboxEmail = connectedMailbox?.email || "outreach@scrunity.ai";

      const messages: MailboxMessage[] = [
        {
          id: d.draftId,
          from: mailboxEmail,
          fromName: "You",
          to: d.contactEmail || "prospect@company.com",
          toName: d.contactName,
          timestamp: (d.sentAt || new Date()).toISOString(),
          body: d.body,
          isOutbound: true,
        },
      ];

      for (const reply of replyEvents) {
        messages.push({
          id: reply.id,
          from: d.contactEmail || "prospect@company.com",
          fromName: d.contactName,
          to: mailboxEmail,
          toName: "You",
          timestamp: reply.occurredAt.toISOString(),
          body: reply.rawSnippet || "(Reply message content)",
          isOutbound: false,
          classifiedIntent: reply.classifiedIntent,
        });
      }

      // Sort messages chronologically
      messages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const latestMessage = messages[messages.length - 1];
      const latestReply = replyEvents[replyEvents.length - 1];

      const thread: MailboxThread = {
        id: key,
        draftId: d.draftId,
        threadId: d.threadId,
        subject: d.subject,
        contact: {
          id: d.contactId,
          name: d.contactName,
          email: d.contactEmail,
          title: d.contactTitle,
          linkedinUrl: d.contactLinkedin,
        },
        company: {
          id: d.companyId,
          name: d.companyName,
          domain: d.companyDomain,
        },
        campaign: {
          id: d.campaignId,
          name: d.campaignName,
        },
        sentAt: (d.sentAt || new Date()).toISOString(),
        lastActivityAt: latestMessage.timestamp,
        latestSnippet: latestMessage.body,
        latestSender: latestMessage.isOutbound ? "You" : d.contactName,
        classifiedIntent:
          (latestReply?.classifiedIntent as MailboxThread["classifiedIntent"]) ||
          null,
        hasReply: replyEvents.length > 0,
        isUnread: replyEvents.length > 0, // marks reply as unread
        messages,
      };

      if (!threadMap.has(key)) {
        threadMap.set(key, thread);
      } else {
        // Merge messages if multiple drafts in same thread
        const existing = threadMap.get(key)!;
        existing.messages = [...existing.messages, ...messages].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const newest = existing.messages[existing.messages.length - 1];
        existing.lastActivityAt = newest.timestamp;
        existing.latestSnippet = newest.body;
        existing.latestSender = newest.isOutbound ? "You" : d.contactName;
        if (thread.classifiedIntent) {
          existing.classifiedIntent = thread.classifiedIntent;
        }
        if (thread.hasReply) {
          existing.hasReply = true;
          existing.isUnread = true;
        }
      }
    }

    let threadList = Array.from(threadMap.values());

    // Sort by latest activity desc
    threadList.sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() -
        new Date(a.lastActivityAt).getTime()
    );

    // Filter by search
    if (search) {
      threadList = threadList.filter(
        (t) =>
          t.contact.name.toLowerCase().includes(search) ||
          t.contact.email?.toLowerCase().includes(search) ||
          t.company.name?.toLowerCase().includes(search) ||
          t.subject.toLowerCase().includes(search) ||
          t.latestSnippet.toLowerCase().includes(search) ||
          t.campaign.name.toLowerCase().includes(search)
      );
    }

    // Filter by intent
    if (intentFilter && intentFilter !== "all") {
      if (intentFilter === "unread") {
        threadList = threadList.filter((t) => t.isUnread);
      } else {
        threadList = threadList.filter(
          (t) => t.classifiedIntent === intentFilter
        );
      }
    }

    return NextResponse.json({
      mailbox: connectedMailbox || null,
      threads: threadList,
      total: threadList.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /api/gtm/mailbox/threads] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
