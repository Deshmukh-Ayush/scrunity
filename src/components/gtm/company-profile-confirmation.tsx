"use client"

import { Loader2 } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export interface SynthesizedProfile {
  summary: string
  industry: string
  productFocus: string
  targetCustomerLanguage: string
  signals: string[]
}

const cardClass = "flex flex-col gap-6 rounded-xl border border-transparent bg-surface p-4 shadow-surface sm:p-6"

/**
 * Step 3: what research understood about the company. Continue, or edit the
 * description and run research again (the flow's existing re-run).
 */
export function CompanyProfileConfirmation({
  profile,
  companyDescription,
  isEditing,
  isSaving,
  onDescriptionChange,
  onEdit,
  onCancelEdit,
  onContinue,
  onSave,
}: {
  profile: SynthesizedProfile | null | undefined
  companyDescription: string
  isEditing: boolean
  isSaving: boolean
  onDescriptionChange: (description: string) => void
  onEdit: () => void
  onCancelEdit: () => void
  onContinue: () => void
  onSave: () => void
}) {
  if (!profile) {
    return (
      <div className={cardClass}>
        <p role="status" className="flex items-center gap-2 text-body text-fg-muted">
          <Loader2 className="size-4 motion-safe:animate-spin" />
          Preparing your company profile…
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg-strong">Check your company profile</h1>
        <p className="text-body text-fg-muted">
          This is what research understood about your company. Customer
          segments are built from it, so fix anything that's off before you
          continue.
        </p>
      </div>

      <section aria-label="Company profile" className={cardClass}>
        <p className="text-body text-fg-strong">{profile.summary}</p>

        <dl className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta text-fg-muted">Industry</dt>
            <dd className="text-body text-fg-strong">{profile.industry}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta text-fg-muted">Product focus</dt>
            <dd className="text-body text-fg-strong">{profile.productFocus}</dd>
          </div>
        </dl>

        {profile.signals.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <h2 className="text-meta text-fg-muted">What research noticed</h2>
            <ul className="flex flex-wrap gap-1.5">
              {profile.signals.map((signal) => (
                <li key={signal} className="max-w-full">
                  <Badge variant="neutral">{signal}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isEditing && (
          <Field className="border-t border-border pt-5">
            <FieldLabel htmlFor="profile-description">What your company does</FieldLabel>
            <Textarea
              id="profile-description"
              rows={4}
              autoFocus
              value={companyDescription}
              aria-describedby="profile-description-help"
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
            <FieldDescription id="profile-description-help">
              Research runs again from the start with this description.
            </FieldDescription>
          </Field>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={onCancelEdit} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="brand"
                onClick={onSave}
                loading={isSaving}
                disabled={!companyDescription.trim()}
              >
                Save and run research again
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onEdit}>Edit description</Button>
              <Button variant="brand" onClick={onContinue}>
                Looks right, continue
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
