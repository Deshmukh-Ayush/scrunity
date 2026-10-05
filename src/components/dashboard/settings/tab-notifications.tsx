"use client"

import * as React from "react"
import { Bell, Mail, FileText, CheckCircle2 } from "lucide-react"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"

export function TabNotifications() {
  const [workspaceAlerts, setWorkspaceAlerts] = React.useState(true)
  const [teamUpdates, setTeamUpdates] = React.useState(true)
  const [weeklyDigest, setWeeklyDigest] = React.useState(false)
  const [saved, setSaved] = React.useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col gap-6">
      <ConcentricCard
        label="Email Notification Preferences"
        icon={Bell}
        innerClassName="p-6 gap-6"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {/* Toggle 1: Workspace Alerts */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">Workspace Alerts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send email notifications for critical workspace security and organization updates.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWorkspaceAlerts(!workspaceAlerts)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                workspaceAlerts ? "bg-brand" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  workspaceAlerts ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="h-px w-full bg-border/20" />

          {/* Toggle 2: Team Updates */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand mt-0.5">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">Team Member Updates</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send email notifications when teammates accept invitations or join your workspace.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTeamUpdates(!teamUpdates)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                teamUpdates ? "bg-brand" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  teamUpdates ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="h-px w-full bg-border/20" />

          {/* Toggle 3: Weekly Digest */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-foreground">Weekly Digest</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send weekly summary reports covering workspace activity and subscription status.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWeeklyDigest(!weeklyDigest)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                weeklyDigest ? "bg-brand" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  weeklyDigest ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end pt-4 border-t border-border/20">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-transform hover:bg-brand-hover active:scale-[0.96]"
            >
              {saved ? "Saved preferences!" : "Save preferences"}
            </button>
          </div>
        </form>
      </ConcentricCard>
    </div>
  )
}
