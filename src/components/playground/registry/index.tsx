import { badgeEntry, brandTextEntry, buttonEntry } from "./actions"
import {
  exampleFormEntry,
  inputEntry,
  selectEntry,
  textareaEntry,
} from "./forms"
import { Foundations } from "./foundations"
import { cardEntry, dialogEntry, dropdownMenuEntry } from "./overlays"
import { dataTableEntry } from "./data-table"
import {
  emptyStateEntry,
  mailboxBannerEntry,
  mailboxFilterEntry,
  mailboxPageEntry,
  messageCardEntry,
  threadRowEntry,
} from "./mailbox"
import {
  campaignSearchStoppedEntry,
  campaignZeroCompaniesEntry,
  campaignZeroVerifiedEntry,
  processCardEntry,
  researchDoneEntry,
  researchFormEntry,
  researchProfileEntry,
  researchProgressEntry,
  researchSegmentsEntry,
} from "./process"
import { composerEntry, feedRowEntry, sidebarEntry } from "./shell"
import {
  campaignDataSourceStoppedEntry,
  connectDialogEntry,
  dataSourceCardEntry,
  disconnectDialogEntry,
  launchFooterEntry,
} from "./data-sources"
import { contactImportEntry, importedListsEntry, sourceChoiceEntry } from "./contact-import"
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
    description:
      "Color tokens with contrast ratios, type scale, radii, depth, icon sizes and motion.",
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
  dataTableEntry,
  emptyStateEntry,
  processCardEntry,
  dialogEntry,
  dropdownMenuEntry,
  sidebarEntry,
  composerEntry,
  feedRowEntry,
  threadRowEntry,
  messageCardEntry,
  mailboxFilterEntry,
  mailboxBannerEntry,
  mailboxPageEntry,
  researchFormEntry,
  researchProgressEntry,
  researchProfileEntry,
  researchSegmentsEntry,
  launchFooterEntry,
  sourceChoiceEntry,
  researchDoneEntry,
  campaignZeroCompaniesEntry,
  campaignSearchStoppedEntry,
  campaignZeroVerifiedEntry,
  campaignDataSourceStoppedEntry,
  dataSourceCardEntry,
  connectDialogEntry,
  disconnectDialogEntry,
  importedListsEntry,
  contactImportEntry,
]

export * from "./types"
