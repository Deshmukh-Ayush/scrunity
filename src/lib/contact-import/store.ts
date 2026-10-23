import "server-only"
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmContactImport,
  gtmContactImportRow,
  gtmDoNotContact,
  gtmEmailDraft,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
  gtmSuppressionEntry,
  user,
} from "@/db/schema"
import { ATTESTATION_VERSION } from "./copy"
import { planImportDelete } from "./delete-plan"
import type { ImportReview, OrgContactChecks } from "./review"
import type { PublicImport } from "./types"

/**
 * Imported lists in the database. Every query is scoped to the organization.
 * Logs carry counts and ids only, never a row's contents.
 */

const CHUNK = 500
const chunks = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK))

/** The organization's contacts, opt-outs and platform suppression for one file's emails and domains. */
export async function loadOrgContactChecks(
  organizationId: string,
  { emails, domains }: { emails: string[]; domains: string[] },
  /** False when a list's own campaign checks its rows (they are in an active list by definition). */
  { includeListRows = true }: { includeListRows?: boolean } = {}
): Promise<OrgContactChecks> {
  const existingKeys = new Set<string>()
  const doNotContact = new Set<string>()
  const suppressedEmails = new Set<string>()
  const suppressedDomains = new Set<string>()

  for (const part of chunks(emails)) {
    const [contacts, listed, optOuts, suppressed] = await Promise.all([
      db
        .select({ email: sql<string>`lower(${gtmContact.email})` })
        .from(gtmContact)
        .innerJoin(gtmProspectCompany, eq(gtmContact.prospectCompanyId, gtmProspectCompany.id))
        .innerJoin(gtmOutreachCampaign, eq(gtmProspectCompany.outreachCampaignId, gtmOutreachCampaign.id))
        .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
        .where(and(eq(gtmResearchRun.organizationId, organizationId), inArray(sql`lower(${gtmContact.email})`, part))),
      db
        .select({ email: gtmContactImportRow.email })
        .from(gtmContactImportRow)
        .innerJoin(gtmContactImport, eq(gtmContactImportRow.importId, gtmContactImport.id))
        .where(
          and(
            eq(gtmContactImportRow.organizationId, organizationId),
            eq(gtmContactImport.status, "active"),
            inArray(gtmContactImportRow.email, part)
          )
        ),
      db
        .select({ email: gtmDoNotContact.email })
        .from(gtmDoNotContact)
        .where(and(eq(gtmDoNotContact.organizationId, organizationId), inArray(gtmDoNotContact.email, part))),
      db.select({ email: gtmSuppressionEntry.email }).from(gtmSuppressionEntry).where(inArray(gtmSuppressionEntry.email, part)),
    ])
    for (const r of [...contacts, ...(includeListRows ? listed : [])]) if (r.email) existingKeys.add(`email:${r.email}`)
    for (const r of optOuts) doNotContact.add(r.email)
    for (const r of suppressed) if (r.email) suppressedEmails.add(r.email)
  }

  for (const part of chunks(domains)) {
    const [domainRows, namedContacts, namedRows] = await Promise.all([
      // Domain-wide entries only (aggregators), as in checkSuppression.
      db
        .select({ domain: gtmSuppressionEntry.domain })
        .from(gtmSuppressionEntry)
        .where(
          and(
            inArray(gtmSuppressionEntry.domain, part),
            or(isNull(gtmSuppressionEntry.email), eq(gtmSuppressionEntry.reason, "aggregator_domain"))
          )
        ),
      // People without an email dedupe on name + company domain.
      db
        .select({ name: sql<string>`lower(${gtmContact.name})`, domain: gtmProspectCompany.domain })
        .from(gtmContact)
        .innerJoin(gtmProspectCompany, eq(gtmContact.prospectCompanyId, gtmProspectCompany.id))
        .innerJoin(gtmOutreachCampaign, eq(gtmProspectCompany.outreachCampaignId, gtmOutreachCampaign.id))
        .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
        .where(and(eq(gtmResearchRun.organizationId, organizationId), inArray(gtmProspectCompany.domain, part))),
      db
        .select({
          name: sql<string>`lower(coalesce(${gtmContactImportRow.fullName}, concat_ws(' ', ${gtmContactImportRow.firstName}, ${gtmContactImportRow.lastName})))`,
          domain: gtmContactImportRow.companyDomain,
        })
        .from(gtmContactImportRow)
        .innerJoin(gtmContactImport, eq(gtmContactImportRow.importId, gtmContactImport.id))
        .where(
          and(
            eq(gtmContactImportRow.organizationId, organizationId),
            eq(gtmContactImport.status, "active"),
            inArray(gtmContactImportRow.companyDomain, part)
          )
        ),
    ])
    for (const r of domainRows) suppressedDomains.add(r.domain)
    for (const r of [...namedContacts, ...(includeListRows ? namedRows : [])]) if (r.name && r.domain) existingKeys.add(`name:${r.name}@${r.domain}`)
  }
  return { existingKeys, doNotContact, suppressedEmails, suppressedDomains }
}

