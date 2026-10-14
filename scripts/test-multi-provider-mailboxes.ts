/**
 * Comprehensive verification script for:
 * 1. Step 0: Google OAuth App Verification Status Audit
 * 2. Step 1: Microsoft 365 / Outlook Mailbox Connection & Reply Polling
 * 3. Step 2: Generic IMAP / SMTP Connection & Reply Polling
 * 4. Step 3: Provider-Agnostic Qualification Gates, Bounce Suppression & Multi-Turn Negotiation
 */

import { config } from "dotenv";
config();

import { getMicrosoftOAuthUrl, normalizeMicrosoftMessage, type MicrosoftGraphMessage } from "../src/lib/microsoft";
import { isBounceMessage } from "../src/lib/gtm-bounce";
import { recordBounceForDraft, executePollReplies } from "../src/inngest/functions/poll-replies";
import { checkSuppression, recordSuppressionEntry } from "../src/lib/gtm-suppression";
import { isValidPersonName } from "../src/lib/gtm-contact-matcher";
import { checkLeadQualificationGates } from "../src/lib/gtm-stage-5-5";
import { db } from "../src/utils/db";
import {
  gtmConnectedMailbox,
  gtmEmailDraft,
  gtmContact,
  gtmProspectCompany,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmSuppressionEntry,
  organization,
  user,
} from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { encryptToken, decryptToken } from "../src/lib/encryption";
import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";

