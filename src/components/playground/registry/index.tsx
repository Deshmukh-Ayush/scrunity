import { badgeEntry, brandTextEntry, buttonEntry } from "./actions"
import { exampleFormEntry, inputEntry, selectEntry, textareaEntry } from "./forms"
import { Foundations } from "./foundations"
import { cardEntry, dialogEntry, dropdownMenuEntry } from "./overlays"
import type { ShowcaseEntry } from "./types"

/**
 * Every showcase component, in display order. Read by the component testing
 * route (/playground/components/document/testing) and the component canvas.
 * Components that load data from the database are not registered.
 */
export const SHOWCASE: ShowcaseEntry[] = [
  {
    id: "foundations",
    name: "Foundations",
    group: "Foundations",
    description: "Color tokens with contrast ratios, type scale, radii, depth, icon sizes and motion.",
    render: () => <Foundations />,
  },
  buttonEntry,
  brandTextEntry,
  badgeEntry,
  inputEntry,
  textareaEntry,
  selectEntry,
  exampleFormEntry,
  cardEntry,
  dialogEntry,
  dropdownMenuEntry,
]

export * from "./types"