/**
 * Stores one reviewed list: the import record (with the attestation), then
 * its rows in chunks, then marks it active. The HTTP driver has no
 * transactions, so a failure part-way removes the rows and marks it failed.
 */
export async function saveImport({
  organizationId,
  userId,
  fileName,
  review,
}: {
  organizationId: string
  userId: string
  fileName: string
  review: ImportReview
}): Promise<string> {
  const { counts } = review
  const [created] = await db
    .insert(gtmContactImport)
    .values({
      organizationId,
      uploadedByUserId: userId,
      fileName,
      totalRows: counts.totalRows,
      importedCount: counts.imported,
      duplicateCount: counts.duplicates,
      invalidCount: counts.invalid,
      suppressedCount: counts.suppressed,
      personalEmailCount: counts.personalEmails,
      attestedAt: new Date(),
      attestationVersion: ATTESTATION_VERSION,
      status: "importing",
    })
    .returning({ id: gtmContactImport.id })
  try {
    for (const part of chunks(review.accepted)) {
      await db.insert(gtmContactImportRow).values(
        part.map((r) => ({
          importId: created.id,
          organizationId,
          rowNumber: r.rowNumber,
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          fullName: r.fullName,
          title: r.title,
          companyName: r.company,
          companyDomain: r.domain,
          website: r.website,
          linkedinUrl: r.linkedinUrl,
          phone: r.phone,
          city: r.city,
          country: r.country,
          notes: r.notes,
          personalEmail: r.personalEmail,
        }))
      )
    }
    await db.update(gtmContactImport).set({ status: "active" }).where(eq(gtmContactImport.id, created.id))
  } catch (err) {
    console.error(`[Contact import] import ${created.id} failed while storing rows: ${err instanceof Error ? err.name : "error"}`)
    await db.delete(gtmContactImportRow).where(eq(gtmContactImportRow.importId, created.id))
    await db.update(gtmContactImport).set({ status: "failed" }).where(eq(gtmContactImport.id, created.id))
    throw err
  }
  console.log(`[Contact import] org ${organizationId}: import ${created.id} stored ${counts.imported} of ${counts.totalRows} rows`)
  return created.id
}

/** An email to this person left the mailbox (sent, or sent and then bounced). */
const sentDraftExists = (contactId: unknown) => sql`EXISTS (
  SELECT 1 FROM gtm_email_draft d WHERE d.contact_id = ${contactId} AND (d.sent_at IS NOT NULL OR d.status = 'sent')
)`

