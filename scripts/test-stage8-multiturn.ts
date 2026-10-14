import "dotenv/config";
import { db } from "../src/utils/db";
import {
  gtmResearchRun,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmProspectCompany,
  gtmContact,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmConnectedMailbox,
  gtmMeeting,
  organization,
  user,
} from "../src/db/schema";
import {
  executePollReplies,
  MAX_NEGOTIATION_TURNS,
} from "../src/inngest/functions/poll-replies";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { type GmailThreadResponse, type GmailThreadMessage } from "../src/lib/gmail";

async function runStage8MultiTurnTests() {
  console.log("==================================================================");
  console.log("   STAGE 8 MULTI-TURN REPLY NEGOTIATION VERIFICATION SUITE       ");
  console.log("==================================================================\n");

  const cleanupDraftIds: string[] = [];
  const cleanupContactIds: string[] = [];
  const cleanupCompanyIds: string[] = [];
  const cleanupCampaignIds: string[] = [];
  const cleanupRunIds: string[] = [];
  const cleanupMailboxIds: string[] = [];
  const cleanupMeetingIds: string[] = [];

  try {
    // ------------------------------------------------------------------
    // Fixture Setup: Org, Mailbox, Research Run with Grounded Facts
    // ------------------------------------------------------------------
    console.log("STEP 0: Setting up test fixtures with grounded company profile...");

    const [existingOrg] = await db.select().from(organization).limit(1);
    let testOrgId = existingOrg?.id;
    if (!testOrgId) {
      testOrgId = nanoid();
      await db.insert(organization).values({
        id: testOrgId,
        name: "Test Negotiation Org",
        slug: `test-neg-org-${Date.now()}`,
      });
    }

    const [existingUser] = await db.select().from(user).limit(1);
    let testUserId = existingUser?.id;
    if (!testUserId) {
      testUserId = nanoid();
      await db.insert(user).values({
        id: testUserId,
        email: `tester-${Date.now()}@scrunity.ai`,
        name: "Test User",
      });
    }

    const mailboxId = nanoid();
    cleanupMailboxIds.push(mailboxId);
    const mailboxEmail = `outreach-${Date.now()}@scrunity-test.com`;

    await db.insert(gtmConnectedMailbox).values({
      id: mailboxId,
      organizationId: testOrgId,
      email: mailboxEmail,
      encryptedRefreshToken: "mock_refresh_token",
      status: "connected",
      connectedBy: testUserId,
    });

    const runId = nanoid();
    cleanupRunIds.push(runId);
    await db.insert(gtmResearchRun).values({
      id: runId,
      organizationId: testOrgId,
      websiteUrl: "https://scrunity.ai",
      companyName: "Scrunity AI",
      companyDescription:
        "Autonomous outbound sales platform that verifies deliverability, enriches contacts, and runs multi-turn qualification negotiation.",
      companySize: "11-50",
      synthesizedProfile: {
        summary:
          "Scrunity replaces manual prospecting by automating multi-step lead research, hard qualification gates, and email deliverability checks.",
        industry: "B2B Sales Software",
        productFocus: "Autonomous SDR Pipelines & Verified Contact Deliverability",
        targetCustomerLanguage:
          "VP of Sales, Heads of Growth, and Sales Operations looking to eliminate bounced emails and save SDR prospecting time.",
        signals: ["Cold email automation", "MX deliverability", "Multi-turn negotiation"],
      },
      contextDoc:
        "Scrunity integrates with Google Workspace, Microsoft 365, and HubSpot. Pricing starts at $499/mo with unlimited qualification checks. Security: SOC2 in-progress.",
      createdBy: testUserId,
    });

    const segmentId = nanoid();
    await db.insert(gtmIcpSegment).values({
      id: segmentId,
      researchRunId: runId,
      name: "B2B SaaS Growth Leaders",
      painPoint: "High cold email bounce rates burning domain reputation",
      criteria: ["B2B SaaS", "High volume cold email"],
      exampleCompanies: [{ name: "Acme Cloud", domain: "acmecloud.io" }],
    });

    const campaignId = nanoid();
    cleanupCampaignIds.push(campaignId);
    await db.insert(gtmOutreachCampaign).values({
      id: campaignId,
      icpSegmentId: segmentId,
      researchRunId: runId,
      status: "in_progress",
      currentStage: "done_for_now",
    });

    console.log("✓ Fixtures created successfully.\n");

    // ------------------------------------------------------------------
    // TEST SCENARIO 1: Full Multi-Turn Negotiation -> Cal.com Booking
    // ------------------------------------------------------------------
    console.log("------------------------------------------------------------------");
    console.log("TEST 1: Multi-Turn Conversation (Question -> Objection -> Agree -> Booking)");
    console.log("------------------------------------------------------------------");

    const company1Id = nanoid();
    cleanupCompanyIds.push(company1Id);
    await db.insert(gtmProspectCompany).values({
      id: company1Id,
      outreachCampaignId: campaignId,
      name: "Acme Cloud Corp",
      domain: "acmecloud.io",
      description: "Cloud infrastructure monitoring platform",
      location: "San Francisco, CA",
    });

    const contact1Id = nanoid();
    cleanupContactIds.push(contact1Id);
    const prospect1Email = `alex.rivers.${Date.now()}@acmecloud.io`;
    await db.insert(gtmContact).values({
      id: contact1Id,
      prospectCompanyId: company1Id,
      name: "Alex Rivers",
      title: "VP of Growth",
      email: prospect1Email,
      emailSource: "pattern_guessed_mx_valid",
      verificationStatus: "mailbox_verified",
    });

    const draft1Id = nanoid();
    cleanupDraftIds.push(draft1Id);
    const thread1Id = `thread-acme-${Date.now()}`;
    const initialColdMsgId = `msg-cold-0-${Date.now()}`;

    await db.insert(gtmEmailDraft).values({
      id: draft1Id,
      contactId: contact1Id,
      outreachCampaignId: campaignId,
      subject: "Quick question on Acme Cloud's outbound pipeline",
      body:
        "Hi Alex,\n\nSaw Acme Cloud is expanding its enterprise tier. Most growth teams struggle with high bounce rates burning domain reputation. Scrunity automates pre-send verification and qualification gates to protect your domain.\n\nWorth a quick 15-min chat next week?",
      status: "sent",
      sentAt: new Date(Date.now() - 3600 * 1000), // sent 1 hour ago
      providerMessageId: initialColdMsgId,
      threadId: thread1Id,
      negotiationTurns: 0,
    });

    // Simulated Gmail Thread State
    const thread1Messages: GmailThreadMessage[] = [
      {
        id: initialColdMsgId,
        threadId: thread1Id,
        internalDate: String(Date.now() - 3600 * 1000),
        payload: {
          headers: [
            { name: "From", value: mailboxEmail },
            { name: "To", value: prospect1Email },
          ],
          body: {
            data: Buffer.from(
              "Hi Alex,\n\nSaw Acme Cloud is expanding its enterprise tier. Most growth teams struggle with high bounce rates burning domain reputation. Scrunity automates pre-send verification and qualification gates to protect your domain.\n\nWorth a quick 15-min chat next week?"
            ).toString("base64url"),
          },
        },
      },
    ];

    const mockThreads = new Map<string, GmailThreadResponse>();
    mockThreads.set(thread1Id, {
      id: thread1Id,
      messages: thread1Messages,
    });

    const sentResponses: Array<{ to: string; subject: string; body: string }> = [];
    const mockSender = async (params: any) => {
      sentResponses.push({
        to: params.to,
        subject: params.subject,
        body: params.body,
      });
      return { id: `msg-sent-${Date.now()}` };
    };

    // --- Turn 1: Prospect asks a question ---
    console.log("\n[Turn 1] Prospect sends a question: 'Does Scrunity integrate with HubSpot or Salesforce?'");
    const turn1ReplyId = `msg-reply-1-${Date.now()}`;
    const turn1ReplyText =
      "Hi, thanks for reaching out. Does Scrunity integrate with HubSpot or our custom CRM? How does the setup work?";
    thread1Messages.push({
      id: turn1ReplyId,
      threadId: thread1Id,
      snippet: turn1ReplyText,
      internalDate: String(Date.now() - 1800 * 1000),
      payload: {
        headers: [
          { name: "From", value: `Alex Rivers <${prospect1Email}>` },
          { name: "To", value: mailboxEmail },
        ],
        body: {
          data: Buffer.from(turn1ReplyText).toString("base64url"),
        },
      },
    });

    const pollResult1 = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });

    console.log(`     Replies detected: ${pollResult1.repliesDetected}, Auto-replies sent: ${pollResult1.autoRepliesSent}`);
    if (pollResult1.autoRepliesSent !== 1) {
      throw new Error(`Expected 1 auto-reply for Turn 1, got ${pollResult1.autoRepliesSent}`);
    }

    const [event1] = await db
      .select()
      .from(gtmEmailEvent)
      .where(and(eq(gtmEmailEvent.emailDraftId, draft1Id), eq(gtmEmailEvent.providerMessageId, turn1ReplyId)));

    console.log(`     Classified Intent: ${event1?.classifiedIntent}`);
    console.log(`     Intent Reasoning: ${event1?.metadata?.intentReasoning}`);
    console.log(`     Turn Number: ${event1?.metadata?.turnNumber}`);
    console.log(`     Agent Follow-Up 1 Response:\n     "${event1?.metadata?.agentReplyBody}"`);

    if (event1?.classifiedIntent !== "question") {
      throw new Error(`Expected intent 'question', got '${event1?.classifiedIntent}'`);
    }
    if (!event1?.metadata?.agentReplyBody?.includes("http")) {
      throw new Error("Agent follow-up does not include booking link!");
    }

    // Add agent's Turn 1 sent message into the Gmail thread
    const turn1AgentMsgId = `msg-agent-1-${Date.now()}`;
    thread1Messages.push({
      id: turn1AgentMsgId,
      threadId: thread1Id,
      internalDate: String(Date.now() - 1500 * 1000),
      payload: {
        headers: [
          { name: "From", value: mailboxEmail },
          { name: "To", value: prospect1Email },
        ],
        body: {
          data: Buffer.from(event1.metadata.agentReplyBody).toString("base64url"),
        },
      },
    });

    // Idempotency verification: re-polling immediately without new messages should do NOTHING
    const rePoll1 = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });
    console.log(`     [Idempotency Check] Polled again without new messages -> Auto-replies sent: ${rePoll1.autoRepliesSent}`);
    if (rePoll1.autoRepliesSent !== 0) {
      throw new Error("Idempotency violation! Agent responded twice to the same turn!");
    }

    // --- Turn 2: Prospect raises an objection ---
    console.log("\n[Turn 2] Prospect raises an objection: 'We already use Apollo for finding contacts...'");
    const turn2ReplyId = `msg-reply-2-${Date.now()}`;
    const turn2ReplyText =
      "We already use Apollo and manual research for our contacts, so I am not sure we need another tool.";
    thread1Messages.push({
      id: turn2ReplyId,
      threadId: thread1Id,
      snippet: turn2ReplyText,
      internalDate: String(Date.now() - 900 * 1000),
      payload: {
        headers: [
          { name: "From", value: `Alex Rivers <${prospect1Email}>` },
          { name: "To", value: mailboxEmail },
        ],
        body: {
          data: Buffer.from(turn2ReplyText).toString("base64url"),
        },
      },
    });

    const pollResult2 = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });

    console.log(`     Replies detected: ${pollResult2.repliesDetected}, Auto-replies sent: ${pollResult2.autoRepliesSent}`);
    if (pollResult2.autoRepliesSent !== 1) {
      throw new Error(`Expected 1 auto-reply for Turn 2, got ${pollResult2.autoRepliesSent}`);
    }

    const [event2] = await db
      .select()
      .from(gtmEmailEvent)
      .where(and(eq(gtmEmailEvent.emailDraftId, draft1Id), eq(gtmEmailEvent.providerMessageId, turn2ReplyId)));

    console.log(`     Classified Intent: ${event2?.classifiedIntent}`);
    console.log(`     Turn Number: ${event2?.metadata?.turnNumber}`);
    console.log(`     Agent Follow-Up 2 Response:\n     "${event2?.metadata?.agentReplyBody}"`);

    // Add agent's Turn 2 sent message into the Gmail thread
    const turn2AgentMsgId = `msg-agent-2-${Date.now()}`;
    thread1Messages.push({
      id: turn2AgentMsgId,
      threadId: thread1Id,
      internalDate: String(Date.now() - 600 * 1000),
      payload: {
        headers: [
          { name: "From", value: mailboxEmail },
          { name: "To", value: prospect1Email },
        ],
        body: {
          data: Buffer.from(event2?.metadata?.agentReplyBody || "").toString("base64url"),
        },
      },
    });

    // --- Turn 3: Prospect agrees to talk ---
    console.log("\n[Turn 3] Prospect agrees: 'Makes sense. Where can I grab 15 minutes?'");
    const turn3ReplyId = `msg-reply-3-${Date.now()}`;
    const turn3ReplyText =
      "That makes sense regarding pre-send qualification. Where can I grab 15 minutes next week?";
    thread1Messages.push({
      id: turn3ReplyId,
      threadId: thread1Id,
      snippet: turn3ReplyText,
      internalDate: String(Date.now() - 300 * 1000),
      payload: {
        headers: [
          { name: "From", value: `Alex Rivers <${prospect1Email}>` },
          { name: "To", value: mailboxEmail },
        ],
        body: {
          data: Buffer.from(turn3ReplyText).toString("base64url"),
        },
      },
    });

    const pollResult3 = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });

    console.log(`     Replies detected: ${pollResult3.repliesDetected}, Auto-replies sent: ${pollResult3.autoRepliesSent}`);
    if (pollResult3.autoRepliesSent !== 1) {
      throw new Error(`Expected 1 auto-reply for Turn 3, got ${pollResult3.autoRepliesSent}`);
    }

    const [event3] = await db
      .select()
      .from(gtmEmailEvent)
      .where(and(eq(gtmEmailEvent.emailDraftId, draft1Id), eq(gtmEmailEvent.providerMessageId, turn3ReplyId)));

    console.log(`     Classified Intent: ${event3?.classifiedIntent}`);
    console.log(`     Turn Number: ${event3?.metadata?.turnNumber}`);
    console.log(`     Agent Follow-Up 3 Response:\n     "${event3?.metadata?.agentReplyBody}"`);

    if (event3?.classifiedIntent !== "interested") {
      throw new Error(`Expected intent 'interested' for Turn 3, got '${event3?.classifiedIntent}'`);
    }

    // Add agent's Turn 3 sent message into thread
    const turn3AgentMsgId = `msg-agent-3-${Date.now()}`;
    thread1Messages.push({
      id: turn3AgentMsgId,
      threadId: thread1Id,
      internalDate: String(Date.now() - 100 * 1000),
      payload: {
        headers: [
          { name: "From", value: mailboxEmail },
          { name: "To", value: prospect1Email },
        ],
        body: {
          data: Buffer.from(event3?.metadata?.agentReplyBody || "").toString("base64url"),
        },
      },
    });

    // --- Webhook: Real Cal.com Booking Confirmed ---
    console.log("\n[Webhook] Cal.com Webhook receives BOOKING_CREATED for Alex Rivers...");
    const meetingId = nanoid();
    cleanupMeetingIds.push(meetingId);
    await db.insert(gtmMeeting).values({
      id: meetingId,
      contactId: contact1Id,
      outreachCampaignId: campaignId,
      scheduledAt: new Date(Date.now() + 86400 * 3 * 1000), // 3 days in future
      status: "booked",
      calcomBookingUid: `booking-cal-${Date.now()}`,
      attendeeEmail: prospect1Email,
    });
    console.log(`     Meeting confirmed booked in gtmMeeting [ID: ${meetingId}]`);

    // --- Post-booking message test ---
    console.log("\n[Post-Booking] Prospect sends follow-up: 'All booked for Wednesday!'");
    const postBookingMsgId = `msg-post-book-${Date.now()}`;
    thread1Messages.push({
      id: postBookingMsgId,
      threadId: thread1Id,
      snippet: "All booked for Wednesday! See you then.",
      internalDate: String(Date.now()),
      payload: {
        headers: [
          { name: "From", value: `Alex Rivers <${prospect1Email}>` },
          { name: "To", value: mailboxEmail },
        ],
        body: {
          data: Buffer.from("All booked for Wednesday! See you then.").toString("base64url"),
        },
      },
    });

    const pollResultPostBook = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });
    console.log(`     Auto-replies sent after meeting booked: ${pollResultPostBook.autoRepliesSent}`);
    if (pollResultPostBook.autoRepliesSent !== 0) {
      throw new Error("Loop continued after confirmed booking! Auto-reply should have been suppressed.");
    }
    console.log("✓ SCENARIO 1 PASSED: Multi-turn negotiation cleanly resolved into booked meeting and stopped.\n");

    // ------------------------------------------------------------------
    // TEST SCENARIO 2: Hard Turn Cap Exhaustion
    // ------------------------------------------------------------------
    console.log("------------------------------------------------------------------");
    console.log("TEST 2: Hard Turn Cap Exhaustion (Max 3 turns reached -> Stop & Flag)");
    console.log("------------------------------------------------------------------");

    const contact2Id = nanoid();
    cleanupContactIds.push(contact2Id);
    const prospect2Email = `jordan.lee.${Date.now()}@turncap.io`;
    await db.insert(gtmContact).values({
      id: contact2Id,
      prospectCompanyId: company1Id,
      name: "Jordan Lee",
      title: "CTO",
      email: prospect2Email,
      emailSource: "pattern_guessed_mx_valid",
      verificationStatus: "mailbox_verified",
    });

    const draft2Id = nanoid();
    cleanupDraftIds.push(draft2Id);
    const thread2Id = `thread-turncap-${Date.now()}`;
    const coldMsg2Id = `msg-cold-2-${Date.now()}`;

    await db.insert(gtmEmailDraft).values({
      id: draft2Id,
      contactId: contact2Id,
      outreachCampaignId: campaignId,
      subject: "Quick question on outbound deliverability",
      body: "Initial cold outreach",
      status: "sent",
      sentAt: new Date(Date.now() - 7200 * 1000),
      providerMessageId: coldMsg2Id,
      threadId: thread2Id,
      negotiationTurns: 3,
    });

    // Simulate thread that already had 3 outbound agent replies
    const thread2Messages: GmailThreadMessage[] = [
      {
        id: coldMsg2Id,
        threadId: thread2Id,
        internalDate: String(Date.now() - 7200 * 1000),
        payload: { headers: [{ name: "From", value: mailboxEmail }] },
      },
      {
        id: "p-reply-1",
        threadId: thread2Id,
        internalDate: String(Date.now() - 6000 * 1000),
        payload: { headers: [{ name: "From", value: prospect2Email }] },
      },
      {
        id: "a-reply-1",
        threadId: thread2Id,
        internalDate: String(Date.now() - 5000 * 1000),
        payload: { headers: [{ name: "From", value: mailboxEmail }] },
      },
      {
        id: "p-reply-2",
        threadId: thread2Id,
        internalDate: String(Date.now() - 4000 * 1000),
        payload: { headers: [{ name: "From", value: prospect2Email }] },
      },
      {
        id: "a-reply-2",
        threadId: thread2Id,
        internalDate: String(Date.now() - 3000 * 1000),
        payload: { headers: [{ name: "From", value: mailboxEmail }] },
      },
      {
        id: "p-reply-3",
        threadId: thread2Id,
        internalDate: String(Date.now() - 2000 * 1000),
        payload: { headers: [{ name: "From", value: prospect2Email }] },
      },
      {
        id: "a-reply-3",
        threadId: thread2Id,
        internalDate: String(Date.now() - 1000 * 1000),
        payload: { headers: [{ name: "From", value: mailboxEmail }] },
      },
    ];

    // Prospect sends 4th reply
    const turn4ReplyId = `msg-reply-4-${Date.now()}`;
    const turn4Text = "What about SOC2 compliance? Can you send me the full audit report?";
    thread2Messages.push({
      id: turn4ReplyId,
      threadId: thread2Id,
      snippet: turn4Text,
      internalDate: String(Date.now()),
      payload: {
        headers: [
          { name: "From", value: `Jordan Lee <${prospect2Email}>` },
          { name: "To", value: mailboxEmail },
        ],
        body: { data: Buffer.from(turn4Text).toString("base64url") },
      },
    });

    mockThreads.set(thread2Id, {
      id: thread2Id,
      messages: thread2Messages,
    });

    console.log(`     Simulating incoming 4th reply after ${MAX_NEGOTIATION_TURNS} outbound turns...`);
    const pollResultTurnCap = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });

    console.log(`     Replies detected: ${pollResultTurnCap.repliesDetected}, Auto-replies sent: ${pollResultTurnCap.autoRepliesSent}`);
    if (pollResultTurnCap.autoRepliesSent !== 0) {
      throw new Error(`Turn cap violation! Sent auto-reply beyond ${MAX_NEGOTIATION_TURNS} turns.`);
    }

    const [updatedDraft2] = await db
      .select()
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.id, draft2Id));

    console.log(`     Draft Error State: "${updatedDraft2?.errorMessage}"`);
    if (!updatedDraft2?.errorMessage?.includes("reached maximum negotiation turns")) {
      throw new Error(`Draft was not flagged with expected turn-cap error message! Found: ${updatedDraft2?.errorMessage}`);
    }

    console.log("✓ SCENARIO 2 PASSED: Hard turn cap enforced; stopped cleanly and visibly flagged for human review.\n");

    // ------------------------------------------------------------------
    // TEST SCENARIO 3: Mid-Negotiation Explicit Decline (not_interested)
    // ------------------------------------------------------------------
    console.log("------------------------------------------------------------------");
    console.log("TEST 3: Mid-Negotiation Explicit Decline (Stop permanently)");
    console.log("------------------------------------------------------------------");

    const contact3Id = nanoid();
    cleanupContactIds.push(contact3Id);
    const prospect3Email = `taylor.swift.${Date.now()}@decline.io`;
    await db.insert(gtmContact).values({
      id: contact3Id,
      prospectCompanyId: company1Id,
      name: "Taylor Swift",
      title: "VP Sales",
      email: prospect3Email,
      emailSource: "pattern_guessed_mx_valid",
      verificationStatus: "mailbox_verified",
    });

    const draft3Id = nanoid();
    cleanupDraftIds.push(draft3Id);
    const thread3Id = `thread-decline-${Date.now()}`;
    const coldMsg3Id = `msg-cold-3-${Date.now()}`;

    await db.insert(gtmEmailDraft).values({
      id: draft3Id,
      contactId: contact3Id,
      outreachCampaignId: campaignId,
      subject: "Quick question on outbound deliverability",
      body: "Initial cold outreach",
      status: "sent",
      sentAt: new Date(Date.now() - 3600 * 1000),
      providerMessageId: coldMsg3Id,
      threadId: thread3Id,
      negotiationTurns: 1,
    });

    const declineMsgId = `msg-decline-${Date.now()}`;
    const declineText = "Please remove me from your list. We are not interested, do not email again.";

    const thread3Messages: GmailThreadMessage[] = [
      {
        id: coldMsg3Id,
        threadId: thread3Id,
        internalDate: String(Date.now() - 3600 * 1000),
        payload: { headers: [{ name: "From", value: mailboxEmail }] },
      },
      {
        id: "turn1-prospect",
        threadId: thread3Id,
        internalDate: String(Date.now() - 2400 * 1000),
        payload: { headers: [{ name: "From", value: prospect3Email }] },
      },
      {
        id: "turn1-agent",
        threadId: thread3Id,
        internalDate: String(Date.now() - 1800 * 1000),
        payload: { headers: [{ name: "From", value: mailboxEmail }] },
      },
      {
        id: declineMsgId,
        threadId: thread3Id,
        snippet: declineText,
        internalDate: String(Date.now()),
        payload: {
          headers: [
            { name: "From", value: `Taylor Swift <${prospect3Email}>` },
            { name: "To", value: mailboxEmail },
          ],
          body: { data: Buffer.from(declineText).toString("base64url") },
        },
      },
    ];

    mockThreads.set(thread3Id, {
      id: thread3Id,
      messages: thread3Messages,
    });

    const pollResultDecline = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });

    console.log(`     Replies detected: ${pollResultDecline.repliesDetected}, Auto-replies sent: ${pollResultDecline.autoRepliesSent}`);
    if (pollResultDecline.autoRepliesSent !== 0) {
      throw new Error("Decline violation! Sent follow-up to prospect who explicitly declined.");
    }

    const [declineEvent] = await db
      .select()
      .from(gtmEmailEvent)
      .where(and(eq(gtmEmailEvent.emailDraftId, draft3Id), eq(gtmEmailEvent.providerMessageId, declineMsgId)));

    console.log(`     Classified Intent: "${declineEvent?.classifiedIntent}"`);
    if (declineEvent?.classifiedIntent !== "not_interested") {
      throw new Error(`Expected intent 'not_interested', got '${declineEvent?.classifiedIntent}'`);
    }

    const [updatedDraft3] = await db
      .select()
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.id, draft3Id));

    console.log(`     Draft Error Message: "${updatedDraft3?.errorMessage}"`);
    if (!updatedDraft3?.errorMessage?.includes("not_interested")) {
      throw new Error(`Draft was not updated with decline note! Found: ${updatedDraft3?.errorMessage}`);
    }

    // Ensure re-polling thread 3 never sends an email
    const rePoll3 = await executePollReplies(mailboxId, undefined, {
      mockThreads,
      mockSender,
      forcePoll: true,
    });
    console.log(`     [Re-Poll Decline Check] Auto-replies sent: ${rePoll3.autoRepliesSent}`);
    if (rePoll3.autoRepliesSent !== 0) {
      throw new Error("Re-polling sent email after decline!");
    }

    console.log("✓ SCENARIO 3 PASSED: Explicit decline permanently stopped negotiation loop.\n");

    console.log("==================================================================");
    console.log("   ALL MULTI-TURN NEGOTIATION ACCEPTANCE CRITERIA VERIFIED        ");
    console.log("==================================================================");
  } catch (err) {
    console.error("Test Suite Failed with error:", err);
    throw err;
  } finally {
    console.log("\nCleaning up test database rows...");
    for (const id of cleanupMeetingIds) {
      await db.delete(gtmMeeting).where(eq(gtmMeeting.id, id));
    }
    for (const id of cleanupDraftIds) {
      await db.delete(gtmEmailDraft).where(eq(gtmEmailDraft.id, id));
    }
    for (const id of cleanupContactIds) {
      await db.delete(gtmContact).where(eq(gtmContact.id, id));
    }
    for (const id of cleanupCompanyIds) {
      await db.delete(gtmProspectCompany).where(eq(gtmProspectCompany.id, id));
    }
    for (const id of cleanupCampaignIds) {
      await db.delete(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, id));
    }
    for (const id of cleanupRunIds) {
      await db.delete(gtmResearchRun).where(eq(gtmResearchRun.id, id));
    }
    for (const id of cleanupMailboxIds) {
      await db.delete(gtmConnectedMailbox).where(eq(gtmConnectedMailbox.id, id));
    }
    console.log("Cleanup complete.");
  }
}

runStage8MultiTurnTests()
  .then(() => {
    console.log("\n✓ Test run complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n✗ Test run failed:", err);
    process.exit(1);
  });
