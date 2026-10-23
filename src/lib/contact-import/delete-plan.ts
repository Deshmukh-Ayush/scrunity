/**
 * What deleting an imported list removes. Pure, so the rule is unit-tested:
 * a draft goes when it never left the mailbox; a person goes when nothing was
 * ever sent to them; a company goes when none of its people stay. People who
 * were emailed stay, because reply threading, opt-outs and bounce suppression
 * read their rows.
 */

export interface DeleteCandidateDraft {
  id: string
  contactId: string
  status: string
  sentAt: Date | string | null
}

export interface DeleteCandidateContact {
  id: string
  prospectCompanyId: string
}

export interface ImportDeletePlan {
  draftIds: string[]
  contactIds: string[]
  companyIds: string[]
  keptContacts: number
}

export const wasSent = (d: Pick<DeleteCandidateDraft, "status" | "sentAt">) => d.sentAt != null || d.status === "sent"

export function planImportDelete({
  contacts,
  drafts,
  companyIds,
  otherContactCompanyIds = [],
}: {
  contacts: DeleteCandidateContact[]
  drafts: DeleteCandidateDraft[]
  /** Companies created from this list. */
  companyIds: string[]
  /** Companies of this list that also hold people from elsewhere (never removed). */
  otherContactCompanyIds?: string[]
}): ImportDeletePlan {
  const emailed = new Set(drafts.filter(wasSent).map((d) => d.contactId))
  const keptContacts = contacts.filter((c) => emailed.has(c.id))
  const keptCompanies = new Set([...keptContacts.map((c) => c.prospectCompanyId), ...otherContactCompanyIds])
  return {
    draftIds: drafts.filter((d) => !wasSent(d)).map((d) => d.id),
    contactIds: contacts.filter((c) => !emailed.has(c.id)).map((c) => c.id),
    companyIds: companyIds.filter((id) => !keptCompanies.has(id)),
    keptContacts: keptContacts.length,
  }
}