export async function listImports(organizationId: string): Promise<PublicImport[]> {
  const rows = await db
    .select({
      id: gtmContactImport.id,
      fileName: gtmContactImport.fileName,
      createdAt: gtmContactImport.createdAt,
      uploadedByName: user.name,
      totalRows: gtmContactImport.totalRows,
      imported: gtmContactImport.importedCount,
      duplicates: gtmContactImport.duplicateCount,
      invalid: gtmContactImport.invalidCount,
      suppressed: gtmContactImport.suppressedCount,
      personalEmails: gtmContactImport.personalEmailCount,
      emailedCount: sql<number>`(
        SELECT count(*)::int FROM gtm_contact c
        WHERE c.source_import_id = ${gtmContactImport.id} AND ${sentDraftExists(sql`c.id`)}
      )`,
    })
    .from(gtmContactImport)
    .leftJoin(user, eq(gtmContactImport.uploadedByUserId, user.id))
    .where(and(eq(gtmContactImport.organizationId, organizationId), eq(gtmContactImport.status, "active")))
    .orderBy(desc(gtmContactImport.createdAt))
  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    createdAt: r.createdAt.toISOString(),
    uploadedByName: r.uploadedByName,
    counts: {
      totalRows: r.totalRows,
      imported: r.imported,
      duplicates: r.duplicates,
      invalid: r.invalid,
      suppressed: r.suppressed,
      personalEmails: r.personalEmails,
    },
    emailedCount: Number(r.emailedCount) || 0,
  }))
}

/** The organization's active import with this id, or null. */
export async function getActiveImport(organizationId: string, importId: string) {
  const [row] = await db
    .select({ id: gtmContactImport.id, fileName: gtmContactImport.fileName, importedCount: gtmContactImport.importedCount })
    .from(gtmContactImport)
    .where(
      and(
        eq(gtmContactImport.id, importId),
        eq(gtmContactImport.organizationId, organizationId),
        eq(gtmContactImport.status, "active")
      )
    )
    .limit(1)
  return row ?? null
}

/**
 * Deletes a list: drafts to its people that never left the mailbox, its people
 * who were never emailed, companies left with nobody, and its rows. People who
 * were emailed stay (reply threading, opt-outs and bounce suppression need
 * them). The import record stays as "deleted" with the attestation.
 */
export async function deleteImport(organizationId: string, importId: string, userId: string) {
  const owned = await getActiveImport(organizationId, importId)
  if (!owned) return null

  const [contacts, companies] = await Promise.all([
    db
      .select({ id: gtmContact.id, prospectCompanyId: gtmContact.prospectCompanyId })
      .from(gtmContact)
      .where(eq(gtmContact.sourceImportId, importId)),
    db.select({ id: gtmProspectCompany.id }).from(gtmProspectCompany).where(eq(gtmProspectCompany.sourceImportId, importId)),
  ])
  const contactIds = contacts.map((c) => c.id)
  const companyIds = companies.map((c) => c.id)
  const [drafts, others] = await Promise.all([
    contactIds.length === 0
      ? []
      : db
          .select({ id: gtmEmailDraft.id, contactId: gtmEmailDraft.contactId, status: gtmEmailDraft.status, sentAt: gtmEmailDraft.sentAt })
          .from(gtmEmailDraft)
          .where(inArray(gtmEmailDraft.contactId, contactIds)),
    companyIds.length === 0
      ? []
      : db
          .selectDistinct({ companyId: gtmContact.prospectCompanyId })
          .from(gtmContact)
          .where(
            and(
              inArray(gtmContact.prospectCompanyId, companyIds),
              or(isNull(gtmContact.sourceImportId), ne(gtmContact.sourceImportId, importId))
            )
          ),
  ])
  const plan = planImportDelete({ contacts, drafts, companyIds, otherContactCompanyIds: others.map((o) => o.companyId) })

  for (const part of chunks(plan.draftIds)) await db.delete(gtmEmailDraft).where(inArray(gtmEmailDraft.id, part))
  for (const part of chunks(plan.contactIds)) await db.delete(gtmContact).where(inArray(gtmContact.id, part))
  for (const part of chunks(plan.companyIds)) await db.delete(gtmProspectCompany).where(inArray(gtmProspectCompany.id, part))
  const removed = plan.contactIds
  const kept = plan.keptContacts
  await db.delete(gtmContactImportRow).where(eq(gtmContactImportRow.importId, importId))
  await db
    .update(gtmContactImport)
    .set({ status: "deleted", deletedAt: new Date(), deletedByUserId: userId })
    .where(eq(gtmContactImport.id, importId))
  console.log(`[Contact import] org ${organizationId}: import ${importId} deleted, ${removed.length} contacts removed, ${kept} kept`)
  return { removedContacts: removed.length, keptContacts: kept }
}
