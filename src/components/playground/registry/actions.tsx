import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, Plus, Send, Trash2, XCircle } from "@/components/ui/icons"
import { BRAND_STOPS, COLORS, contrast } from "@/lib/design/tokens"
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

const BRAND_TEXT_OPTIONS = [
  { label: "White text (current default)", className: undefined, fg: COLORS.white },
  { label: "Near-black text", className: "text-fg-strong", fg: COLORS.textStrong },
]

export const brandTextEntry: ShowcaseEntry = {
  id: "brand-button-text",
  name: "Brand button text",
  group: "Actions",
  description:
    "White vs near-black text on the brand button, at all three sizes, with measured contrast. White stays the default until decided.",
  render: () => (
    <div className="grid w-full gap-6 sm:grid-cols-2">
      {BRAND_TEXT_OPTIONS.map((option) => (
        <div key={option.label} className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-surface">
          <div className="flex flex-col gap-0.5">
            <span className="text-body font-medium text-fg-strong">{option.label}</span>
            <span className="text-meta text-fg-muted tabular-nums">
              {contrast(option.fg, BRAND_STOPS.base).toFixed(2)}:1 on {BRAND_STOPS.base} ·{" "}
              {contrast(option.fg, BRAND_STOPS.top).toFixed(2)}:1 top ·{" "}
              {contrast(option.fg, BRAND_STOPS.bottom).toFixed(2)}:1 bottom
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {SIZES.map((size) => (
              <Button key={size} variant="brand" size={size} className={option.className}>
                Launch campaign
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
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
      <Badge variant="neutral">Stage 4</Badge>
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
