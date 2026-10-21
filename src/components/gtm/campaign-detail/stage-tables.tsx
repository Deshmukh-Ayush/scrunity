"use client"

import { ExternalLink } from "@/components/ui/icons"
import { DataTable, DateCell, NumberCell, StatusCell, TextCell, type DataTableColumn } from "@/components/ui/data-table"
import { CheckCircleSolid } from "@/components/icons/status"
import { IMPORT_COPY } from "@/lib/contact-import/copy"
import { useCampaignDetail } from "./campaign-detail-root"
import { DraftStatusBadge } from "./status-badges"
import type { Company, Contact, Draft } from "./types"

/**
 * Stage tables on the shared DataTable. Outer rows carry what you scan for;
 * what you open is the company's site or, for drafts, the review cards.
 */

/** A usable contact's email status: vendor-verified, or from the customer's own list. Label plus icon, never color alone. */
function ContactEmailStatus({ source }: { source: string }) {
  if (source === "verified") return <StatusCell label="Verified" tone="success" icon={<CheckCircleSolid className="size-3.5" />} />
  if (source === "user_provided") return <StatusCell label={IMPORT_COPY.emailStatus} />
  return <StatusCell label="Not verified" />
}

function WebsiteLink({ domain }: { domain: string }) {
  if (!domain) return <TextCell value={null} />
  return (
    <a
      href={`https://${domain}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-48 items-center gap-1 truncate rounded-sm text-fg-default underline-offset-2 hover:underline"
    >
      <span className="truncate">{domain}</span>
      <ExternalLink className="size-3.5 shrink-0 text-fg-muted" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

export function CompaniesTable() {
  const { data } = useCampaignDetail()
  const size = (c: Company) => data.snapshots.find((s) => s.prospectCompanyId === c.id)
  const columns: DataTableColumn<Company>[] = [
    {
      id: "name",
      header: "Company",
      type: "text",
      cell: (c) => <TextCell value={c.name} className="font-medium text-fg-strong" />,
      sortValue: (c) => c.name,
    },
    { id: "site", header: "Website", type: "text", cell: (c) => <WebsiteLink domain={c.domain} /> },
    { id: "location", header: "Location", type: "text", cell: (c) => <TextCell value={c.location} muted />, sortValue: (c) => c.location },
    { id: "size", header: "Size", type: "text", cell: (c) => <TextCell value={size(c)?.employeeCountLabel} muted /> },
    {
      id: "followers",
      header: "Followers",
      type: "number",
      cell: (c) => <NumberCell value={size(c)?.linkedinFollowerCount ?? null} />,
      sortValue: (c) => size(c)?.linkedinFollowerCount ?? null,
    },
  ]
  return <DataTable label="Companies" columns={columns} rows={data.companies} rowKey={(c) => c.id} density="compact" />
}

export function ContactsTable() {
  const { data } = useCampaignDetail()
  const companyName = (ct: Contact) => data.companies.find((c) => c.id === ct.prospectCompanyId)?.name ?? null
  const columns: DataTableColumn<Contact>[] = [
    {
      id: "name",
      header: "Name",
      type: "text",
      cell: (ct) =>
        ct.linkedinUrl ? (
          <a
            href={ct.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-56 truncate rounded-sm font-medium text-fg-strong underline-offset-2 hover:underline"
          >
            {ct.name}
            <span className="sr-only"> on LinkedIn (opens in a new tab)</span>
          </a>
        ) : (
          <TextCell value={ct.name} className="font-medium text-fg-strong" />
        ),
      sortValue: (ct) => ct.name,
    },
    { id: "title", header: "Title", type: "text", cell: (ct) => <TextCell value={ct.title} muted />, sortValue: (ct) => ct.title },
    { id: "company", header: "Company", type: "text", cell: (ct) => <TextCell value={companyName(ct)} />, sortValue: companyName },
    { id: "email", header: "Email", type: "text", cell: (ct) => <TextCell value={ct.email} /> },
    {
      id: "emailStatus",
      header: "Email status",
      type: "status",
      className: "w-56",
      cell: (ct) => <ContactEmailStatus source={ct.emailSource} />,
      sortValue: (ct) => ct.emailSource,
    },
  ]
  return <DataTable label="Contacts" columns={columns} rows={data.contacts} rowKey={(ct) => ct.id} density="compact" />
}

export function DraftsTable({ drafts, showSentAt = false }: { drafts: Draft[]; showSentAt?: boolean }) {
  const columns: DataTableColumn<Draft>[] = [
    {
      id: "contact",
      header: "Contact",
      type: "text",
      cell: (d) => <TextCell value={d.contact.name} className="font-medium text-fg-strong" />,
      sortValue: (d) => d.contact.name,
    },
    { id: "company", header: "Company", type: "text", cell: (d) => <TextCell value={d.company.name} muted />, sortValue: (d) => d.company.name },
    { id: "subject", header: "Subject", type: "text", cell: (d) => <TextCell value={d.subject} className="max-w-96" /> },
    {
      id: "status",
      header: "Status",
      type: "status",
      cell: (d) => <DraftStatusBadge status={d.status} errorMessage={d.errorMessage} hasBounced={d.hasBounced} />,
      sortValue: (d) => d.status,
    },
    ...(showSentAt
      ? [
          {
            id: "sent",
            header: "Sent",
            type: "date",
            cell: (d: Draft) => <DateCell value={d.sentAt ?? null} />,
            sortValue: (d: Draft) => d.sentAt ?? null,
          } satisfies DataTableColumn<Draft>,
        ]
      : []),
  ]
  return <DataTable label="Emails" columns={columns} rows={drafts} rowKey={(d) => d.id} density="compact" />
}
