import { tool } from "ai";
import { z } from "zod";
import { db } from "@/utils/db";
import {
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmProspectCompany,
  gtmContact,
  gtmEmailDraft,
  gtmCompetitor,
  gtmConnectedMailbox,
  gtmSegmentDigest,
} from "@/db/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { runFullResearchPipeline } from "@/lib/gtm-pipeline-runner";

function toSafeJson<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    })
  );
}

export function createGtmAgentTools(organizationId: string, userId: string) {
  return {
    getCampaignOverview: tool({
      description:
        "Get live status, current stage, and metric summaries for outreach campaigns and active pipelines in the workspace.",
      inputSchema: z.object({
        campaignId: z
          .string()
          .optional()
          .describe("Optional specific campaign ID to inspect"),
        statusFilter: z
          .enum(["all", "in_progress", "done", "failed"])
          .optional()
          .default("all")
          .describe("Filter campaigns by execution status"),
      }),
      execute: async ({ campaignId, statusFilter }) => {
        try {
          const conditions = [
            eq(gtmResearchRun.organizationId, organizationId),
          ];

          if (campaignId) {
            conditions.push(eq(gtmOutreachCampaign.id, campaignId));
          }
          if (statusFilter && statusFilter !== "all") {
            conditions.push(eq(gtmOutreachCampaign.status, statusFilter));
          }

          const campaigns = await db
            .select({
              id: gtmOutreachCampaign.id,
              status: gtmOutreachCampaign.status,
              currentStage: gtmOutreachCampaign.currentStage,
              failureReason: gtmOutreachCampaign.failureReason,
              createdAt: gtmOutreachCampaign.createdAt,
              segmentId: gtmOutreachCampaign.icpSegmentId,
              segmentName: gtmIcpSegment.name,
              painPoint: gtmIcpSegment.painPoint,
              companyName: gtmResearchRun.companyName,
              websiteUrl: gtmResearchRun.websiteUrl,
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
            .where(and(...conditions))
            .orderBy(desc(gtmOutreachCampaign.createdAt))
            .limit(10);

          if (campaigns.length === 0) {
            return {
              count: 0,
              campaigns: [],
              message: "No matching campaigns found in the workspace.",
            };
          }

          const results = await Promise.all(
            campaigns.map(async (camp) => {
              const prospects = await db
                .select({ id: gtmProspectCompany.id })
                .from(gtmProspectCompany)
                .where(eq(gtmProspectCompany.outreachCampaignId, camp.id));

              const drafts = await db
                .select({
                  id: gtmEmailDraft.id,
                  status: gtmEmailDraft.status,
                })
                .from(gtmEmailDraft)
                .where(eq(gtmEmailDraft.outreachCampaignId, camp.id));

              const pendingDrafts = drafts.filter(
                (d) => d.status === "draft"
              ).length;
              const approvedDrafts = drafts.filter(
                (d) => d.status === "approved" || d.status === "sent"
              ).length;

              return {
                id: camp.id,
                companyName: camp.companyName,
                websiteUrl: camp.websiteUrl,
                segmentName: camp.segmentName,
                painPoint: camp.painPoint,
                status: camp.status,
                currentStage: camp.currentStage,
                failureReason: camp.failureReason,
                prospectCount: prospects.length,
                draftCount: drafts.length,
                pendingDrafts,
                approvedDrafts,
                needsReview: pendingDrafts > 0,
                createdAt: camp.createdAt ? camp.createdAt.toISOString() : null,
              };
            })
          );

          return toSafeJson({
            count: results.length,
            campaigns: results,
          });
        } catch (err: any) {
          return { error: `Failed to query campaigns: ${err.message}` };
        }
      },
    }),

    searchProspectsAndContacts: tool({
      description:
        "Look up verified prospect companies and target decision-makers across campaigns and ICP segments.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Search term matching company name, contact name, title, or domain"),
        campaignId: z
          .string()
          .optional()
          .describe("Optional campaign ID to filter results"),
        limit: z
          .number()
          .optional()
          .default(8)
          .describe("Maximum number of results to return"),
      }),
      execute: async ({ query, campaignId, limit = 8 }) => {
        try {
          const conditions = [
            eq(gtmResearchRun.organizationId, organizationId),
          ];
          if (campaignId) {
            conditions.push(eq(gtmOutreachCampaign.id, campaignId));
          }

          const prospects = await db
            .select({
              id: gtmProspectCompany.id,
              name: gtmProspectCompany.name,
              domain: gtmProspectCompany.domain,
              description: gtmProspectCompany.description,
              campaignId: gtmProspectCompany.outreachCampaignId,
            })
            .from(gtmProspectCompany)
            .innerJoin(
              gtmOutreachCampaign,
              eq(gtmProspectCompany.outreachCampaignId, gtmOutreachCampaign.id)
            )
            .innerJoin(
              gtmResearchRun,
              eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
            )
            .where(
              and(
                ...conditions,
                query
                  ? or(
                      ilike(gtmProspectCompany.name, `%${query}%`),
                      ilike(gtmProspectCompany.domain, `%${query}%`)
                    )
                  : undefined
              )
            )
            .limit(limit);

          const enriched = await Promise.all(
            prospects.map(async (p) => {
              const contacts = await db
                .select({
                  id: gtmContact.id,
                  name: gtmContact.name,
                  title: gtmContact.title,
                  email: gtmContact.email,
                  emailSource: gtmContact.emailSource,
                  linkedinUrl: gtmContact.linkedinUrl,
                })
                .from(gtmContact)
                .where(eq(gtmContact.prospectCompanyId, p.id))
                .limit(4);

              return {
                companyId: p.id,
                companyName: p.name,
                domain: p.domain,
                description: p.description,
                contacts: contacts.map((c) => ({
                  name: c.name,
                  title: c.title,
                  email: c.email,
                  verified: c.emailSource !== "pattern_guessed_unverified",
                  linkedin: c.linkedinUrl,
                })),
              };
            })
          );

          return toSafeJson({
            count: enriched.length,
            results: enriched,
          });
        } catch (err: any) {
          return { error: `Failed to search prospects: ${err.message}` };
        }
      },
    }),

    getMarketIntelligence: tool({
      description:
        "Look up synthesized company profile, ICP segments, target customer criteria, and discovered competitors from research runs.",
      inputSchema: z.object({
        researchRunId: z
          .string()
          .optional()
          .describe("Specific research run ID, or omit to get the most recent run"),
      }),
      execute: async ({ researchRunId }) => {
        try {
          const conditions = [
            eq(gtmResearchRun.organizationId, organizationId),
          ];
          if (researchRunId) {
            conditions.push(eq(gtmResearchRun.id, researchRunId));
          }

          const [run] = await db
            .select()
            .from(gtmResearchRun)
            .where(and(...conditions))
            .orderBy(desc(gtmResearchRun.createdAt))
            .limit(1);

          if (!run) {
            return { error: "No research run found for this workspace." };
          }

          const competitors = await db
            .select({
              name: gtmCompetitor.name,
              domain: gtmCompetitor.domain,
              description: gtmCompetitor.description,
            })
            .from(gtmCompetitor)
            .where(eq(gtmCompetitor.researchRunId, run.id))
            .limit(8);

          const segments = await db
            .select({
              id: gtmIcpSegment.id,
              name: gtmIcpSegment.name,
              painPoint: gtmIcpSegment.painPoint,
              criteria: gtmIcpSegment.criteria,
            })
            .from(gtmIcpSegment)
            .where(eq(gtmIcpSegment.researchRunId, run.id))
            .limit(6);

          return toSafeJson({
            runId: run.id,
            companyName: run.companyName,
            websiteUrl: run.websiteUrl,
            status: run.status,
            currentStage: run.currentStage,
            synthesizedProfile: run.synthesizedProfile,
            competitors,
            segments,
          });
        } catch (err: any) {
          return { error: `Failed to get market intelligence: ${err.message}` };
        }
      },
    }),

    getSegmentPerformance: tool({
      description:
        "Fetch performance digest, email engagement metrics, and learning notes for an ICP segment.",
      inputSchema: z.object({
        segmentId: z.string().describe("ID of the ICP segment to inspect"),
      }),
      execute: async ({ segmentId }) => {
        try {
          const [digest] = await db
            .select()
            .from(gtmSegmentDigest)
            .where(
              and(
                eq(gtmSegmentDigest.icpSegmentId, segmentId),
                eq(gtmSegmentDigest.organizationId, organizationId)
              )
            )
            .orderBy(desc(gtmSegmentDigest.generatedAt))
            .limit(1);

          const [segment] = await db
            .select()
            .from(gtmIcpSegment)
            .where(eq(gtmIcpSegment.id, segmentId))
            .limit(1);

          if (digest) {
            return {
              segmentName: segment?.name || "Segment",
              emailsSent: digest.metrics.sentCount,
              replyRate: `${(digest.metrics.replyRate * 100).toFixed(1)}%`,
              interestedRate: `${(digest.metrics.interestedReplyRate * 100).toFixed(1)}%`,
              meetingsBooked: digest.metrics.meetingsBookedCount,
              summary: digest.summary,
            };
          }

          return {
            segmentName: segment?.name || "Segment",
            message: "No formal digest generated yet. Campaign learning in progress.",
          };
        } catch (err: any) {
          return { error: `Failed to fetch performance digest: ${err.message}` };
        }
      },
    }),

    retriggerResearchPipeline: tool({
      description:
        "Rerun the autonomous research pipeline with a corrected or clarified company description.",
      inputSchema: z.object({
        researchRunId: z.string().describe("The research run ID to retrigger"),
        updatedDescription: z
          .string()
          .describe("The updated or corrected company description"),
      }),
      execute: async ({ researchRunId, updatedDescription }) => {
        try {
          const [updated] = await db
            .update(gtmResearchRun)
            .set({
              companyDescription: updatedDescription,
              synthesizedProfile: null,
              status: "in_progress",
              currentStage: "research_company",
              failureReason: null,
            })
            .where(
              and(
                eq(gtmResearchRun.id, researchRunId),
                eq(gtmResearchRun.organizationId, organizationId)
              )
            )
            .returning();

          if (!updated) {
            return {
              error: "Research run not found or does not belong to this organization.",
            };
          }

          setImmediate(() => {
            runFullResearchPipeline(researchRunId).catch((err) => {
              console.error("[Agent Tool Retrigger] Pipeline error:", err);
            });
          });

          return {
            success: true,
            researchRunId,
            status: "in_progress",
            message: `Research pipeline restarted for ${updated.companyName} with updated description.`,
          };
        } catch (err: any) {
          return { error: `Failed to retrigger pipeline: ${err.message}` };
        }
      },
    }),

    getMailboxStatus: tool({
      description:
        "Check whether an outbound sending mailbox is connected and ready to send cold outreach emails.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const [mailbox] = await db
            .select({
              id: gtmConnectedMailbox.id,
              email: gtmConnectedMailbox.email,
              provider: gtmConnectedMailbox.provider,
              status: gtmConnectedMailbox.status,
            })
            .from(gtmConnectedMailbox)
            .where(eq(gtmConnectedMailbox.organizationId, organizationId))
            .limit(1);

          if (!mailbox) {
            return {
              connected: false,
              message:
                "No mailbox connected. Connect a Google Workspace or SMTP mailbox in Settings before launching email sending.",
            };
          }

          return {
            connected: mailbox.status === "connected",
            email: mailbox.email,
            provider: mailbox.provider,
            status: mailbox.status,
          };
        } catch (err: any) {
          return { error: `Failed to check mailbox status: ${err.message}` };
        }
      },
    }),
  };
}
