import { tool } from "ai";
import { z } from "zod";
import { db } from "@/utils/db";
import {
  project,
  deliverable,
  proposal,
  contract,
  paymentMilestone,
  activityLog,
  invoice,
  invoiceDefaults,
  projectMember,
  projectInvitation,
  user as userTable,
  organization,
  payment,
} from "@/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { evaluateScopeStatus, getProjectRevisionCount } from "./scope-guardian";
import { generateChangeOrderAddendum } from "./addendum-generator";
import { getContractScopeFromDb } from "./contract-parser";
import { recordCreditUsage, checkCreditAllowance } from "./credits";
import { checkSearchCircuitBreaker } from "./search-circuit-breaker";
import { convertAmount, convertAndAggregate, getUsdToInrRate } from "@/lib/currency";
import crypto from "crypto";

const toIsoDate = (d: unknown): string | null => {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return d;
  return String(d);
};

/**
 * Shared Tenant Resolver
 * Validates that a project exists and strictly belongs to the caller's organization.
 * Resolves by project ID, @mention, or project name within the organization.
 */
async function resolveOrgProject(
  projectIdentifier: string,
  organizationId: string
): Promise<{ id: string; name: string; currency: "USD" | "INR" } | null> {
  if (!projectIdentifier || !organizationId) return null;
  const clean = projectIdentifier.trim().replace(/^@/, "").trim();
  if (!clean) return null;

  // 1. Try exact UUID / ID match
  const [byId] = await db
    .select({ id: project.id, name: project.name, currency: project.currency })
    .from(project)
    .where(and(eq(project.id, clean), eq(project.organizationId, organizationId)));
  if (byId) return byId as { id: string; name: string; currency: "USD" | "INR" };

  // 2. Try exact or case-insensitive name match within caller's organization
  const orgProjects = await db
    .select({ id: project.id, name: project.name, currency: project.currency })
    .from(project)
    .where(eq(project.organizationId, organizationId));

  const lower = clean.toLowerCase();
  const exactName = orgProjects.find((p) => p.name.toLowerCase() === lower);
  if (exactName) return exactName as { id: string; name: string; currency: "USD" | "INR" };

  const partialName = orgProjects.find((p) => p.name.toLowerCase().includes(lower));
  if (partialName) return partialName as { id: string; name: string; currency: "USD" | "INR" };

  return null;
}

/**
 * Torch Tool Registry
 *
 * Exposes workspace intelligence, scope guardian audits, change order addenda,
 * proposal estimation, and financial analytics directly to Torch agent.
 */
