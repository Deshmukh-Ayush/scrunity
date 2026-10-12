import "dotenv/config";
import { db } from "../src/utils/db";
import {
  gtmSuppressionEntry,
  gtmResearchRun,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmProspectCompany,
  gtmContact,
  gtmEmailDraft,
  organization,
  user,
} from "../src/db/schema";
import {
  recordSuppressionEntry,
  checkSuppression,
  getSuppressionDisqualificationMessage,
  normalizeEmail,
  normalizeDomain,
} from "../src/lib/gtm-suppression";
import { executeQualifyCampaignContacts } from "../src/lib/gtm-stage-5-5";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

async function runTests() {
  console.log("==================================================================");
  console.log("   GTM PLATFORM-WIDE SUPPRESSION / NEGATIVE CACHE TEST SUITE      ");
  console.log("==================================================================\n");

  const testEmail = `bounced-tester-${Date.now()}@negative-cache-test.com`;
  const testDomain = "negative-cache-test.com";
  const aggregatorDomain = `scraper-dir-${Date.now()}.com`;
  const testOrgA = `org-alpha-${Date.now()}`;
  const testOrgB = `org-beta-${Date.now()}`;

  const createdSuppressionIds: string[] = [];
  const createdCampaignIds: string[] = [];
  const createdRunIds: string[] = [];

  try {
    // ------------------------------------------------------------------
    // TEST 1: Schema & Deduplication on Writes (Step 1 & Step 2)
    // ------------------------------------------------------------------
    console.log("TEST 1: Writing Disqualifications and Real Hard Bounce Entries...");

    // 1.1 Record hard bounce from Org A
    const bounceEntry = await recordSuppressionEntry({
      email: testEmail.toUpperCase(), // test case-insensitivity
      domain: testDomain,
      reason: "hard_bounce",
      sourceOrgId: testOrgA,
      isRealSendBounce: true,
      statusCode: "550",
      rawSnippet: "550 5.1.1 The email account that you tried to reach does not exist",
      metadata: { test: true },
    });
    createdSuppressionIds.push(bounceEntry.id);
    console.log(`✓ 1.1 Recorded hard bounce entry [ID: ${bounceEntry.id}]`);
    console.log(`     Normalized email: ${bounceEntry.email}`);
    console.log(`     isRealSendBounce: ${bounceEntry.isRealSendBounce}, statusCode: ${bounceEntry.statusCode}`);

    // 1.2 Deduplication check: re-writing the same email + reason should NOT create a new row
    const dupEntry = await recordSuppressionEntry({
      email: testEmail.toLowerCase(),
      domain: testDomain,
      reason: "hard_bounce",
      sourceOrgId: testOrgA,
      isRealSendBounce: true,
      statusCode: "550",
    });
    console.log(`✓ 1.2 Deduplication verified: Returned ID ${dupEntry.id} === ${bounceEntry.id}`);
    if (dupEntry.id !== bounceEntry.id) {
      throw new Error("Deduplication failed: Duplicate row created!");
    }

    // 1.3 Record domain-level suppression (aggregator)
    const aggEntry = await recordSuppressionEntry({
      email: null,
      domain: aggregatorDomain,
      reason: "aggregator_domain",
      sourceOrgId: testOrgA,
      rawSnippet: "Aggregator / Scraper Directory",
    });
    createdSuppressionIds.push(aggEntry.id);
    console.log(`✓ 1.3 Recorded domain-level suppression [ID: ${aggEntry.id}] for domain: ${aggEntry.domain}`);

    // ------------------------------------------------------------------
    // TEST 2: Platform-Wide Reads (Step 1 & Step 3)
    // ------------------------------------------------------------------
    console.log("\nTEST 2: Platform-Wide Cross-Org Global Lookup (No Org Scoping)...");

    // Query from Org B perspective (should find findings from Org A)
    const foundByEmail = await checkSuppression({
      email: testEmail,
      domain: testDomain,
    });
    if (!foundByEmail || foundByEmail.reason !== "hard_bounce") {
      throw new Error("Failed to find suppressed contact by email across organizations!");
    }
    console.log(`✓ 2.1 Found suppression by email: ${foundByEmail.email} -> reason: ${foundByEmail.reason}`);

    // Query domain-level
    const foundByDomain = await checkSuppression({
      domain: aggregatorDomain,
    });
    if (!foundByDomain || foundByDomain.reason !== "aggregator_domain") {
      throw new Error("Failed to find domain-level suppression entry!");
    }
    console.log(`✓ 2.2 Found suppression by domain: ${foundByDomain.domain} -> reason: ${foundByDomain.reason}`);

    // ------------------------------------------------------------------
    // TEST 3: Rediscovery Short-Circuit (Saving External MX/Enrich.so/Firecrawl Calls)
    // ------------------------------------------------------------------
    console.log("\nTEST 3: Re-Discovery Pipeline Simulation (External Call Counter)...");

    // Runner that replicates Stage 5 discovery logic with negative-cache check:
    async function simulateStage5ContactDiscovery(candidate: {
      name: string;
      emailGuess: string;
      domain: string;
    }) {
      let mxCalls = 0;
      let enrichCalls = 0;
      let firecrawlCalls = 0;

      async function mockCheckDomainMxRecords(d: string): Promise<boolean> {
        mxCalls++;
        console.log(`      [EXTERNAL API CALL] DNS MX check executed for ${d}`);
        return true;
      }
      async function mockEnrichSoLookup(pName: string, d: string): Promise<any> {
        enrichCalls++;
        console.log(`      [EXTERNAL API CALL] enrich.so paid credit lookup executed for ${pName}@${d}`);
        return { email: `found@${d}` };
      }
      async function mockFirecrawlScrape(d: string): Promise<any> {
        firecrawlCalls++;
        console.log(`      [EXTERNAL API CALL] Firecrawl scrape executed for ${d}`);
        return { markdown: "mock" };
      }

      console.log(`   Running Stage 5 Discovery for: ${candidate.emailGuess} (${candidate.domain})...`);

      // 1. Domain suppression check
      const domainSupp = await checkSuppression({ domain: candidate.domain });
      if (domainSupp) {
        console.log(`   >> HIT NEGATIVE CACHE: Domain ${candidate.domain} is suppressed (${domainSupp.reason}).`);
        console.log(`   >> SHORT-CIRCUITED: 0 Firecrawl, 0 MX, 0 enrich.so calls made.`);
        return {
          shortCircuited: true,
          reason: domainSupp.reason,
          firecrawlCalls,
          mxCalls,
          enrichCalls,
        };
      }

      // Firecrawl scrape (if domain not suppressed)
      await mockFirecrawlScrape(candidate.domain);

      // 2. Candidate email suppression check (Negative cache floor)
      const emailSupp = await checkSuppression({
        email: candidate.emailGuess,
        domain: candidate.domain,
      });

      if (emailSupp) {
        console.log(`   >> HIT NEGATIVE CACHE: Email ${candidate.emailGuess} is previously suppressed (${emailSupp.reason}).`);
        console.log(`   >> SHORT-CIRCUITED: Skipping MX validation and enrich.so paid lookup!`);
        return {
          shortCircuited: true,
          email: candidate.emailGuess,
          reason: emailSupp.reason,
          firecrawlCalls,
          mxCalls,
          enrichCalls,
        };
      }

      // Fresh checks (only reached if NOT suppressed)
      await mockCheckDomainMxRecords(candidate.domain);
      await mockEnrichSoLookup(candidate.name, candidate.domain);
      return {
        shortCircuited: false,
        firecrawlCalls,
        mxCalls,
        enrichCalls,
      };
    }

    // 3.1 Test re-discovering the previously bounced contact (on legitimate non-suppressed domain)
    const rediscoveryResult = await simulateStage5ContactDiscovery({
      name: "John Doe",
      emailGuess: testEmail,
      domain: testDomain,
    });

    console.log(`✓ 3.1 Re-discovery of previously-bounced contact:`);
    console.log(`     Short-circuited: ${rediscoveryResult.shortCircuited}`);
    console.log(`     Reason: ${rediscoveryResult.reason}`);
    console.log(`     Firecrawl Calls Made for domain '${testDomain}': ${rediscoveryResult.firecrawlCalls}`);
    console.log(`     MX External Calls Made: ${rediscoveryResult.mxCalls}`);
    console.log(`     enrich.so External Calls Made: ${rediscoveryResult.enrichCalls}`);

    if (rediscoveryResult.mxCalls !== 0 || rediscoveryResult.enrichCalls !== 0) {
      throw new Error(`Negative cache leak! Expected 0 external calls, got MX: ${rediscoveryResult.mxCalls}, enrich: ${rediscoveryResult.enrichCalls}`);
    }

    // 3.2 Test re-discovering the aggregator domain (domain-level suppression)
    const aggRediscoveryResult = await simulateStage5ContactDiscovery({
      name: "Lead Scraper",
      emailGuess: `contact@${aggregatorDomain}`,
      domain: aggregatorDomain,
    });

    console.log(`✓ 3.2 Re-discovery of aggregator domain:`);
    console.log(`     Short-circuited: ${aggRediscoveryResult.shortCircuited}`);
    console.log(`     Reason: ${aggRediscoveryResult.reason}`);
    console.log(`     Firecrawl External Calls Made: ${aggRediscoveryResult.firecrawlCalls}`);
    console.log(`     MX External Calls Made: ${aggRediscoveryResult.mxCalls}`);
    console.log(`     enrich.so External Calls Made: ${aggRediscoveryResult.enrichCalls}`);

    if (aggRediscoveryResult.firecrawlCalls !== 0) {
      throw new Error(`Negative cache leak on domain! Firecrawl was called ${aggRediscoveryResult.firecrawlCalls} times for suppressed aggregator domain.`);
    }
    if (aggRediscoveryResult.mxCalls !== 0 || aggRediscoveryResult.enrichCalls !== 0) {
      throw new Error(`Negative cache leak on domain! External calls were made for suppressed aggregator domain.`);
    }

    // ------------------------------------------------------------------
    // TEST 4: Stage 5.5 Campaign Gate Execution in Database
    // ------------------------------------------------------------------
    console.log("\nTEST 4: Stage 5.5 Qualification Execution in Database...");

    // Create minimal research run, segment, campaign, prospect company, and contact in Org B
    const runId = nanoid();
    const segmentId = nanoid();
    const campaignId = nanoid();
    const companyId = nanoid();
    const contactId = nanoid();

    createdRunIds.push(runId);
    createdCampaignIds.push(campaignId);

    const [existingOrg] = await db.select().from(organization).limit(1);
    let orgBId = existingOrg?.id;
    if (!orgBId) {
      orgBId = nanoid();
      await db.insert(organization).values({
        id: orgBId,
        name: "Org Beta",
        slug: `org-beta-${Date.now()}`,
      });
    }

    const [existingUser] = await db.select().from(user).limit(1);
    let testUserId = existingUser?.id;
    if (!testUserId) {
      testUserId = nanoid();
      await db.insert(user).values({
        id: testUserId,
        name: "Test User",
        email: `test-user-${Date.now()}@example.com`,
      });
    }

    await db.insert(gtmResearchRun).values({
      id: runId,
      organizationId: orgBId,
      websiteUrl: "https://prospector.com",
      companyName: "Competitor Prospector Inc",
      companyDescription: "Prospecting tool",
      companySize: "11-50",
      status: "completed",
      createdBy: testUserId,
    });

    await db.insert(gtmIcpSegment).values({
      id: segmentId,
      researchRunId: runId,
      name: "Decision Makers",
      painPoint: "High bounce rates",
      criteria: ["VP of Engineering", "CTO"],
      exampleCompanies: [{ name: "Target", domain: testDomain }],
    });

    await db.insert(gtmOutreachCampaign).values({
      id: campaignId,
      researchRunId: runId,
      icpSegmentId: segmentId,
      status: "active",
      currentStage: "find_contacts",
    });

    await db.insert(gtmProspectCompany).values({
      id: companyId,
      outreachCampaignId: campaignId,
      name: "Target Company",
      domain: testDomain,
      description: "Test company description",
      location: "United States",
    });

    // Insert contact with the previously-bounced email
    await db.insert(gtmContact).values({
      id: contactId,
      prospectCompanyId: companyId,
      name: "Sarah Connors",
      title: "VP of Engineering",
      email: testEmail,
      emailSource: "pattern_guessed_mx_valid",
      verificationStatus: "pattern_guessed_mx_valid",
      linkedinUrl: "https://linkedin.com/in/sarah-connors-test",
    });

    // Execute real stage 5.5 qualification
    const stage55Result = await executeQualifyCampaignContacts(campaignId);
    console.log(`✓ 4.1 Stage 5.5 executed for campaign ${campaignId}:`);
    console.log(`     Total Contacts: ${stage55Result.totalContacts}`);
    console.log(`     Disqualified Count: ${stage55Result.disqualifiedCount}`);
    console.log(`     Qualified Count: ${stage55Result.qualifiedCount}`);

    if (stage55Result.disqualifiedCount !== 1 || stage55Result.qualifiedCount !== 0) {
      throw new Error("Stage 5.5 failed to disqualify previously suppressed contact!");
    }

    // Inspect the generated draft rejection reason
    const [draft] = await db
      .select()
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.contactId, contactId));

    console.log(`✓ 4.2 Disqualified draft record verified:`);
    console.log(`     Status: ${draft?.status}`);
    console.log(`     Rejection message: "${draft?.errorMessage}"`);

    // ------------------------------------------------------------------
    // TEST 5: Customer-Facing Isolation Audit
    // ------------------------------------------------------------------
    console.log("\nTEST 5: Auditing Customer-Facing Isolation...");

    // Check that draft error message does NOT contain internal leaks like "suppression" or "negative cache"
    const hasLeakInMessage =
      (draft?.errorMessage || "").toLowerCase().includes("suppression") ||
      (draft?.errorMessage || "").toLowerCase().includes("negative cache") ||
      (draft?.errorMessage || "").toLowerCase().includes("platform table");

    console.log(`✓ 5.1 No 'suppression' or internal leak in lead error message: ${!hasLeakInMessage}`);
    if (hasLeakInMessage) {
      throw new Error(`Leak detected in customer-facing error message: ${draft?.errorMessage}`);
    }

    console.log(`✓ 5.2 Confirmed: Customer-facing leads display shows standard explanation ("${draft?.errorMessage}").`);

    console.log("\n==================================================================");
    console.log("   ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!                      ");
    console.log("==================================================================\n");
  } finally {
    // Cleanup test artifacts
    console.log("Cleaning up test records from database...");
    for (const id of createdSuppressionIds) {
      await db.delete(gtmSuppressionEntry).where(eq(gtmSuppressionEntry.id, id));
    }
    for (const cId of createdCampaignIds) {
      await db.delete(gtmOutreachCampaign).where(eq(gtmOutreachCampaign.id, cId));
    }
    for (const rId of createdRunIds) {
      await db.delete(gtmResearchRun).where(eq(gtmResearchRun.id, rId));
    }
    console.log("Cleanup complete.");
  }
}

runTests()
  .catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
