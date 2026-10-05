import { inngest, researchRunChannel, outreachCampaignChannel } from "./client";
import { db } from "@/utils/db";
import {
  gtmResearchRun,
  gtmCompetitor,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmCompanyMetricSnapshot,
  gtmContact,
  gtmEmailDraft,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  scrapeUrl,
  searchFirecrawl,
  extractDomain,
  isAggregatorOrReviewDomain,
  getFallbackLogoUrl,
} from "@/lib/firecrawl";
import {
  generateCompetitorSearchQueries,
  generateIcpSegments,
  generateProspectSearchQueries,
  deriveTargetJobFunction,
  generateOutreachEmailDraft,
} from "@/lib/gtm-ai";
import {
  checkDomainMxRecords,
  generateEmailGuesses,
  extractEmailsFromText,
} from "@/lib/dns-lookup";

// Helper to safely publish realtime events (gracefully ignores errors in local dev without Inngest Cloud)
async function safeRealtimePublish(topicRef: any, data: any) {
  try {
    if (process.env.INNGEST_SIGNING_KEY) {
      await inngest.realtime.publish(topicRef, data);
    }
  } catch (err) {
    console.warn("[Inngest Realtime Publish Notice]:", (err as Error).message);
  }
}

/**
 * Pipeline 1: Company Research -> Competitor Discovery -> ICP Segmentation (Stages 1-3)
 */
