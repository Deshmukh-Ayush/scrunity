/**
 * Every component module in src/components, grouped by folder, with its
 * exported components. "client" = has "use client"; "data" = async server
 * component that fetches data; "shared" = no directive, renders on either side.
 * Listing only: nothing here is imported or rendered.
 */
export type ComponentKind = "client" | "shared" | "data"

export interface InventoryEntry {
  file: string
  kind: ComponentKind
  exports: string[]
}

export interface InventoryGroup {
  id: string
  title: string
  entries: InventoryEntry[]
}

const e = (file: string, kind: ComponentKind, ...exports: string[]): InventoryEntry => ({ file, kind, exports })

export const INVENTORY: InventoryGroup[] = [
  {
    id: "ui",
    title: "ui",
    entries: [
      e("alert.tsx", "shared", "Alert", "AlertAction", "AlertDescription", "AlertTitle"),
      e("badge.tsx", "shared", "Badge"),
      e("button.tsx", "shared", "Button"),
      e("card.tsx", "shared", "Card", "CardAction", "CardContent", "CardDescription", "CardFooter", "CardHeader", "CardTitle"),
      e("chart.tsx", "client", "ChartContainer", "ChartLegend", "ChartLegendContent", "ChartStyle", "ChartTooltip", "ChartTooltipContent"),
      e("chat-container.tsx", "client", "ChatContainerRoot", "ChatContainerContent", "ChatContainerScrollAnchor"),
      e("code-block.tsx", "client", "CodeBlock", "CodeBlockCode", "CodeBlockGroup"),
      e("collapsible.tsx", "client", "Collapsible", "CollapsibleContent", "CollapsibleTrigger"),
      e("dialog.tsx", "client", "Dialog", "DialogClose", "DialogContent", "DialogDescription", "DialogFooter", "DialogHeader", "DialogOverlay", "DialogPortal", "DialogTitle", "DialogTrigger"),
      e("dropdown-menu.tsx", "client", "DropdownMenu", "DropdownMenuContent", "DropdownMenuGroup", "DropdownMenuItem", "DropdownMenuLabel", "DropdownMenuSeparator", "DropdownMenuShortcut", "DropdownMenuTrigger"),
      e("field.tsx", "client", "Field", "FieldContent", "FieldDescription", "FieldError", "FieldGroup", "FieldLabel", "FieldLegend", "FieldSeparator", "FieldSet", "FieldTitle"),
      e("icons.tsx", "shared", "Hugeicons set (Mail, Plus, Check, …)"),
      e("input.tsx", "shared", "Input"),
      e("label.tsx", "client", "Label"),
      e("local-date.tsx", "client", "LocalDate"),
      e("markdown.tsx", "shared", "Markdown"),
      e("progress.tsx", "client", "Progress", "ProgressIndicator", "ProgressLabel", "ProgressTrack", "ProgressValue"),
      e("prompt-input.tsx", "client", "PromptInput", "PromptInputAction", "PromptInputActions", "PromptInputTextarea"),
      e("scroll-area.tsx", "client", "ScrollArea", "ScrollBar"),
      e("select.tsx", "client", "Select", "SelectContent", "SelectGroup", "SelectItem", "SelectLabel", "SelectScrollDownButton", "SelectScrollUpButton", "SelectSeparator", "SelectTrigger", "SelectValue"),
      e("skeleton.tsx", "shared", "Skeleton"),
      e("sonner.tsx", "client", "Toaster"),
      e("table.tsx", "client", "Table", "TableBody", "TableCaption", "TableCell", "TableFooter", "TableHead", "TableHeader", "TableRow"),
      e("textarea.tsx", "shared", "Textarea"),
      e("tool.tsx", "client", "Tool"),
      e("tooltip.tsx", "client", "Tooltip", "TooltipContent", "TooltipProvider", "TooltipTrigger"),
    ],
  },
  {
    id: "gtm",
    title: "gtm",
    entries: [
      e("company-profile-confirmation.tsx", "client", "CompanyProfileConfirmation"),
      e("market-context.tsx", "shared", "AiSizeEstimate", "MarketContextSummary"),
      e("segment-digest-card.tsx", "client", "SegmentDigestCard"),
      e("campaigns-list.tsx", "data", "CampaignsList"),
      e("campaigns-list-client.tsx", "client", "CampaignsListClient"),
    ],
  },
  {
    id: "gtm-campaign-detail",
    title: "gtm / campaign-detail",
    entries: [
      e("campaign-detail.tsx", "data", "CampaignDetail"),
      e("campaign-detail-root.tsx", "client", "CampaignDetailRoot"),
      e("campaign-detail-header.tsx", "client", "CampaignDetailHeader"),
      e("campaign-segment-digest.tsx", "client", "CampaignSegmentDigest"),
      e("draft-card.tsx", "client", "DraftCard"),
      e("draft-review-section.tsx", "client", "DraftReviewSection"),
      e("lead-search-summary.tsx", "client", "LeadSearchSummary"),
      e("mailbox-status-bar.tsx", "client", "MailboxStatusBar"),
      e("pipeline-status-banner.tsx", "client", "PipelineStatusBanner"),
      e("prospects-panel.tsx", "client", "ProspectsPanel"),
      e("stage-stepper.tsx", "client", "StageStepper"),
      e("status-badges.tsx", "shared", "DraftStatusBadge", "EmailSourceBadge"),
    ],
  },
  {
    id: "gtm-company-selection",
    title: "gtm / campaign-detail / company-selection",
    entries: [
      e("company-selection.tsx", "client", "CompanySelection"),
      e("company-selection-root.tsx", "client", "CompanySelectionRoot"),
      e("company-selection-table.tsx", "client", "CompanySelectionGrid", "CompanySelectionToolbar", "CompanySelectionFooter"),
      e("company-cells.tsx", "client", "CompanyAvatar", "CompanyCell", "DecisionMakerCell", "EmailCell", "IndustryPill", "StatusPill", "WebsiteLink"),
    ],
  },
  {
    id: "gtm-campaigns-overview",
    title: "gtm / campaigns-overview",
    entries: [
      e("campaigns-overview.tsx", "data", "CampaignsOverview"),
      e("campaigns-overview-client.tsx", "client", "CampaignsOverviewClient"),
      e("active-campaign-card.tsx", "shared", "ActiveCampaignCard"),
      e("research-run-card.tsx", "shared", "ResearchRunCard"),
      e("research-run-detail-card.tsx", "shared", "ResearchRunDetailCard"),
    ],
  },
  {
    id: "gtm-new-campaign",
    title: "gtm / new-campaign",
    entries: [
      e("new-campaign-flow.tsx", "client", "NewCampaignFlow"),
      e("company-details-form.tsx", "client", "CompanyDetailsForm"),
      e("target-market-fields.tsx", "client", "TargetMarketFields"),
      e("research-progress.tsx", "client", "ResearchProgress"),
      e("segment-selection.tsx", "client", "SegmentSelection"),
      e("campaigns-created.tsx", "shared", "CampaignsCreated"),
    ],
  },
  {
    id: "leads",
    title: "leads",
    entries: [
      e("leads-section.tsx", "data", "LeadsSection"),
      e("leads-table-client.tsx", "client", "LeadsTableClient"),
      e("lead-row.tsx", "client", "LeadRow"),
      e("lead-action.tsx", "client", "LeadAction"),
      e("lead-badges.tsx", "shared", "LeadStatusBadge", "VerificationBadge", "LinkedinIcon"),
      e("lead-review-dialog.tsx", "client", "LeadReviewDialog"),
      e("leads-filters.tsx", "client", "LeadsFilters"),
      e("leads-pagination.tsx", "shared", "LeadsPagination"),
      e("leads-skeleton.tsx", "shared", "LeadsSkeleton"),
      e("skipped-leads.tsx", "client", "SkippedLeads", "LeadSummaryLine"),
    ],
  },
  {
    id: "mailbox",
    title: "mailbox",
    entries: [
      e("mailbox.tsx", "data", "Mailbox"),
      e("mailbox-client.tsx", "client", "MailboxClient"),
      e("mailbox-header.tsx", "client", "MailboxHeader"),
      e("mailbox-settings.tsx", "client", "MailboxSettings"),
      e("imap-smtp-form.tsx", "client", "ImapSmtpForm"),
      e("thread-list.tsx", "client", "ThreadList"),
      e("thread-detail.tsx", "client", "ThreadDetail"),
      e("intent-badge.tsx", "shared", "IntentBadge"),
      e("mailbox-time.tsx", "client", "MessageTimestamp", "ThreadTimestamp"),
    ],
  },
  {
    id: "billing",
    title: "billing",
    entries: [
      e("billing-header.tsx", "data", "BillingHeader"),
      e("ai-credit-balance-card.tsx", "data", "AiCreditBalanceCard"),
      e("billing-invoices-card.tsx", "data", "BillingInvoicesCard"),
      e("credit-usage-section.tsx", "data", "CreditUsageSection"),
      e("plan-limits-card.tsx", "data", "PlanLimitsCard"),
      e("plan-subscription-card.tsx", "data", "PlanSubscriptionCard"),
      e("credit-usage-chart.tsx", "client", "CreditUsageChart"),
      e("billing-skeletons.tsx", "shared", "BillingHeaderSkeleton", "CreditBalanceSkeleton", "InvoicesSkeleton", "PlanCardSkeleton", "PlanLimitsSkeleton", "UsageChartSkeleton"),
      e("modal-trigger.tsx", "shared", "ModalTrigger"),
      e("add-seats-modal.tsx", "client", "AddSeatsModal"),
      e("buy-credits-modal.tsx", "client", "BuyCreditsModal"),
      e("upgrade-plan-modal.tsx", "client", "UpgradePlanModal"),
      e("manage-portal-button.tsx", "client", "ManagePortalButton"),
    ],
  },
  {
    id: "chat",
    title: "chat",
    entries: [
      e("agent-chat.tsx", "data", "AgentChat"),
      e("agent-chat-interface.tsx", "client", "AgentChatInterface"),
      e("agent-composer.tsx", "client", "AgentComposer"),
      e("chat-message.tsx", "shared", "ChatMessage"),
    ],
  },
  {
    id: "home",
    title: "home",
    entries: [
      e("home.tsx", "data", "Home"),
      e("home-client.tsx", "client", "HomeClient", "Greeting", "StarterPrompts"),
      e("home-feed.tsx", "client", "NeedsYou", "Today"),
      e("feed-row.tsx", "shared", "FeedRow", "FeedSection", "FeedSectionHeader"),
    ],
  },
  {
    id: "admin",
    title: "admin",
    entries: [
      e("admin-invites.tsx", "data", "AdminInvites"),
      e("admin-invites-client.tsx", "client", "AdminInvitesClient"),
      e("admin-organizations.tsx", "data", "AdminOrganizations"),
      e("admin-organizations-client.tsx", "client", "AdminOrganizationsClient"),
    ],
  },
  {
    id: "navigation",
    title: "shell",
    entries: [
      e("shell/app-shell.tsx", "client", "AppShell"),
      e("shell/app-sidebar.tsx", "data", "AppSidebar"),
      e("shell/sidebar-content.tsx", "client", "SidebarContent", "CreditsPill"),
      e("shell/sidebar-item.tsx", "client", "SidebarItem", "SidebarSectionLabel", "SidebarGroup"),
      e("shell/sidebar-chats.tsx", "client", "SidebarChats"),
      e("shell/workspace-menu.tsx", "client", "WorkspaceMenu"),
    ],
  },
  {
    id: "auth-onboarding",
    title: "auth · onboarding · invite",
    entries: [
      e("auth/sign-in.tsx", "client", "SignInComp"),
      e("auth/magic-link-form.tsx", "client", "MagicLinkForm"),
      e("onboarding/onboard.tsx", "client", "Onboard"),
      e("invite/accept-invitation.tsx", "client", "AcceptInvitation"),
    ],
  },
  {
    id: "other",
    title: "docs · landing · og · providers",
    entries: [
      e("docs/doc-components.tsx", "shared", "Callout", "Code", "CodeBlock", "H3", "P", "Section", "Table"),
      e("landing/container.tsx", "shared", "Container"),
      e("layout/container.tsx", "shared", "Container"),
      e("og/og-template.tsx", "shared", "OgTemplate"),
      e("providers/posthog-provider.tsx", "client", "PostHogProvider"),
      e("theme-provider.tsx", "client", "ThemeProvider"),
    ],
  },
]
