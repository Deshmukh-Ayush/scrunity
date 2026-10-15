import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, Plus, Send, Trash2, XCircle } from "@/components/ui/icons"
import type { ShowcaseEntry, StateName } from "./types"

const INTERACTIVE: StateName[] = ["default", "hover", "focus-visible", "pressed", "disabled", "loading"]
const VARIANTS = ["secondary", "outline", "ghost", "brand", "danger"] as const
const SIZES = ["sm", "md", "lg"] as const

export const buttonEntry: ShowcaseEntry = {
  id: "button",
  name: "Button",
  group: "Actions",
  description:
    "Secondary is the default. Brand is for the one action per view that needs attention; most views have none.",
  render: () => (
    <div className="flex flex-col gap-6">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <span className="w-20 font-mono text-meta text-fg-muted">{variant}</span>
          {SIZES.map((size) => (
            <Button key={size} variant={variant} size={size}>
              {variant === "danger" ? "Delete campaign" : variant === "brand" ? "Launch campaign" : "Save changes"}
            </Button>
          ))}
          <Button variant={variant}>
            <Plus data-icon="inline-start" />
            New campaign
          </Button>
          <Button variant={variant} size="icon" aria-label="Add">
            <Plus />
          </Button>
        </div>
      ))}
    </div>
  ),
  states: VARIANTS.map((variant) => ({
    label: variant,
    supports: INTERACTIVE,
    render: (props) => (
      <Button variant={variant} {...props}>
        {variant === "danger" ? <Trash2 data-icon="inline-start" /> : <Send data-icon="inline-start" />}
        {variant === "danger" ? "Delete" : "Send emails"}
      </Button>
    ),
  })),
}

export const badgeEntry: ShowcaseEntry = {
  id: "badge",
  name: "Badge",
  group: "Display",
  description:
    "Neutral by default. Status variants use the tint and text pairs and always carry a label, ideally an icon.",
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge>Draft</Badge>
      <Badge variant="outline">Stage 4</Badge>
      <Badge variant="success">
        <CheckCircle2 data-icon="inline-start" />
        Verified
      </Badge>
      <Badge variant="warning">
        <AlertTriangle data-icon="inline-start" />
        Needs review
      </Badge>
      <Badge variant="danger">
        <XCircle data-icon="inline-start" />
        Bounced
      </Badge>
      <Badge>12 leads</Badge>
    </div>
  ),
}