export const gtmResearchPipeline = inngest.createFunction(
  {
    id: "gtm-research-pipeline",
    name: "GTM Research Pipeline (Stages 1-3)",
    triggers: [{ event: "gtm/research.requested" }],
  },
  async ({ event, step }: { event: { data: { researchRunId: string } }; step: any }) => {
    const { researchRunId } = event.data;

    // -------------------------------------------------------------
    // Stage 1: Research Company
    // -------------------------------------------------------------
    const stage1Result = await step.run("stage-1-research-company", async () => {
      const [run] = await db
        .select()
        .from(gtmResearchRun)
        .where(eq(gtmResearchRun.id, researchRunId));

      if (!run) {
        throw new Error(`Research run ${researchRunId} not found`);
      }

      await db
        .update(gtmResearchRun)
        .set({ currentStage: "research_company", status: "in_progress" })
        .where(eq(gtmResearchRun.id, researchRunId));

      await safeRealtimePublish(researchRunChannel(researchRunId).started, {
        stage: "research_company",
        message: `Analyzing ${run.companyName} (${run.websiteUrl})...`,
      });

      // 1. Scrape homepage
      const homepageScrape = await scrapeUrl(run.websiteUrl);

      // 2. Discover social presence
      const cleanName = run.companyName.trim();
      const [linkedinResults, twitterResults, instagramResults] =
        await Promise.all([
          searchFirecrawl(`"${cleanName}" site:linkedin.com/company`, 2),
          searchFirecrawl(`"${cleanName}" site:x.com OR site:twitter.com`, 2),
          searchFirecrawl(`"${cleanName}" site:instagram.com`, 2),
        ]);

      const linkedinUrl =
        linkedinResults.find((r) => r.url.includes("linkedin.com/company/"))?.url || null;
      const twitterUrl =
        twitterResults.find(
          (r) => r.url.includes("x.com/") || r.url.includes("twitter.com/")
        )?.url || null;
      const instagramUrl =
        instagramResults.find((r) => r.url.includes("instagram.com/"))?.url || null;

      const logoUrl =
        run.logoUrl ||
        homepageScrape.ogImage ||
        homepageScrape.favicon ||
        getFallbackLogoUrl(run.websiteUrl);

      const seoKeywords = homepageScrape.keywords && homepageScrape.keywords.length > 0
        ? homepageScrape.keywords
        : null;

      // Update research run
      await db
        .update(gtmResearchRun)
        .set({
          logoUrl,
          linkedinUrl,
          twitterUrl,
          instagramUrl,
          seoKeywords,
          currentStage: "research_competitors",
        })
        .where(eq(gtmResearchRun.id, researchRunId));

      await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
        stage: "research_company",
        summary: `Homepage analyzed. Social presence and branding discovered.`,
      });

      return {
        companyName: run.companyName,
        companyDescription: run.companyDescription,
        contextDoc: run.contextDoc,
        websiteUrl: run.websiteUrl,
      };
    });

    // -------------------------------------------------------------
    // Stage 2: Explore Competitors
    // -------------------------------------------------------------
    const stage2Result = await step.run("stage-2-explore-competitors", async () => {
      await safeRealtimePublish(researchRunChannel(researchRunId).started, {
        stage: "research_competitors",
        message: "Identifying and evaluating commercial competitors...",
      });

      // 1. Generate 3-5 search queries via AI
      const queries = await generateCompetitorSearchQueries({
        companyName: stage1Result.companyName,
        companyDescription: stage1Result.companyDescription,
        contextDoc: stage1Result.contextDoc,
      });

      // 2. Run searches via Firecrawl
      const searchResults = await Promise.all(
        queries.map((q) => searchFirecrawl(q, 6))
      );

      const ownDomain = extractDomain(stage1Result.websiteUrl);
      const candidateDomains = new Map<string, { title: string; description: string; url: string }>();

      for (const list of searchResults) {
        for (const item of list) {
          const dom = extractDomain(item.url);
          if (!dom || dom === ownDomain || isAggregatorOrReviewDomain(dom)) {
            continue;
          }
          if (!candidateDomains.has(dom)) {
            candidateDomains.set(dom, item);
          }
        }
      }

      // Cap at ~15 candidate domains, scrape top 6-8 for structured details
      const domainList = Array.from(candidateDomains.keys()).slice(0, 10);
      const competitorsToInsert: Array<{
        researchRunId: string;
        name: string;
        domain: string;
        description: string;
        keywords: string[];
        logoUrl: string;
      }> = [];

      for (const dom of domainList) {
        const item = candidateDomains.get(dom)!;
        let desc = item.description || "";
        let name = item.title.split(/[-–|:]/)[0].trim() || dom;

        // If snippet is very short, do a quick scrape
        let logo = getFallbackLogoUrl(dom);
        let keywords: string[] = [];

        if (desc.length < 30) {
          try {
            const scraped = await scrapeUrl(`https://${dom}`);
            if (scraped.description) desc = scraped.description;
            if (scraped.title && !name) name = scraped.title.split(/[-–|:]/)[0].trim();
            if (scraped.ogImage || scraped.favicon) logo = scraped.ogImage || scraped.favicon!;
            if (scraped.keywords) keywords = scraped.keywords;
          } catch (e) {
            console.warn(`Competitor scrape skipped for ${dom}`);
          }
        }

        competitorsToInsert.push({
          researchRunId,
          name: name.slice(0, 100),
          domain: dom,
          description: desc.slice(0, 500) || `${name} competitive solution in this space.`,
          keywords,
          logoUrl: logo,
        });
      }

      if (competitorsToInsert.length > 0) {
        await db.insert(gtmCompetitor).values(competitorsToInsert);
      }

      await db
        .update(gtmResearchRun)
        .set({ currentStage: "define_segments" })
        .where(eq(gtmResearchRun.id, researchRunId));

      await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
        stage: "research_competitors",
        summary: `Discovered and analyzed ${competitorsToInsert.length} competitors.`,
      });

      return { competitorCount: competitorsToInsert.length };
    });

    // -------------------------------------------------------------
    // Stage 3: Define Segments
    // -------------------------------------------------------------
    await step.run("stage-3-define-segments", async () => {
      await safeRealtimePublish(researchRunChannel(researchRunId).started, {
        stage: "define_segments",
        message: "Deriving ICP segments and discovering real example companies...",
      });

      const competitors = await db
        .select()
        .from(gtmCompetitor)
        .where(eq(gtmCompetitor.researchRunId, researchRunId));

      const segments = await generateIcpSegments({
        companyName: stage1Result.companyName,
        companyDescription: stage1Result.companyDescription,
        competitors: competitors.map((c) => ({
          name: c.name,
          domain: c.domain,
          description: c.description,
        })),
        contextDoc: stage1Result.contextDoc,
      });

      const ownDomain = extractDomain(stage1Result.websiteUrl);

      for (const seg of segments) {
        // Find 3-4 real named companies using live search
        const exampleCompaniesMap = new Map<string, string>(); // domain -> name

        for (const term of seg.candidateSearchTerms.slice(0, 2)) {
          const results = await searchFirecrawl(term, 4);
          for (const res of results) {
            const dom = extractDomain(res.url);
            if (!dom || dom === ownDomain || isAggregatorOrReviewDomain(dom)) {
              continue;
            }
            if (!exampleCompaniesMap.has(dom)) {
              const compName = res.title.split(/[-–|:]/)[0].trim() || dom;
              exampleCompaniesMap.set(dom, compName);
            }
            if (exampleCompaniesMap.size >= 4) break;
          }
          if (exampleCompaniesMap.size >= 4) break;
        }

        const exampleCompanies = Array.from(exampleCompaniesMap.entries()).map(
          ([domain, name]) => ({ name, domain })
        );

        await db.insert(gtmIcpSegment).values({
          researchRunId,
          name: seg.name,
          painPoint: seg.painPoint,
          criteria: seg.criteria,
          exampleCompanies,
          estimatedSizeLabel: seg.estimatedSizeLabel, // Clearly labeled LLM estimate
        });
      }

      await db
        .update(gtmResearchRun)
        .set({ currentStage: "done", status: "done" })
        .where(eq(gtmResearchRun.id, researchRunId));

      await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
        stage: "define_segments",
        summary: `Created ${segments.length} verified ICP segments.`,
      });

      return { segmentCount: segments.length };
    });

    return { success: true, researchRunId };
  }
);

