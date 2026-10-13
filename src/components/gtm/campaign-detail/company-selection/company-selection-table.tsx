"use client"

import {
  Banknote,
  Building2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Sparkles,
  Tag,
  UserRound,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCampaignDetail } from "../campaign-detail-root"
import { useCompanySelection } from "./company-selection-root"
import {
  CompanyCell,
  DecisionMakerCell,
  EmailCell,
  IndustryPill,
  WebsiteLink,
  locationText,
} from "./company-cells"

/** Native checkbox kept neutral: the brand color is reserved for the primary action. */
function RowCheckbox(props: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className="size-3.5 cursor-pointer accent-foreground disabled:cursor-default disabled:opacity-60"
      {...props}
    />
  )
}

function HeadLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </span>
  )
}

/** Title, explanation and the select-all / clear actions. */
export function CompanySelectionToolbar() {
  const { data } = useCampaignDetail()
  const { companies, isEditable, showPeople, selectAll, clear } =
    useCompanySelection()
  const { discoveryNote, currentStage } = data.campaign
  return (
    <div className="space-y-3">
      {discoveryNote && (
        <p
          role="status"
          className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-foreground"
        >
          {discoveryNote}
        </p>
      )}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Companies ({companies.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            {isEditable
              ? "Untick any company you don't want. Only the ones you keep are searched for decision makers."
              : showPeople
                ? "Decision makers for the companies you kept. Excluded companies were skipped."
                : "Companies found for this segment."}
            {currentStage === "done_for_now" &&
              " Email lookup isn't switched on yet, so this campaign stops here for now."}
          </p>
        </div>
        {isEditable && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={selectAll}
            >
              Select all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={clear}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** The CRM-style table. Scrolls sideways inside its own container on narrow screens. */
export function CompanySelectionGrid() {
  const { data } = useCampaignDetail()
  const {
    companies,
    peopleByCompany,
    selectedIds,
    isEditable,
    showPeople,
    toggle,
    selectAll,
    clear,
  } = useCompanySelection()
  const searching =
    data.campaign.currentStage === "find_contacts" &&
    data.campaign.status === "in_progress"
  const allSelected =
    companies.length > 0 && selectedIds.size === companies.length

  return (
    <div className="rounded-lg border bg-card">
      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-9">
              <RowCheckbox
                aria-label="Select all companies"
                checked={allSelected}
                disabled={!isEditable}
                onChange={() => (allSelected ? clear() : selectAll())}
              />
            </TableHead>
            <TableHead>
              <HeadLabel icon={Building2}>Company</HeadLabel>
            </TableHead>
            <TableHead>
              <HeadLabel icon={MapPin}>Location</HeadLabel>
            </TableHead>
            <TableHead>
              <HeadLabel icon={Tag}>Industry</HeadLabel>
            </TableHead>
            <TableHead className="text-right">
              <HeadLabel icon={Users}>Headcount</HeadLabel>
            </TableHead>
            <TableHead>
              <HeadLabel icon={Banknote}>Est. revenue</HeadLabel>
            </TableHead>
            <TableHead>
              <HeadLabel icon={Sparkles}>Fit</HeadLabel>
            </TableHead>
            <TableHead>
              <HeadLabel icon={Globe}>Website</HeadLabel>
            </TableHead>
            {showPeople && (
              <>
                <TableHead>
                  <HeadLabel icon={UserRound}>Decision maker</HeadLabel>
                </TableHead>
                <TableHead>
                  <HeadLabel icon={Mail}>Email</HeadLabel>
                </TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={showPeople ? 10 : 8}
                className="py-8 text-center text-muted-foreground"
              >
                No companies to choose from. Re-run the campaign with a wider
                region or size band.
              </TableCell>
            </TableRow>
          )}
          {companies.map((company) => {
            const selected = selectedIds.has(company.id)
            const people = peopleByCompany.get(company.id) ?? []
            return (
              <TableRow
                key={company.id}
                data-excluded={!selected || undefined}
                className="align-top data-[excluded]:opacity-55"
              >
                <TableCell>
                  <RowCheckbox
                    aria-label={`Keep ${company.name}`}
                    checked={selected}
                    disabled={!isEditable}
                    onChange={() => toggle(company.id)}
                  />
                </TableCell>
                <TableCell>
                  <CompanyCell company={company} />
                  {!isEditable && !selected && (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Excluded by you
                    </span>
                  )}
                </TableCell>
                <TableCell className="min-w-[140px] text-muted-foreground">
                  {locationText(company)}
                </TableCell>
                <TableCell>
                  <IndustryPill industry={company.industry} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {company.headcount != null
                    ? company.headcount.toLocaleString("en-US")
                    : "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {company.revenueRange || "—"}
                </TableCell>
                <TableCell className="max-w-[260px] min-w-[200px] whitespace-normal text-muted-foreground">
                  {company.fitNote || "—"}
                </TableCell>
                <TableCell>
                  <WebsiteLink company={company} />
                </TableCell>
                {showPeople && (
                  <>
                    <TableCell>
                      <DecisionMakerCell
                        company={company}
                        people={people}
                        searching={searching}
                      />
                    </TableCell>
                    <TableCell>
                      <EmailCell company={company} people={people} />
                    </TableCell>
                  </>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** Sticky summary with the one brand-colored action. */
export function CompanySelectionFooter() {
  const {
    companies,
    peopleByCompany,
    selectedIds,
    perCompany,
    isEditable,
    showPeople,
    isConfirming,
    confirm,
  } = useCompanySelection()
  const peopleFound = [...peopleByCompany.values()].reduce(
    (n, list) => n + list.length,
    0
  )
  const prospects = selectedIds.size * perCompany

  return (
    <div className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-lg border bg-background/95 px-4 py-3 text-xs backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground">{companies.length}</span>{" "}
        {companies.length === 1 ? "company" : "companies"} in view ·{" "}
        <span className="font-medium text-foreground">{selectedIds.size}</span>{" "}
        selected
        {isEditable && (
          <>
            {" "}
            · uses up to{" "}
            <span className="font-medium text-foreground">
              {prospects}
            </span>{" "}
            {prospects === 1 ? "prospect" : "prospects"} ({perCompany} per
            company)
          </>
        )}
        {showPeople && (
          <>
            {" "}
            · <span className="font-medium text-foreground">
              {peopleFound}
            </span>{" "}
            decision {peopleFound === 1 ? "maker" : "makers"} found
          </>
        )}
      </p>
      {isEditable && (
        <Button
          size="sm"
          onClick={confirm}
          disabled={selectedIds.size === 0 || isConfirming}
          className="h-8 gap-1.5 self-end text-xs sm:self-auto"
        >
          {isConfirming ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UserRound className="size-3.5" />
          )}
          Find decision makers
        </Button>
      )}
    </div>
  )
}