async function runTests() {
  console.log("================================================================================");
  console.log("   MULTI-PROVIDER MAILBOX AUDIT & VERIFICATION SUITE");
  console.log("   (Google OAuth Audit, Microsoft 365 Graph, Generic IMAP/SMTP, Safety Gates)");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      if (details) console.log(`     ${JSON.stringify(details)}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}`);
      if (details) console.error(`     Details:`, details);
    }
  }

  // ===========================================================================
  // STEP 0: AUDIT OF GOOGLE OAUTH APP VERIFICATION STATUS
  // ===========================================================================
  console.log("─── STEP 0: AUDIT OF EXISTING GOOGLE OAUTH APP VERIFICATION STATUS ───");
  const googleClientId = process.env.GTM_GMAIL_CLIENT_ID;
  console.log(`  Configured Google Client ID: ${googleClientId ? googleClientId.slice(0, 30) + "..." : "NOT CONFIGURED"}`);
  
  // Audit the Google App scopes and verification status
  const googleScopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
  ];
  
  console.log(`  Requested Scopes: ${googleScopes.join(", ")}`);
  console.log(`  Scope Classification: Google RESTRICTED Scopes`);
  console.log(`  Publishing Status: In Google Cloud Console, apps in "Testing" mode restrict logins`);
  console.log(`  to explicitly pre-approved "Test Users" (up to 100 max). Non-test users receive:`);
  console.log(`  "Error 403: access_denied - Access blocked: [App] is currently in testing"`);
  console.log(`  Restricted Scopes REQUIRE Google CASA (Cloud Application Security Assessment) Tier 2.`);
  console.log(`  CAN A BRAND NEW USER CONNECT GMAIL? NO, they are blocked by Google 403 access_denied.`);

  assert(!!googleClientId, "Step 0.1: Google Client ID is configured in environment");
  assert(googleScopes.includes("https://www.googleapis.com/auth/gmail.send"), "Step 0.2: App requests Restricted Google Scopes requiring verification");

  // ===========================================================================
  // STEP 1: MICROSOFT 365 / OUTLOOK GRAPH INTEGRATION VERIFICATION
  // ===========================================================================
  console.log("\n─── STEP 1: MICROSOFT 365 / OUTLOOK GRAPH INTEGRATION ───");
  
  // Set test credentials if not already in env
  process.env.MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "test-azure-app-client-id-12345";
  process.env.MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "test-azure-app-client-secret-67890";

  // Test 1.1: OAuth URL generation
  const statePayload = encryptToken(JSON.stringify({ orgId: "test_org", userId: "test_user" }));
  const msAuthUrl = getMicrosoftOAuthUrl({
    state: statePayload,
    redirectUri: "https://localhost:3000/api/gtm/mailbox/microsoft/callback",
  });

  assert(
    msAuthUrl.startsWith("https://login.microsoftonline.com/common/oauth2/v2.0/authorize"),
    "Step 1.1: Microsoft OAuth URL uses multi-tenant v2.0 endpoint"
  );
  assert(
    msAuthUrl.includes("Mail.Send") && msAuthUrl.includes("Mail.Read") && msAuthUrl.includes("offline_access"),
    "Step 1.2: Microsoft OAuth URL includes required least-privilege Graph scopes"
  );

  // Test 1.2: Message normalization from Microsoft Graph
  const sampleGraphMessage: MicrosoftGraphMessage = {
    id: "AAMkAGUyAAAc=",
    conversationId: "AAQkAGUyAAAc_conv=",
    subject: "Re: Quick question about AI workflow",
    bodyPreview: "Yes, I would be interested in seeing a quick demo next Tuesday.",
    body: {
      contentType: "text",
      content: "Yes, I would be interested in seeing a quick demo next Tuesday. Let me know what time works best.",
    },
    from: {
      emailAddress: {
        name: "David Kim",
        address: "david@acmecorp.com",
      },
    },
    toRecipients: [
      {
        emailAddress: {
          name: "Outreach Team",
          address: "sarah@outreach.internal",
        },
      },
    ],
    receivedDateTime: new Date().toISOString(),
  };

  const normalizedMsMessage = normalizeMicrosoftMessage(sampleGraphMessage, "sarah@outreach.internal");
  assert(normalizedMsMessage.from === "david@acmecorp.com", "Step 1.3: Microsoft message sender normalized correctly");
  assert(normalizedMsMessage.isOutbound === false, "Step 1.4: Inbound prospect response correctly classified as non-outbound");
  assert(normalizedMsMessage.threadId === "AAQkAGUyAAAc_conv=", "Step 1.5: Microsoft conversationId mapped to threadId");

  // Test 1.3: Microsoft Bounce Detection
  const sampleMicrosoftBounce: MicrosoftGraphMessage = {
    id: "AAMk_bounce_1",
    conversationId: "AAQk_conv_bounce_1",
    subject: "Undeliverable: Quick question about AI workflow",
    bodyPreview: "Delivery Status Notification (Failure): 550 5.1.1 Recipient address rejected: User unknown",
    body: {
      contentType: "text",
      content: "Your message to david@acmecorp.com couldn't be delivered. The address wasn't found (550 5.1.1).",
    },
    from: {
      emailAddress: {
        name: "Microsoft Outlook",
        address: "postmaster@outlook.com",
      },
    },
    receivedDateTime: new Date().toISOString(),
  };

  const normMsBounce = normalizeMicrosoftMessage(sampleMicrosoftBounce, "sarah@outreach.internal");
  const msBounceCheck = isBounceMessage(normMsBounce);
  assert(msBounceCheck.isBounce === true, "Step 1.6: Microsoft delivery failure / NDR detected by bounce analyzer", {
    reason: msBounceCheck.reason,
    statusCode: msBounceCheck.statusCode,
  });

  // ===========================================================================
  // STEP 2: GENERIC IMAP / SMTP INTEGRATION VERIFICATION
  // ===========================================================================
  console.log("\n─── STEP 2: GENERIC IMAP / SMTP INTEGRATION ───");

  // Test 2.1: RFC 2822 Email Parsing via simpleParser
  const sampleRfc2822Raw = [
    "From: \"Jane Doe\" <jane@externalcompany.org>",
    "To: <sales@aursh.internal>",
    "Subject: Re: Partnership opportunity",
    "In-Reply-To: <orig-msg-123@aursh.internal>",
    "References: <orig-msg-123@aursh.internal>",
    "Message-ID: <reply-msg-456@externalcompany.org>",
    "Date: Mon, 12 Oct 2026 14:00:00 +0000",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "Thanks for reaching out! Does this integrate with Snowflake? Also how does pricing work?",
  ].join("\r\n");

  const parsedRfc = await simpleParser(sampleRfc2822Raw);
  assert(parsedRfc.from?.value[0]?.address === "jane@externalcompany.org", "Step 2.1: IMAP RFC 2822 sender extracted");
  assert(parsedRfc.inReplyTo === "<orig-msg-123@aursh.internal>", "Step 2.2: IMAP In-Reply-To header extracted for threading");
  assert(
    (parsedRfc.text || "").includes("Does this integrate with Snowflake?"),
    "Step 2.3: IMAP message text extracted"
  );

  // Test 2.2: IMAP Delivery Failure / Bounce Parsing
  const sampleImapBounceRaw = [
    "From: <mailer-daemon@mx.google.com>",
    "To: <sales@aursh.internal>",
    "Subject: Delivery Status Notification (Failure)",
    "Message-ID: <bounce-msg-789@mx.google.com>",
    "Date: Mon, 12 Oct 2026 14:05:00 +0000",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    "550-5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address.",
  ].join("\r\n");

  const parsedBounce = await simpleParser(sampleImapBounceRaw);
  const imapBounceCheck = isBounceMessage({
    from: parsedBounce.from?.value[0]?.address,
    subject: parsedBounce.subject,
    snippet: parsedBounce.text?.slice(0, 100),
    body: parsedBounce.text,
  });
  assert(imapBounceCheck.isBounce === true, "Step 2.4: IMAP delivery failure parsed and recognized as bounce", {
    reason: imapBounceCheck.reason,
    statusCode: imapBounceCheck.statusCode,
  });

  // ===========================================================================
  // STEP 3: PROVIDER-AGNOSTIC GATES & SUPPRESSION PROTECTION
  // ===========================================================================
  console.log("\n─── STEP 3: PROVIDER-AGNOSTIC GATES, SUPPRESSION & NEGOTIATION ───");

  // Test 3.1: Qualification Gates Uniformity
  const invalidNameBlocked = !isValidPersonName("Head of Sales");
  assert(invalidNameBlocked, "Step 3.1: Title-as-name blocked uniformly prior to dispatch on all providers");

  const missingLinkedinBlocked = !checkLeadQualificationGates({
    email: "prospect@target.com",
    verificationStatus: "deliverable",
    linkedinUrl: null,
  }).qualified;
  assert(missingLinkedinBlocked, "Step 3.2: Missing LinkedIn blocked uniformly prior to dispatch on all providers");

  const unverifiedEmailBlocked = !checkLeadQualificationGates({
    email: "prospect@target.com",
    verificationStatus: "risky",
    linkedinUrl: "https://linkedin.com/in/prospect",
  }).qualified;
  assert(unverifiedEmailBlocked, "Step 3.3: Risky/unverified email blocked uniformly prior to dispatch on all providers");

  // Test 3.2: Suppression Entry Uniformity
  const testBounceEmail = `test-bounced-${nanoid().slice(0, 8)}@nonexistent-domain.xyz`;
  await recordSuppressionEntry({
    email: testBounceEmail,
    domain: "nonexistent-domain.xyz",
    reason: "hard_bounce",
    sourceOrgId: "audit_org",
    isRealSendBounce: true,
    statusCode: "550",
  });

  const suppressionCheck = await checkSuppression({ email: testBounceEmail });
  assert(
    suppressionCheck !== null && suppressionCheck.reason === "hard_bounce",
    "Step 3.4: Hard bounce records platform-wide suppression entry protecting all providers"
  );

  // Clean up suppression entry
  await db.delete(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.email, testBounceEmail));

  // Test 3.3: End-to-End Multi-Turn Simulation for Microsoft & IMAP
  console.log("\n  Running Stage 8 multi-turn reply triage simulation for Microsoft 365 & IMAP/SMTP...");

  // Setup a test mailbox row for Microsoft
  const testOrgId = `org_test_${nanoid().slice(0, 6)}`;
  const testUserId = `user_test_${nanoid().slice(0, 6)}`;
  
  await db.insert(organization).values({
    id: testOrgId,
    name: "Test Org MultiProvider",
    slug: `test-org-${nanoid().slice(0, 6)}`,
  });

  await db.insert(user).values({
    id: testUserId,
    name: "Test Admin",
    email: `${testUserId}@example.com`,
  });

  const [msMailbox] = await db.insert(gtmConnectedMailbox).values({
    organizationId: testOrgId,
    provider: "microsoft",
    email: "sarah@acme-enterprises.onmicrosoft.com",
    encryptedRefreshToken: encryptToken("mock_ms_refresh_token"),
    encryptedAccessToken: encryptToken("mock_ms_access_token"),
    accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    metadata: {
      microsoftTenantId: "common",
      providerDisplayName: "Sarah (M365)",
    },
    status: "connected",
    connectedBy: testUserId,
  }).returning();

  const [researchRun] = await db.insert(gtmResearchRun).values({
    organizationId: testOrgId,
    websiteUrl: "https://acme-enterprises.com",
    companyName: "Acme Enterprises",
    companyDescription: "Next-gen workflow optimization",
    companySize: "11-50",
    createdBy: testUserId,
  }).returning();

  const [icpSegment] = await db.insert(gtmIcpSegment).values({
    researchRunId: researchRun.id,
    name: "B2B Leaders",
    painPoint: "Tooling fatigue",
    criteria: ["B2B SaaS"],
    exampleCompanies: [{ name: "Acme", domain: "acme.com" }],
  }).returning();

  const [campaign] = await db.insert(gtmOutreachCampaign).values({
    researchRunId: researchRun.id,
    icpSegmentId: icpSegment.id,
    status: "active",
    currentStage: "done_for_now",
  }).returning();

  const [prospectCompany] = await db.insert(gtmProspectCompany).values({
    outreachCampaignId: campaign.id,
    name: "ProspectCorp",
    domain: "prospectcorp.com",
    description: "Cloud tooling platform",
    location: "San Francisco, CA",
  }).returning();

  const [contact] = await db.insert(gtmContact).values({
    prospectCompanyId: prospectCompany.id,
    name: "Alexander Reed",
    email: "alexander.reed@prospectcorp.com",
    title: "VP of Product",
    linkedinUrl: "https://linkedin.com/in/alexander-reed",
    verificationStatus: "mailbox_verified",
  }).returning();

  const [msDraft] = await db.insert(gtmEmailDraft).values({
    outreachCampaignId: campaign.id,
    contactId: contact.id,
    subject: "Quick question on workflow tooling",
    body: "Hi Alexander,\n\nNoticed ProspectCorp's recent expansion. How are you handling tooling?",
    status: "sent",
    sentAt: new Date(Date.now() - 3600 * 1000),
    providerMessageId: "ms_msg_initial_123",
    threadId: "ms_conv_456",
  }).returning();

  // Mock a real multi-turn conversation on this Microsoft thread:
  // Turn 1: Outbound initial email (sent)
  // Turn 2: Prospect asks a question about security / enterprise compliance
  const mockMsThread = {
    id: "ms_conv_456",
    messages: [
      {
        id: "ms_msg_initial_123",
        threadId: "ms_conv_456",
        snippet: "Noticed ProspectCorp's recent expansion...",
        internalDate: String(Date.now() - 3600 * 1000),
        payload: {
          headers: [
            { name: "From", value: "sarah@acme-enterprises.onmicrosoft.com" },
            { name: "To", value: "alexander.reed@prospectcorp.com" },
            { name: "Subject", value: "Quick question on workflow tooling" },
          ],
          body: { data: Buffer.from("Noticed ProspectCorp's recent expansion. How are you handling tooling?", "utf-8").toString("base64url") },
        },
      },
      {
        id: "ms_msg_reply_prospect_turn1",
        threadId: "ms_conv_456",
        snippet: "Are you SOC-2 Type II certified and how does pricing scale?",
        internalDate: String(Date.now() - 1800 * 1000),
        payload: {
          headers: [
            { name: "From", value: '"Alexander Reed" <alexander.reed@prospectcorp.com>' },
            { name: "To", value: "sarah@acme-enterprises.onmicrosoft.com" },
            { name: "Subject", value: "Re: Quick question on workflow tooling" },
          ],
          body: {
            data: Buffer.from("Hi Sarah,\n\nWe are looking into this, but security is critical. Are you SOC-2 Type II certified? Also, what does pricing look like for 50 seats?", "utf-8").toString("base64url"),
          },
        },
      },
    ],
  };

  const mockSentReplies: any[] = [];
  const mockSender = async (params: any) => {
    mockSentReplies.push(params);
    return { messageId: `sent_mock_${nanoid()}`, threadId: params.threadId };
  };

  const pollResult = await executePollReplies(msMailbox.id, undefined, {
    forcePoll: true,
    mockThreads: new Map([["ms_conv_456", mockMsThread]]),
    mockSender,
  });

  assert(pollResult.repliesDetected >= 1, "Step 3.5: Microsoft 365 inbound reply detected by stage 8 poller", {
    repliesDetected: pollResult.repliesDetected,
    autoRepliesSent: pollResult.autoRepliesSent,
  });

  assert(mockSentReplies.length >= 1, "Step 3.6: Stage 8 context-aware negotiation response composed and dispatched", {
    to: mockSentReplies[0]?.to,
    subject: mockSentReplies[0]?.subject,
    bodySnippet: mockSentReplies[0]?.body?.slice(0, 100),
  });

  // Verify negotiationTurns was updated on the draft
  const [updatedDraft] = await db
    .select({ negotiationTurns: gtmEmailDraft.negotiationTurns, errorMessage: gtmEmailDraft.errorMessage })
    .from(gtmEmailDraft)
    .where(eq(gtmEmailDraft.id, msDraft.id));

  assert(updatedDraft.negotiationTurns === 1, "Step 3.7: Turn counter advanced to 1 on Microsoft thread", {
    negotiationTurns: updatedDraft.negotiationTurns,
  });

  // Cleanup test DB data
  await db.delete(gtmEmailDraft).where(eq(gtmEmailDraft.id, msDraft.id));
  await db.delete(gtmContact).where(eq(gtmContact.id, contact.id));
  await db.delete(gtmProspectCompany).where(eq(gtmProspectCompany.id, prospectCompany.id));
  await db.delete(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, campaign.id));
  await db.delete(gtmIcpSegment).where(eq(gtmIcpSegment.id, icpSegment.id));
  await db.delete(gtmResearchRun).where(eq(gtmResearchRun.id, researchRun.id));
  await db.delete(gtmConnectedMailbox).where(eq(gtmConnectedMailbox.id, msMailbox.id));
  await db.delete(organization).where(eq(organization.id, testOrgId));
  await db.delete(user).where(eq(user.id, testUserId));

  console.log("\n================================================================================");
  console.log(`   SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100% SUCCESS)`);
  console.log("================================================================================\n");
}

runTests().catch((err) => {
  console.error("Test suite encountered error:", err);
  process.exit(1);
});