export function createTorchTools(
  organizationId: string,
  userId?: string | null,
  options?: { enableWebSearch?: boolean }
) {
  const enableWebSearch = options?.enableWebSearch ?? false;
  let turnWebSearchCount = 0;

  const trackUsage = async (toolName: string, metadata?: Record<string, unknown>) => {
    try {
      await recordCreditUsage({
        organizationId,
        userId,
        type: "ai_tool_call",
        toolName,
        metadata,
      });
    } catch (err) {
      console.error(`[Credit Tracking Error] ${toolName}:`, err);
    }
  };

  const baseTools = {
    queryWorkspaceOverview: tool({
      description:
        "Fetches a high-level summary of active projects, deliverables in review, proposals, and contracts in the workspace.",
      inputSchema: z.object({}),
      execute: async () => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) {
          return { error: allowance.reason || "AI credit limit reached." };
        }
        await trackUsage("queryWorkspaceOverview");

        const orgProjects = await db
          .select({
            id: project.id,
            name: project.name,
            status: project.status,
            createdAt: project.createdAt,
          })
          .from(project)
          .where(eq(project.organizationId, organizationId));

        const projectIds = orgProjects.map((p) => p.id);
        if (projectIds.length === 0) {
          return {
            totalProjects: 0,
            activeProjects: 0,
            projects: [],
            inReviewDeliverablesCount: 0,
            totalProposalPipeline: 0,
          };
        }

        const [deliverablesList, proposalsList, contractsList] = await Promise.all([
          db
            .select({
              id: deliverable.id,
              projectId: deliverable.projectId,
              title: deliverable.title,
              status: deliverable.status,
              dueDate: deliverable.dueDate,
            })
            .from(deliverable)
            .where(inArray(deliverable.projectId, projectIds)),
          db
            .select({
              id: proposal.id,
              projectId: proposal.projectId,
              price: proposal.price,
              currency: proposal.currency,
              status: proposal.status,
            })
            .from(proposal)
            .where(inArray(proposal.projectId, projectIds)),
          db
            .select({
              id: contract.id,
              projectId: contract.projectId,
              status: contract.status,
              fileName: contract.fileName,
            })
            .from(contract)
            .where(inArray(contract.projectId, projectIds)),
        ]);

        const [org] = await db
          .select({ globalCurrency: organization.globalCurrency })
          .from(organization)
          .where(eq(organization.id, organizationId));
        const targetCurrency = (org?.globalCurrency as "USD" | "INR") || "USD";
        const usdToInrRate = await getUsdToInrRate();

        const inReview = deliverablesList.filter(
          (d) => d.status === "in_review" || d.status === "revision_requested",
        );
        const acceptedItems = proposalsList
          .filter((p) => p.status === "accepted")
          .map((p) => ({ amount: p.price, currency: p.currency }));
        const { total: acceptedValue } = convertAndAggregate(acceptedItems, targetCurrency, usdToInrRate);

        return {
          totalProjects: orgProjects.length,
          activeProjects: orgProjects.filter((p) => p.status === "active").length,
          projects: orgProjects.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            contractStatus:
              contractsList.find((c) => c.projectId === p.id)?.status || "none",
            deliverableCount: deliverablesList.filter((d) => d.projectId === p.id)
              .length,
          })),
          inReviewDeliverablesCount: inReview.length,
          inReviewDeliverables: inReview.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
            projectId: d.projectId,
          })),
          totalProposalPipeline: acceptedValue,
          currency: targetCurrency,
        };
      },
    }),

    auditProjectScope: tool({
      description:
        "Audits a project's revision history against signed contract scope terms, checking for scope creep, revision limits, and exclusions.",
      inputSchema: z.object({
        projectId: z.string().nullish().describe("The ID of the project to audit"),
        projectName: z
          .string()
          .nullish()
          .describe("Optional project name for fuzzy matching"),
      }),
      execute: async ({ projectId, projectName }) => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) return { error: allowance.reason || "AI credit limit reached." };
        await trackUsage("auditProjectScope", { projectId, projectName });

        let targetId = projectId;
        let projName: string | undefined;

        if (targetId) {
          const resolved = await resolveOrgProject(targetId, organizationId);
          if (!resolved) {
            return { error: "Project not found in current organization." };
          }
          targetId = resolved.id;
          projName = resolved.name;
        } else if (projectName) {
          const orgProjects = await db
            .select({ id: project.id, name: project.name })
            .from(project)
            .where(eq(project.organizationId, organizationId));
          const match = orgProjects.find((p) =>
            p.name.toLowerCase().includes(projectName.toLowerCase()),
          );
          if (!match) {
            return { error: `Project "${projectName}" not found in current organization.` };
          }
          targetId = match.id;
          projName = match.name;
        } else {
          const [firstProj] = await db
            .select({ id: project.id, name: project.name })
            .from(project)
            .where(eq(project.organizationId, organizationId))
            .limit(1);
          if (!firstProj) {
            return { error: `No projects found in current workspace.` };
          }
          targetId = firstProj.id;
          projName = firstProj.name;
        }

        const [activeContract] = await db
          .select()
          .from(contract)
          .where(and(eq(contract.projectId, targetId), eq(contract.status, "signed")))
          .orderBy(desc(contract.createdAt))
          .limit(1);

        const revisionCount = await getProjectRevisionCount(targetId);
        const scopeEvaluation = await evaluateScopeStatus(targetId, revisionCount + 1);
        const contractTerms = activeContract
          ? await getContractScopeFromDb(activeContract.id)
          : null;

        const deliverablesList = await db
          .select({
            id: deliverable.id,
            title: deliverable.title,
            status: deliverable.status,
          })
          .from(deliverable)
          .where(eq(deliverable.projectId, targetId));

        return {
          projectId: targetId,
          projectName: projName || "Project",
          hasSignedContract: !!activeContract,
          contractFileName: activeContract?.fileName || null,
          contractId: activeContract?.id || null,
          totalDeliverables: deliverablesList.length,
          deliverables: deliverablesList,
          historicalRevisionRequestsCount: revisionCount,
          scopeEvaluation,
          extractedTerms: contractTerms,
        };
      },
    }),

    generateAddendumDraft: tool({
      description:
        "Generates a formal Change Order Addendum with itemized pricing when scope creep is detected or extra work is requested.",
      inputSchema: z.object({
        projectId: z.string().describe("The ID of the project"),
        reason: z.string().describe("The reason for the change order or extra revisions"),
      }),
      execute: async ({ projectId, reason }) => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) return { error: allowance.reason || "AI credit limit reached." };
        await trackUsage("generateAddendumDraft", { projectId });

        const resolved = await resolveOrgProject(projectId, organizationId);
        if (!resolved) {
          return {
            error: "Project not found in current organization.",
          };
        }

        const [activeContract] = await db
          .select()
          .from(contract)
          .where(eq(contract.projectId, resolved.id))
          .orderBy(desc(contract.createdAt))
          .limit(1);

        if (!activeContract) {
          return {
            error: "No contract found for this project to generate an addendum for.",
          };
        }

        const addendum = await generateChangeOrderAddendum(activeContract.id, reason);

        return {
          projectId: resolved.id,
          contractId: activeContract.id,
          artifactType: "change_order_addendum",
          addendum,
          requiresConfirmation: true,
        };
      },
    }),

    analyzeFinancials: tool({
      description:
        "Analyzes payment milestones, revenue collected, due amounts, outstanding cashflow, and payment status across workspace projects or for a specific project.",
      inputSchema: z.object({
        projectId: z.string().nullish().describe("Optional project ID or @ProjectName to filter financials"),
        projectName: z.string().nullish().describe("Optional project name (e.g. 'Reveega Website')"),
      }),
      execute: async ({ projectId, projectName }) => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) return { error: allowance.reason || "AI credit limit reached." };
        await trackUsage("analyzeFinancials", { projectId, projectName });

        const target = (projectId || projectName)?.trim();
        let projectIds: string[];
        let projectNameResolved: string | undefined;

        let targetCurrency: "USD" | "INR" = "USD";
        if (target && target.length > 0) {
          const resolved = await resolveOrgProject(target, organizationId);
          if (!resolved) {
            return {
              error: `Project "${target}" not found in current organization.`,
              collected: 0,
              due: 0,
              overdue: 0,
              upcoming: 0,
              milestones: [],
            };
          }
          projectIds = [resolved.id];
          projectNameResolved = resolved.name;
          targetCurrency = resolved.currency || "USD";
        } else {
          const [orgProjects, [org]] = await Promise.all([
            db
              .select({ id: project.id, name: project.name })
              .from(project)
              .where(eq(project.organizationId, organizationId)),
            db
              .select({ globalCurrency: organization.globalCurrency })
              .from(organization)
              .where(eq(organization.id, organizationId)),
          ]);
          projectIds = orgProjects.map((p) => p.id);
          targetCurrency = (org?.globalCurrency as "USD" | "INR") || "USD";
        }

        if (projectIds.length === 0) {
          return { collected: 0, due: 0, overdue: 0, upcoming: 0, milestones: [], currency: targetCurrency };
        }

        const [milestones, projectPayments, allInvoices, usdToInrRate] = await Promise.all([
          db
            .select()
            .from(paymentMilestone)
            .where(inArray(paymentMilestone.projectId, projectIds)),
          db
            .select({
              id: payment.id,
              milestoneId: payment.milestoneId,
              invoiceId: payment.invoiceId,
              amount: payment.amount,
              currency: payment.currency,
              fxRateAtPayment: payment.fxRateAtPayment,
              status: payment.status,
            })
            .from(payment)
            .where(and(inArray(payment.projectId, projectIds), eq(payment.status, "succeeded"))),
          db
            .select({
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              total: invoice.total,
              currency: invoice.currency,
              status: invoice.status,
              dueDate: invoice.dueDate,
              milestoneId: invoice.milestoneId,
            })
            .from(invoice)
            .where(inArray(invoice.projectId, projectIds)),
          getUsdToInrRate(),
        ]);

        const paymentFxByMilestone = new Map<string, string | null>();
        const paymentFxByInvoice = new Map<string, string | null>();

        for (const p of projectPayments) {
          if (p.milestoneId) {
            paymentFxByMilestone.set(p.milestoneId, p.fxRateAtPayment);
          }
          if (p.invoiceId) {
            paymentFxByInvoice.set(p.invoiceId, p.fxRateAtPayment);
          }
        }

        let collected = 0;
        let due = 0;
        let overdue = 0;
        let upcoming = 0;

        // 1. Process scheduled milestones
        for (const m of milestones) {
          const fxRateAtPayment = m.status === "paid" ? paymentFxByMilestone.get(m.id) || null : null;
          const converted = convertAmount(m.amount, m.currency, targetCurrency, {
            fxRateAtPayment,
            liveRate: usdToInrRate,
          });

          if (m.status === "paid") collected += converted;
          else if (m.status === "due") due += converted;
          else if (m.status === "overdue") overdue += converted;
          else if (m.status === "upcoming") upcoming += converted;
        }

        // 2. Include milestone-less payments into collected
        const milestoneIdSet = new Set(milestones.map((m) => m.id));
        const standalonePayments = projectPayments.filter(
          (p) => !p.milestoneId || !milestoneIdSet.has(p.milestoneId)
        );

        for (const p of standalonePayments) {
          const converted = convertAmount(p.amount, p.currency, targetCurrency, {
            fxRateAtPayment: p.fxRateAtPayment,
            liveRate: usdToInrRate,
          });
          collected += converted;
        }

        // 3. Include standalone (milestone-less) invoices that are unpaid into due/overdue
        const standaloneInvoices = allInvoices.filter(
          (inv) => !inv.milestoneId || !milestoneIdSet.has(inv.milestoneId)
        );
        const now = Date.now();

        for (const inv of standaloneInvoices) {
          if (inv.status === "paid" || inv.status === "void" || inv.status === "draft") {
            continue;
          }
          const dueTime = new Date(inv.dueDate).getTime();
          const isOverdue = inv.status === "overdue" || dueTime < now;
          const converted = convertAmount(inv.total, inv.currency, targetCurrency, {
            liveRate: usdToInrRate,
          });
          if (isOverdue) overdue += converted;
          else due += converted;
        }

        // Build composite item list for reporting
        const reportedItems = [
          ...milestones.map((m) => ({
            id: m.id,
            title: m.title,
            amount: m.amount,
            currency: m.currency,
            status: m.status,
            triggerType: m.triggerType,
            dueDate: toIsoDate(m.dueDate),
          })),
          ...standaloneInvoices
            .filter((inv) => inv.status !== "void" && inv.status !== "draft")
            .map((inv) => {
              const dueTime = new Date(inv.dueDate).getTime();
              const isOverdue =
                inv.status === "overdue" || (dueTime < now && inv.status !== "paid");
              return {
                id: inv.id,
                title: `Invoice ${inv.invoiceNumber}`,
                amount: inv.total,
                currency: inv.currency,
                status: inv.status === "paid" ? "paid" : isOverdue ? "overdue" : "due",
                triggerType: "manual" as const,
                dueDate: toIsoDate(inv.dueDate),
              };
            }),
        ];

        return {
          projectName: projectNameResolved || (projectIds.length === 1 ? "Selected Project" : "Workspace Portfolio"),
          currency: targetCurrency,
          summary: { collected, due, overdue, upcoming },
          milestonesCount: reportedItems.length,
          milestones: reportedItems,
        };
      },
    }),

    generateClientDigest: tool({
      description:
        "Inspects project deliverables and activity history to synthesize a professional weekly client progress update.",
      inputSchema: z.object({
        projectId: z.string().nullish().describe("The ID of the project to generate a digest for"),
        projectName: z.string().nullish().describe("Optional project name"),
      }),
      execute: async ({ projectId, projectName }) => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) return { error: allowance.reason || "AI credit limit reached." };
        await trackUsage("generateClientDigest", { projectId, projectName });

        let targetId = projectId;
        let projName: string | undefined;

        if (targetId) {
          const resolved = await resolveOrgProject(targetId, organizationId);
          if (!resolved) return { error: "Project not found in current organization." };
          targetId = resolved.id;
          projName = resolved.name;
        } else if (projectName) {
          const orgProjects = await db
            .select({ id: project.id, name: project.name })
            .from(project)
            .where(eq(project.organizationId, organizationId));
          const match = orgProjects.find((p) =>
            p.name.toLowerCase().includes(projectName.toLowerCase()),
          );
          if (!match) return { error: `Project "${projectName}" not found in current organization.` };
          targetId = match.id;
          projName = match.name;
        } else {
          const [firstProj] = await db
            .select({ id: project.id, name: project.name })
            .from(project)
            .where(eq(project.organizationId, organizationId))
            .limit(1);
          if (!firstProj) return { error: "No projects found in current workspace." };
          targetId = firstProj.id;
          projName = firstProj.name;
        }

        const [deliverablesList, recentLogs] = await Promise.all([
          db.select().from(deliverable).where(eq(deliverable.projectId, targetId)),
          db
            .select({ log: activityLog, user: userTable })
            .from(activityLog)
            .leftJoin(userTable, eq(activityLog.userId, userTable.id))
            .where(eq(activityLog.projectId, targetId))
            .orderBy(desc(activityLog.createdAt))
            .limit(10),
        ]);

        const approved = deliverablesList.filter((d) => d.status === "approved");
        const inReview = deliverablesList.filter((d) => d.status === "in_review");
        const pending = deliverablesList.filter((d) => d.status === "pending");

        return {
          projectName: projName || "Project",
          deliverablesSummary: {
            approvedCount: approved.length,
            inReviewCount: inReview.length,
            pendingCount: pending.length,
            approvedItems: approved.map((d) => d.title),
            inReviewItems: inReview.map((d) => d.title),
            pendingItems: pending.map((d) => d.title),
          },
          recentActivityEvents: recentLogs.map((l) => ({
            type: l.log.type,
            actor: l.user?.name || "System",
            createdAt: toIsoDate(l.log.createdAt) || new Date().toISOString(),
          })),
        };
      },
    }),

    createDeliverableDraft: tool({
      description:
        "Drafts a new project deliverable with title, description, and due date. Returns a confirmation artifact before writing to DB.",
      inputSchema: z.object({
        projectId: z.string().describe("The project to add the deliverable to"),
        title: z.string().describe("Title of the deliverable"),
        description: z.string().nullish().describe("Description of scope"),
        dueDate: z.string().nullish().describe("ISO date string for due date"),
      }),
      execute: async ({ projectId, title, description, dueDate }) => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) return { error: allowance.reason || "AI credit limit reached." };
        await trackUsage("createDeliverableDraft", { projectId, title });

        const resolved = await resolveOrgProject(projectId, organizationId);
        if (!resolved) return { error: "Project not found in current organization." };

        return {
          artifactType: "create_deliverable_confirmation",
          projectId: resolved.id,
          projectName: resolved.name,
          draft: { title, description, dueDate },
          requiresConfirmation: true,
        };
      },
    }),

    queryInvoiceStatus: tool({
      description:
        "Queries invoices across the workspace or for a specific project. Returns counts by status (draft, sent, viewed, paid, overdue, void), outstanding balance, collected revenue, and details of overdue invoices with days overdue.",
      inputSchema: z.object({
        projectId: z.string().nullish().describe("Optional project ID to filter invoices"),
        projectName: z.string().nullish().describe("Optional project name for fuzzy matching"),
      }),
      execute: async ({ projectId, projectName }) => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) return { error: allowance.reason || "AI credit limit reached." };
        await trackUsage("queryInvoiceStatus", { projectId, projectName });

        let projectIds: string[];
        let targetCurrency: "USD" | "INR" = "USD";

        if (projectId) {
          const resolved = await resolveOrgProject(projectId, organizationId);
          if (!resolved) {
            return {
              error: "Project not found in current organization.",
              totalInvoices: 0,
              summary: { draft: 0, sent: 0, viewed: 0, paid: 0, overdue: 0, void: 0 },
              totalOutstanding: 0,
              totalPaid: 0,
              currency: "USD",
              invoices: [],
            };
          }
          projectIds = [resolved.id];
          targetCurrency = resolved.currency || "USD";
        } else if (projectName) {
          const orgProjects = await db
            .select({ id: project.id, name: project.name, currency: project.currency })
            .from(project)
            .where(eq(project.organizationId, organizationId));
          const match = orgProjects.find((p) =>
            p.name.toLowerCase().includes(projectName.toLowerCase())
          );
          if (!match) {
            return {
              error: `Project "${projectName}" not found in current organization.`,
              totalInvoices: 0,
              summary: { draft: 0, sent: 0, viewed: 0, paid: 0, overdue: 0, void: 0 },
              totalOutstanding: 0,
              totalPaid: 0,
              currency: "USD",
              invoices: [],
            };
          }
          projectIds = [match.id];
          targetCurrency = (match.currency as "USD" | "INR") || "USD";
        } else {
          const [orgProjects, [org]] = await Promise.all([
            db
              .select({ id: project.id })
              .from(project)
              .where(eq(project.organizationId, organizationId)),
            db
              .select({ globalCurrency: organization.globalCurrency })
              .from(organization)
              .where(eq(organization.id, organizationId)),
          ]);
          projectIds = orgProjects.map((p) => p.id);
          targetCurrency = (org?.globalCurrency as "USD" | "INR") || "USD";
        }

        if (projectIds.length === 0) {
          return {
            totalInvoices: 0,
            summary: {
              draft: 0,
              sent: 0,
              viewed: 0,
              paid: 0,
              overdue: 0,
              void: 0,
            },
            totalOutstanding: 0,
            totalPaid: 0,
            currency: targetCurrency,
            invoices: [],
          };
        }

        const [invoicesList, projectsList, usdToInrRate] = await Promise.all([
          db
            .select()
            .from(invoice)
            .where(
              and(
                eq(invoice.organizationId, organizationId),
                inArray(invoice.projectId, projectIds)
              )
            )
            .orderBy(desc(invoice.createdAt)),
          db
            .select({ id: project.id, name: project.name })
            .from(project)
            .where(inArray(project.id, projectIds)),
          getUsdToInrRate(),
        ]);

        const payments = await db
          .select({
            milestoneId: payment.milestoneId,
            invoiceId: payment.invoiceId,
            fxRateAtPayment: payment.fxRateAtPayment,
          })
          .from(payment)
          .where(and(inArray(payment.projectId, projectIds), eq(payment.status, "succeeded")));

        const paymentFxByMilestone = new Map<string, string | null>();
        const paymentFxByInvoice = new Map<string, string | null>();
        for (const p of payments) {
          if (p.milestoneId) paymentFxByMilestone.set(p.milestoneId, p.fxRateAtPayment);
          if (p.invoiceId) paymentFxByInvoice.set(p.invoiceId, p.fxRateAtPayment);
        }

        const projectMap = new Map(projectsList.map((p) => [p.id, p.name]));
        const now = Date.now();

        let draftCount = 0;
        let sentCount = 0;
        let viewedCount = 0;
        let paidCount = 0;
        let overdueCount = 0;
        let voidCount = 0;

        let totalOutstanding = 0;
        let totalPaid = 0;
        let totalDraft = 0;

        const detailedInvoices = invoicesList.map((inv) => {
          const dueTime = new Date(inv.dueDate).getTime();
          const isOverdue =
            inv.status === "overdue" ||
            (dueTime < now && inv.status !== "paid" && inv.status !== "void" && inv.status !== "draft");
          const overdueDays = isOverdue
            ? Math.max(1, Math.floor((now - dueTime) / (1000 * 60 * 60 * 24)))
            : 0;

          const fxRateAtPayment = inv.status === "paid"
            ? (inv.milestoneId ? paymentFxByMilestone.get(inv.milestoneId) : null) || paymentFxByInvoice.get(inv.id) || null
            : null;

          const converted = convertAmount(inv.total, inv.currency, targetCurrency, {
            fxRateAtPayment,
            liveRate: usdToInrRate,
          });

          if (inv.status === "paid") {
            paidCount++;
            totalPaid += converted;
          } else if (inv.status === "void") {
            voidCount++;
          } else if (inv.status === "draft") {
            draftCount++;
            totalDraft += converted;
          } else if (isOverdue) {
            overdueCount++;
            totalOutstanding += converted;
          } else if (inv.status === "viewed") {
            viewedCount++;
            totalOutstanding += converted;
          } else {
            sentCount++;
            totalOutstanding += converted;
          }

          const clientSnap = inv.clientSnapshot as { name?: string; email?: string } | null;

          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            projectId: inv.projectId,
            projectName: projectMap.get(inv.projectId) || "Project",
            clientName: clientSnap?.name || "Client",
            clientEmail: clientSnap?.email || "",
            amount: inv.total,
            currency: inv.currency,
            status: isOverdue ? "overdue" : inv.status,
            dueDate: toIsoDate(inv.dueDate) || "",
            invoiceDate: toIsoDate(inv.invoiceDate) || "",
            isOverdue,
            overdueDays,
          };
        });

        return {
          totalInvoices: invoicesList.length,
          currency: targetCurrency,
          summary: {
            draft: draftCount,
            sent: sentCount,
            viewed: viewedCount,
            paid: paidCount,
            overdue: overdueCount,
            void: voidCount,
          },
          totalOutstanding,
          totalPaid,
          totalDraft,
          invoices: detailedInvoices,
        };
      },
    }),

    draftInvoiceForMilestone: tool({
      description:
        "Drafts a new invoice for a verified project payment milestone. Uses the exact milestone amount (never estimates) and real client contact info. Produces a draft requiring human confirmation before saving.",
      inputSchema: z.object({
        projectId: z.string().describe("The project ID containing the milestone"),
        milestoneId: z.string().describe("The milestone ID to generate the invoice for"),
        notes: z.string().nullish().describe("Optional custom invoice notes or memo"),
      }),
      execute: async ({ projectId, milestoneId, notes }) => {
        const allowance = await checkCreditAllowance(organizationId, "ai");
        if (!allowance.allowed) return { error: allowance.reason || "AI credit limit reached." };
        await trackUsage("draftInvoiceForMilestone", { projectId, milestoneId });

        // 1. Verify project exists in org
        const resolved = await resolveOrgProject(projectId, organizationId);
        if (!resolved) {
          return { error: "Project not found in your workspace." };
        }

        // 2. Fetch milestone (Strict non-fabrication rule: amount comes strictly from DB)
        const [milestoneRow] = await db
          .select()
          .from(paymentMilestone)
          .where(and(eq(paymentMilestone.id, milestoneId), eq(paymentMilestone.projectId, projectId)));

        if (!milestoneRow) {
          return { error: "Payment milestone not found for this project." };
        }

        // 3. Fetch real client contact info (Strict non-fabrication rule)
        const [clientMembers, clientInvites] = await Promise.all([
          db
            .select({
              id: userTable.id,
              name: userTable.name,
              email: userTable.email,
            })
            .from(projectMember)
            .innerJoin(userTable, eq(projectMember.userId, userTable.id))
            .where(and(eq(projectMember.projectId, projectId), eq(projectMember.role, "client"))),
          db
            .select({ email: projectInvitation.email })
            .from(projectInvitation)
            .where(and(eq(projectInvitation.projectId, projectId), eq(projectInvitation.role, "client"))),
        ]);

        const clientName = clientMembers[0]?.name || "Client";
        const clientEmail = clientMembers[0]?.email || clientInvites[0]?.email || "";

        if (!clientMembers[0] && !clientInvites[0]) {
          return {
            error: "Cannot draft invoice: No client contact or invitation found for this project. Please add a client first.",
          };
        }

        // 4. Fetch org invoice defaults
        const defaults = await db.query.invoiceDefaults.findFirst({
          where: eq(invoiceDefaults.organizationId, organizationId),
        });

        const prefix = defaults?.defaultPrefix || "INV-";
        const serialNumber = defaults?.nextSerial || 1;
        const invoiceNumber = `${prefix}${String(serialNumber).padStart(3, "0")}`;
        const currency = (milestoneRow.currency?.toUpperCase() === "USD" ? "USD" : "INR") as "USD" | "INR";
        const exactAmount = milestoneRow.amount;

        const invoiceDate = new Date().toISOString().split("T")[0];
        const dueDate = milestoneRow.dueDate
          ? new Date(milestoneRow.dueDate).toISOString().split("T")[0]
          : new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

        const draftInvoice = {
          projectId,
          milestoneId: milestoneRow.id,
          milestoneTitle: milestoneRow.title,
          invoiceNumber,
          prefix,
          serialNumber,
          currency,
          invoiceDate,
          dueDate,
          paymentTerms: defaults?.defaultTerms || "",
          companySnapshot: {
            name: defaults?.companyName || "Company",
            address: defaults?.companyAddress || "",
            email: defaults?.companyEmail || "",
            phone: defaults?.companyPhone || "",
            logoUrl: defaults?.logoUrl || null,
            signatureUrl: defaults?.signatureUrl || null,
            customFields: defaults?.defaultCustomFields || [],
          },
          clientSnapshot: {
            name: clientName,
            email: clientEmail,
            address: "",
            phone: "",
            contactMethod: "email" as const,
            customFields: [],
          },
          billingDetails: [],
          lineItems: [
            {
              id: crypto.randomUUID(),
              itemName: milestoneRow.title,
              description: `Payment for milestone: ${milestoneRow.title}`,
              quantity: 1,
              unitPrice: exactAmount,
              lineTotal: exactAmount,
            },
          ],
          notes: notes || defaults?.defaultNotes || "",
          additionalTerms: "",
          paymentInformation: defaults?.defaultPaymentInfo || [],
          subtotal: exactAmount,
          total: exactAmount,
        };

        return {
          artifactType: "draft_invoice_confirmation",
          projectId: resolved.id,
          projectName: resolved.name,
          milestoneId: milestoneRow.id,
          milestoneTitle: milestoneRow.title,
          amount: exactAmount,
          currency,
          draftInvoice,
          requiresConfirmation: true,
        };
      },
    }),
  };

  if (enableWebSearch) {
    return {
      ...baseTools,
      webSearch: tool({
      description:
        "Searches the public web using a licensed search API for external internet information, market rate benchmarks, technical documentation, and public company background. CRITICAL: Follow the Internal-First Principle. Never call this tool for internal projects, @ProjectName references, workspace financials, revenue, deliverables, contracts, scope, or invoices.",
      inputSchema: z.object({
        query: z.string().describe("The external search query to look up on the web"),
      }),
      execute: async ({ query }) => {
        // Per-turn search burst guard: Prevents model from issuing runaway multi-search loops in a single turn
        if (turnWebSearchCount >= 2) {
          return {
            query,
            source: "search_budget_exceeded",
            results: [],
            note: "Per-turn search budget limit (2 searches) reached. Stop searching and immediately synthesize your final response from the information already gathered.",
          };
        }
        turnWebSearchCount++;

        // 0a. Platform Technical Circuit Breaker (Always enforced)
        const breaker = checkSearchCircuitBreaker(organizationId);
        if (!breaker.allowed) {
          return {
            query,
            source: "circuit_breaker",
            results: [],
            error: "Platform hourly search rate limit reached for this workspace. Please try again later.",
          };
        }

        // 0b. Soft-cap / Credit Allowance Check
        const allowance = await checkCreditAllowance(organizationId, "search");
        if (!allowance.allowed) {
          return {
            query,
            source: "limit_exceeded",
            results: [],
            error: allowance.reason || "Web search credit limit reached for current billing period.",
          };
        }

        // Record web search consumption event
        try {
          await recordCreditUsage({
            organizationId,
            userId,
            type: "web_search",
            toolName: "webSearch",
            metadata: { query },
          });
        } catch (err) {
          console.error("[Credit Tracking Error] webSearch:", err);
        }

        const firecrawlKey = process.env.FIRECRAWL_API_KEY;
        const serperKey = process.env.SERPER_API_KEY;
        const braveKey = process.env.BRAVE_SEARCH_API_KEY;

        // 1. Firecrawl Search API (Primary Tier: Dedicated /v2/search for LLM agents)
        if (firecrawlKey) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            let firecrawlRes = await fetch("https://api.firecrawl.dev/v2/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${firecrawlKey}`,
              },
              body: JSON.stringify({
                query,
                limit: 5,
              }),
              signal: controller.signal,
            });

            // Fallback to /v1/search if /v2/search returns 404
            if (!firecrawlRes.ok && firecrawlRes.status === 404) {
              firecrawlRes = await fetch("https://api.firecrawl.dev/v1/search", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${firecrawlKey}`,
                },
                body: JSON.stringify({
                  query,
                  limit: 5,
                }),
                signal: controller.signal,
              });
            }

            clearTimeout(timeoutId);

            if (firecrawlRes.ok) {
              const firecrawlData = (await firecrawlRes.json()) as {
                success?: boolean;
                data?:
                  | {
                      web?: Array<{
                        title?: string;
                        description?: string;
                        url?: string;
                        markdown?: string;
                      }>;
                    }
                  | Array<{
                      title?: string;
                      description?: string;
                      url?: string;
                      markdown?: string;
                    }>;
              };

              const payload = firecrawlData.data as any;
              const rawList = Array.isArray(payload?.web)
                ? payload.web
                : Array.isArray(payload)
                  ? payload
                  : Array.isArray((firecrawlData as any).results)
                    ? (firecrawlData as any).results
                    : [];

              if (rawList.length > 0) {
                console.log("[Torch WebSearch] Served by: Firecrawl (/v2/search)");
                return {
                  query,
                  source: "firecrawl",
                  results: rawList.map((item: any) => ({
                    title: item.title || "Web Result",
                    snippet:
                      item.description ||
                      (item.markdown ? item.markdown.slice(0, 300).trim() : ""),
                    url: item.url || "",
                  })),
                };
              }
            } else {
              const errBody = await firecrawlRes.text();
              console.warn(`[Torch WebSearch] Firecrawl returned error HTTP ${firecrawlRes.status}: ${errBody}`);
            }
          } catch (firecrawlErr) {
            console.warn("[Torch WebSearch] Firecrawl network error:", firecrawlErr);
          }
        } else {
          console.log("[Torch WebSearch] Tier 1 (Firecrawl) skipped: FIRECRAWL_API_KEY not configured");
        }

        // 2. Serper (Google Search) API (Licensed Google Results API)
        if (serperKey) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const serperRes = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: {
                "X-API-KEY": serperKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ q: query, num: 5 }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (serperRes.ok) {
              const serperData = (await serperRes.json()) as {
                organic?: Array<{ title: string; snippet: string; link: string }>;
              };
              if (serperData.organic && serperData.organic.length > 0) {
                console.log("[Torch WebSearch] Served by: Serper (Google Search API)");
                return {
                  query,
                  source: "serper",
                  results: serperData.organic.map((r) => ({
                    title: r.title,
                    snippet: r.snippet,
                    url: r.link,
                  })),
                };
              }
            }
          } catch (serperErr) {
            console.warn("[Torch WebSearch] Serper error:", serperErr);
          }
        }

        // 3. Brave Search API (Licensed Developer Search API)
        if (braveKey) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const braveRes = await fetch(
              `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
              {
                headers: {
                  Accept: "application/json",
                  "X-Subscription-Token": braveKey,
                },
                signal: controller.signal,
              }
            );
            clearTimeout(timeoutId);

            if (braveRes.ok) {
              const braveData = (await braveRes.json()) as {
                web?: { results?: Array<{ title: string; description: string; url: string }> };
              };
              if (braveData.web?.results && braveData.web.results.length > 0) {
                console.log("[Torch WebSearch] Served by: Brave (Search API)");
                return {
                  query,
                  source: "brave",
                  results: braveData.web.results.map((r) => ({
                    title: r.title,
                    snippet: r.description,
                    url: r.url,
                  })),
                };
              }
            }
          } catch (braveErr) {
            console.warn("[Torch WebSearch] Brave error:", braveErr);
          }
        }

        // 4. Official Public REST API: Wikipedia Full-Text Search (100% public REST API, zero scraping)
        try {
          const tryWikiSearch = async (term: string) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const wikiRes = await fetch(
              `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&utf8=&format=json`,
              {
                headers: {
                  "User-Agent": "Scrunity-Torch/1.0 (https://scrunity.com; contact@scrunity.com)",
                },
                signal: controller.signal,
              }
            );
            clearTimeout(timeoutId);

            if (!wikiRes.ok) return [];
            const wikiData = (await wikiRes.json()) as {
              query?: { search?: Array<{ title: string; snippet: string }> };
            };
            if (wikiData?.query?.search && wikiData.query.search.length > 0) {
              return wikiData.query.search.slice(0, 5).map((item) => ({
                title: item.title,
                snippet: (item.snippet || "").replace(/<[^>]*>/g, ""),
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
              }));
            }
            return [];
          };

          let wikiResults = await tryWikiSearch(query);
          if (wikiResults.length === 0) {
            // Relax search to core keywords if exact phrase returns 0 matches
            const stopWords = new Set(["a", "an", "the", "in", "on", "at", "for", "to", "of", "and", "or", "is", "are", "with", "by"]);
            const keywords = query
              .split(/\s+/)
              .filter((w) => !stopWords.has(w.toLowerCase()) && w.length > 1)
              .slice(0, 3)
              .join(" ");
            if (keywords && keywords !== query) {
              wikiResults = await tryWikiSearch(keywords);
            }
          }

          if (wikiResults.length > 0) {
            console.log("[Torch WebSearch] Served by: Wikipedia (Official REST API)");
            return {
              query,
              source: "wikipedia",
              results: wikiResults,
            };
          }
        } catch (wikiErr) {
          console.warn("[Torch WebSearch] Wikipedia REST Search Error:", wikiErr);
        }

        console.log("[Torch WebSearch] No provider returned results.");
        return {
          query,
          source: "none",
          results: [],
        };
      },
    }),
    };
  }

  return baseTools;
}

