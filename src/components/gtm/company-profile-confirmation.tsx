"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"

export interface SynthesizedProfile {
  summary: string
  industry: string
  productFocus: string
  targetCustomerLanguage: string
  signals: string[]
}

export function CompanyProfileConfirmation({
  profile,
  companyDescription,
  isEditing,
  isSaving,
  onDescriptionChange,
  onEdit,
  onContinue,
  onSave,
}: {
  profile: SynthesizedProfile | null | undefined
  companyDescription: string
  isEditing: boolean
  isSaving: boolean
  onDescriptionChange: (description: string) => void
  onEdit: () => void
  onContinue: () => void
  onSave: () => void
}) {
  if (!profile) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent
          className="flex items-center gap-2 p-6 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" />
          Preparing your company profile…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Confirm your company profile</CardTitle>
        <CardDescription>
          Review what the research agent understood before using it to generate
          ICP segments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-6">{profile.summary}</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Industry</dt>
            <dd className="font-medium">{profile.industry}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Product focus</dt>
            <dd className="font-medium">{profile.productFocus}</dd>
          </div>
        </dl>
        <div className="space-y-2">
          <p className="text-sm font-medium">Signals</p>
          <div className="flex flex-wrap gap-2">
            {profile.signals.map((signal) => (
              <Badge key={signal} variant="secondary">
                {signal}
              </Badge>
            ))}
          </div>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            <Label htmlFor="profile-description">Company description</Label>
            <Textarea
              id="profile-description"
              value={companyDescription}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {isEditing ? (
            <Button
              variant="outline"
              onClick={onSave}
              disabled={isSaving || !companyDescription.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Restarting research…
                </>
              ) : (
                "Save and re-run research"
              )}
            </Button>
          ) : (
            <Button variant="outline" onClick={onEdit}>
              Something&apos;s off — edit my description
            </Button>
          )}
          {!isEditing ? (
            <Button onClick={onContinue}>Looks good, continue</Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
