"use client"

import { ExternalLink } from "@/components/ui/icons"
import { useCampaignDetail } from "./campaign-detail-root"
import { EmailSourceBadge } from "./status-badges"

/** Prospect companies (with size/follower snapshots) beside the decision-makers found. */
export function ProspectsPanel() {
  const { data } = useCampaignDetail()
  const { companies, contacts, snapshots } = data
  // Company-database campaigns use the selection table instead.
  if (data.usesCompanyDatabase) return null
  const discoveryNote = data.campaign.discoveryNote

  return (
    <div className="grid gap-6 pt-4 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Prospect Companies ({companies.length})
        </h3>
        {discoveryNote && (
          <p
            role="status"
            className="rounded-md border border-warning-border bg-warning-tint p-2.5 text-xs text-foreground"
          >
            {discoveryNote}
          </p>
        )}
        <div className="space-y-2">
          {companies.map((c) => {
            const snap = snapshots.find((s) => s.prospectCompanyId === c.id)
            return (
              <div
                key={c.id}
                className="space-y-1.5 rounded-md border bg-card p-3 text-xs"
              >
                <div className="flex items-center justify-between font-medium text-foreground">
                  <span>{c.name}</span>
                  <a
                    href={`https://${c.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    aria-label={`Open ${c.domain}`}
                  >
                    <ExternalLink className="size-3" />
                  </a>
                </div>
                <p className="line-clamp-2 text-muted-foreground">
                  {c.description}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                  <span>{c.location}</span>
                  {snap?.employeeCountLabel && (
                    <span>• {snap.employeeCountLabel}</span>
                  )}
                  {snap?.linkedinFollowerCount && (
                    <span>
                      • {snap.linkedinFollowerCount.toLocaleString("en-US")}{" "}
                      followers
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Decision-Makers & Verification ({contacts.length})
        </h3>
        <div className="space-y-2">
          {contacts.map((ct) => (
            <div
              key={ct.id}
              className="space-y-1.5 rounded-md border bg-card p-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{ct.name}</span>
                <EmailSourceBadge source={ct.emailSource} />
              </div>
              <div className="text-muted-foreground">{ct.title}</div>
              <div className="font-mono text-[11px] text-foreground/80">
                {ct.email || "No email available"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
