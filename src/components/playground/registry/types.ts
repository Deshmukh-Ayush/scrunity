import type { ReactNode } from "react"

/** The interaction states every showcase entry is shown in, in order. */
export const STATE_NAMES = ["default", "hover", "focus-visible", "pressed", "disabled", "loading"] as const
export type StateName = (typeof STATE_NAMES)[number]

/**
 * Props that force a state without user input. `data-force` is read by the
 * ui-hover / ui-pressed / ui-focus custom variants in globals.css.
 */
export interface ForcedStateProps {
  "data-force"?: "hover" | "pressed" | "focus-visible"
  disabled?: boolean
  loading?: boolean
}

export function forcedStateProps(state: StateName): ForcedStateProps {
  switch (state) {
    case "hover":
    case "pressed":
    case "focus-visible":
      return { "data-force": state }
    case "disabled":
      return { disabled: true }
    case "loading":
      return { loading: true }
    default:
      return {}
  }
}

export interface StatesRow {
  label: string
  /** States this row supports; the others are shown as not applicable. */
  supports: readonly StateName[]
  render: (props: ForcedStateProps) => ReactNode
}

export type ShowcaseGroup = "Foundations" | "Actions" | "Forms" | "Display" | "Overlays"

export interface ShowcaseEntry {
  id: string
  name: string
  group: ShowcaseGroup
  description: string
  render: () => ReactNode
  states?: StatesRow[]
}
