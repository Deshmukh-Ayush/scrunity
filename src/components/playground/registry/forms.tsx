import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ShowcaseEntry, StateName } from "./types"

const FIELD_STATES: StateName[] = ["default", "focus-visible", "disabled"]

const REGIONS = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
]

function RegionSelect({ disabled, force }: { disabled?: boolean; force?: "focus-visible" }) {
  return (
    <Select disabled={disabled} items={REGIONS}>
      <SelectTrigger className="w-56" data-force={force} aria-label="Region">
        <SelectValue placeholder="Choose a region" />
      </SelectTrigger>
      <SelectContent>
        {REGIONS.map((region) => (
          <SelectItem key={region.value} value={region.value}>
            {region.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export const inputEntry: ShowcaseEntry = {
  id: "input",
  name: "Input",
  group: "Forms",
  description: "The landing-page field recipe: brand border and ring on focus, danger when invalid.",
  render: () => (
    <div className="grid w-full max-w-sm gap-3">
      <Input aria-label="Empty" placeholder="name@company.com" />
      <Input aria-label="Filled" defaultValue="maya@northwind.io" />
      <Input aria-label="Invalid" aria-invalid defaultValue="maya@" />
      <Input aria-label="Disabled" disabled defaultValue="Locked value" />
    </div>
  ),
  states: [
    {
      label: "input",
      supports: FIELD_STATES,
      render: ({ loading: _loading, ...props }) => (
        <Input aria-label="Work email" placeholder="name@company.com" className="w-48" {...props} />
      ),
    },
  ],
}

export const textareaEntry: ShowcaseEntry = {
  id: "textarea",
  name: "Textarea",
  group: "Forms",
  description: "Same recipe as Input; grows with its content.",
  render: () => (
    <Textarea aria-label="Notes" className="max-w-sm" placeholder="What does this company sell?" />
  ),
  states: [
    {
      label: "textarea",
      supports: FIELD_STATES,
      render: ({ loading: _loading, ...props }) => (
        <Textarea aria-label="Notes" placeholder="Notes" className="w-48" {...props} />
      ),
    },
  ],
}

export const selectEntry: ShowcaseEntry = {
  id: "select",
  name: "Select",
  group: "Forms",
  description: "Trigger uses the field recipe; the menu floats with shadow-floating and the dropdown motion.",
  render: () => <RegionSelect />,
  states: [
    {
      label: "trigger",
      supports: FIELD_STATES,
      render: (props) => (
        <RegionSelect disabled={props.disabled} force={props["data-force"] === "focus-visible" ? "focus-visible" : undefined} />
      ),
    },
  ],
}

export const exampleFormEntry: ShowcaseEntry = {
  id: "example-form",
  name: "Example form",
  group: "Forms",
  description: "Field family: labels, descriptions, an error, a disabled field and the view's one brand button.",
  render: () => (
    <form className="w-full max-w-md" action={undefined}>
      <FieldSet>
        <FieldLegend>Sending mailbox</FieldLegend>
        <FieldDescription>Replies to your campaigns arrive in this inbox.</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="example-name">Sender name</FieldLabel>
            <Input id="example-name" defaultValue="Maya Chen" />
            <FieldDescription>Shown in the From line of every email.</FieldDescription>
          </Field>
          <Field data-invalid="true">
            <FieldLabel htmlFor="example-email">Sender email</FieldLabel>
            <Input id="example-email" aria-invalid defaultValue="maya@" aria-describedby="example-email-error" />
            <FieldError id="example-email-error" errors={[{ message: "Enter a full email address." }]} />
          </Field>
          <Field data-disabled="true">
            <FieldLabel htmlFor="example-host">SMTP host</FieldLabel>
            <Input id="example-host" disabled defaultValue="smtp.gmail.com" />
            <FieldDescription>Set automatically for Google accounts.</FieldDescription>
          </Field>
          <FieldSeparator />
          <Field>
            <FieldLabel htmlFor="example-signature">Signature</FieldLabel>
            <Textarea id="example-signature" placeholder="Maya Chen, Head of Growth" />
          </Field>
          <Field orientation="horizontal" className="justify-end">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
            <Button type="button" variant="brand">
              Save mailbox
            </Button>
          </Field>
        </FieldGroup>
      </FieldSet>
    </form>
  ),
}