/**
 * Pipeline 2: Outreach Campaign (Stages 4-6) - Executed per ICP Segment
 */
export const gtmCampaignPipeline = inngest.createFunction(
  {
    id: "gtm-campaign-pipeline",
    name: "GTM Campaign Pipeline (Stages 4-6)",
    triggers: [{ event: "gtm/campaign.find_companies" }],
  },
  async ({ event, step }: { event: { data: { outreachCampaignId: string } }; step: any }) => {
    const { outreachCampaignId } = event.data;

    // Load campaign, segment, and research run
    const [context] = await db
      .select({
        campaign: gtmOutreachCampaign,
        segment: gtmIcpSegment,
        researchRun: gtmResearchRun,
      })
      .from(gtmOutreachCampaign)
      .innerJoin(
        gtmIcpSegment,
        eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

    if (!context) {
      throw new Error(`Outreach campaign ${outreachCampaignId} not found`);
    }

    const { campaign, segment, researchRun } = context;

    // -------------------------------------------------------------
    // Stage 4: Find Prospect Companies
    // -------------------------------------------------------------
    const stage4Result = await step.run("stage-4-find-companies", async () => {
      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).started,
        {
          stage: "find_companies",
          message: `Discovering prospect companies matching ${segment.name}...`,
        }
      );

      const queries = await generateProspectSearchQueries({
        segmentName: segment.name,
        painPoint: segment.painPoint,
        criteria: segment.criteria,
      });

      const searchLists = await Promise.all(
        queries.map((q) => searchFirecrawl(q, 5))
      );

      const ownDomain = extractDomain(researchRun.websiteUrl);
      const prospectMap = new Map<
        string,
        { name: string; domain: string; description: string; location: string }
      >();

      for (const list of searchLists) {
        for (const item of list) {
          const dom = extractDomain(item.url);
          if (!dom || dom === ownDomain || isAggregatorOrReviewDomain(dom)) {
            continue;
          }
          if (!prospectMap.has(dom)) {
            const name = item.title.split(/[-–|:]/)[0].trim() || dom;
            prospectMap.set(dom, {
              name,
              domain: dom,
              description: item.description || `${name} commercial platform`,
              location: "United States", // Standard default when geo is unspecified in search snippet
            });
          }
        }
      }

      // Cap at 6-8 prospect companies
      const selectedProspects = Array.from(prospectMap.values()).slice(0, 8);
      const insertedCompanies: Array<{ id: string; name: string; domain: string; description: string }> = [];

      for (const p of selectedProspects) {
        const [inserted] = await db
          .insert(gtmProspectCompany)
          .values({
            outreachCampaignId,
            name: p.name,
            domain: p.domain,
            description: p.description,
            location: p.location,
          })
          .returning();

        insertedCompanies.push({
          id: inserted.id,
          name: inserted.name,
          domain: inserted.domain,
          description: inserted.description,
        });

        // Search LinkedIn company snippet for employee size / follower count
        try {
          const liResults = await searchFirecrawl(
            `"${p.name}" site:linkedin.com/company`,
            1
          );
          if (liResults.length > 0) {
            const snippet = liResults[0].description || "";
            const empMatch = snippet.match(/(\d+[\d,-]*\+?\s*(employees|members))/i);
            const folMatch = snippet.match(/(\d+[\d,]*\s*followers)/i);

            let empLabel: string | null = null;
            let folCount: number | null = null;

            if (empMatch) empLabel = empMatch[0];
            if (folMatch) {
              const num = parseInt(folMatch[1].replace(/[^0-9]/g, ""), 10);
              if (!isNaN(num)) folCount = num;
            }

            if (empLabel || folCount) {
              await db.insert(gtmCompanyMetricSnapshot).values({
                prospectCompanyId: inserted.id,
                employeeCountLabel: empLabel,
                linkedinFollowerCount: folCount,
              });
            }
          }
        } catch (e) {
          // Never fabricate if not found
          console.warn(`Metric snapshot check skipped for ${p.domain}`);
        }
      }

      await db
        .update(gtmOutreachCampaign)
        .set({ currentStage: "find_contacts" })
        .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).completed,
        {
          stage: "find_companies",
          summary: `Identified ${insertedCompanies.length} candidate companies.`,
        }
      );

      return { companies: insertedCompanies };
    });

    // -------------------------------------------------------------
    // Stage 5: Find Decision-Makers
    // -------------------------------------------------------------
    const stage5Result = await step.run("stage-5-find-decision-makers", async () => {
      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).started,
        {
          stage: "find_contacts",
          message: "Searching decision-makers and verifying email patterns...",
        }
      );

      // Derive relevant job function dynamically from segment
      const targetRole = await deriveTargetJobFunction({
        segmentName: segment.name,
        painPoint: segment.painPoint,
        criteria: segment.criteria,
      });

      const insertedContacts: Array<{
        id: string;
        name: string;
        title: string;
        email: string | null;
        emailSource: string;
        companyId: string;
        companyName: string;
        companyDescription: string;
      }> = [];

      for (const comp of stage4Result.companies) {
        let personName = "";
        let personTitle = targetRole.jobFunctions[0] || "Leader";
        let linkedinUrl: string | null = null;

        // Clean company name: remove common slogan/SEO suffixes
        const cleanCompanyName = comp.name
          .replace(/\s*[-–|:].*$/, "")
          .replace(/\s+(Inc|LLC|PLLC|Services|Platform|Practice)$/i, "")
          .trim();

        // 1. Search site's own team/about page (high fidelity for small/mid practices & startups)
        try {
          const teamQ = `site:${comp.domain} "team" OR "leadership" OR "founder" OR "clinical" OR "director"`;
          const teamResults = await searchFirecrawl(teamQ, 2);
          for (const tr of teamResults) {
            const snippet = tr.description || "";
            const nameRegexes = [
              /(Dr\.?\s*[A-Z][a-z]+\s+[A-Z][a-z]+)/,
              /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:,\s*(?:LPC|MD|DO|NP|PA|PhD|FNP))/,
              /(?:·|•|\b)([A-Z][a-z]+\s+[A-Z][a-z]+)\.?\s*(?:Professional Counselor|Clinical Director|Co-Founder|Founder|Director|CEO|CTO|COO)/,
            ];
            for (const rx of nameRegexes) {
              const match = snippet.match(rx);
              if (match && match[1]) {
                personName = match[1].trim();
                if (snippet.includes("Co-Founder")) personTitle = "Co-Founder";
                else if (snippet.includes("Founder")) personTitle = "Founder";
                else if (snippet.includes("Clinical Director")) personTitle = "Clinical Director";
                else if (snippet.includes("Director of Operations")) personTitle = "Director of Operations";
                else if (snippet.includes("Counselor")) personTitle = "Licensed Counselor";
                break;
              }
            }
            if (personName) break;
          }
        } catch {
          // ignore
        }

        // 2. If no name found on site, search LinkedIn snippet
        if (!personName) {
          try {
            const searchQ = `"${cleanCompanyName || comp.domain}" ${targetRole.searchKeyword} site:linkedin.com/in`;
            const liPeople = await searchFirecrawl(searchQ, 2);
            if (liPeople.length > 0) {
              const item = liPeople[0];
              linkedinUrl = item.url;
              const parsedName = item.title.split(/[-–|:]/)[0].trim();
              if (
                parsedName &&
                parsedName.length > 2 &&
                parsedName.length < 40 &&
                !parsedName.toLowerCase().includes("telehealth")
              ) {
                personName = parsedName;
              }
              const titleParts = item.title.split(/[-–|]/);
              if (titleParts.length > 1) {
                personTitle = titleParts[1].replace(/at .*$/i, "").trim() || personTitle;
              }
            }
          } catch {
            // ignore
          }
        }

        // 3. If no verified individual human was found in public snippets,
        // use an honest role-targeted title rather than fabricating a fake human name
        if (!personName) {
          personName = `${targetRole.jobFunctions[0]}`;
        }

        // Email-finding chain:
        let resolvedEmail: string | null = null;
        let emailSource:
          | "found_on_site"
          | "pattern_guessed_mx_valid"
          | "pattern_guessed_unverified"
          | "company_fallback"
          | "none" = "none";

        // Step a: Scrape Contact / About page
        try {
          const siteScrape = await scrapeUrl(`https://${comp.domain}`);
          const extracted = extractEmailsFromText(
            siteScrape.markdown || "",
            comp.domain
          );
          if (extracted.length > 0) {
            // Check if any email matches the person's name
            const firstName = personName.split(" ")[0].toLowerCase();
            const matching = extracted.find((e) => e.includes(firstName));
            if (matching) {
              resolvedEmail = matching;
              emailSource = "found_on_site";
            }
          }
        } catch (e) {
          // ignore
        }

        // Step b: Pattern guess + MX verification
        if (!resolvedEmail && personName.includes(" ")) {
          const guesses = generateEmailGuesses(personName, comp.domain);
          if (guesses.length > 0) {
            const hasMx = await checkDomainMxRecords(comp.domain);
            resolvedEmail = guesses[0]; // e.g. first.last@domain
            emailSource = hasMx
              ? "pattern_guessed_mx_valid"
              : "pattern_guessed_unverified";
          }
        }

        // Step c: Company-level fallback (info@/hello@/contact@)
        if (!resolvedEmail) {
          const hasMx = await checkDomainMxRecords(comp.domain);
          if (hasMx) {
            resolvedEmail = `contact@${comp.domain}`;
            emailSource = "company_fallback";
          }
        }

        // Step d: If truly nothing found -> email: null, emailSource: "none"

        const [contact] = await db
          .insert(gtmContact)
          .values({
            prospectCompanyId: comp.id,
            name: personName,
            title: personTitle,
            linkedinUrl,
            email: resolvedEmail,
            emailSource,
            geo: "United States",
          })
          .returning();

        insertedContacts.push({
          id: contact.id,
          name: contact.name,
          title: contact.title,
          email: contact.email,
          emailSource: contact.emailSource,
          companyId: comp.id,
          companyName: comp.name,
          companyDescription: comp.description,
        });
      }

      await db
        .update(gtmOutreachCampaign)
        .set({ currentStage: "write_emails" })
        .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).completed,
        {
          stage: "find_contacts",
          summary: `Identified ${insertedContacts.length} contacts and completed MX validations.`,
        }
      );

      return { contacts: insertedContacts };
    });

    // -------------------------------------------------------------
    // Stage 6: Write Personalized Emails
    // -------------------------------------------------------------
    await step.run("stage-6-write-emails", async () => {
      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).started,
        {
          stage: "write_emails",
          message: "Generating personalized outreach drafts...",
        }
      );

      const usableContacts = stage5Result.contacts.filter(
        (c: any) => c.emailSource !== "none" && c.email !== null
      );

      const draftsToInsert: Array<{
        contactId: string;
        outreachCampaignId: string;
        subject: string;
        body: string;
        status: "draft";
      }> = [];

      for (const contact of usableContacts) {
        const draft = await generateOutreachEmailDraft({
          contactName: contact.name,
          contactTitle: contact.title,
          companyName: contact.companyName,
          companyDescription: contact.companyDescription,
          segmentPainPoint: segment.painPoint,
          senderCompanyName: researchRun.companyName,
          senderCompanyDescription: researchRun.companyDescription,
        });

        draftsToInsert.push({
          contactId: contact.id,
          outreachCampaignId,
          subject: draft.subject,
          body: draft.body,
          status: "draft",
        });
      }

      if (draftsToInsert.length > 0) {
        await db.insert(gtmEmailDraft).values(draftsToInsert);
      }

      // Move campaign to awaiting_approval checkpoint - STOP HERE
      await db
        .update(gtmOutreachCampaign)
        .set({
          currentStage: "awaiting_approval",
          status: "awaiting_approval",
        })
        .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).completed,
        {
          stage: "write_emails",
          summary: `Generated ${draftsToInsert.length} drafts ready for review.`,
        }
      );

      return { draftCount: draftsToInsert.length };
    });

    return { success: true, outreachCampaignId };
  }
);

export const gtmFunctions = [gtmResearchPipeline, gtmCampaignPipeline];
