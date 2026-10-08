import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index, integer, jsonb } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),

  plan: text("plan", { enum: ["free", "freelancer", "agency", "enterprise"] }).default("free").notNull(),
  globalCurrency: text("global_currency", { enum: ["USD", "INR"] }).default("USD").notNull(),
  logoUrl: text("logo_url"),

  // Billing & Subscription Fields
  dodoCustomerId: text("dodo_customer_id"),
  dodoSubscriptionId: text("dodo_subscription_id"),
  subscriptionStatus: text("subscription_status"), // e.g., 'active', 'canceled', 'past_due', 'trialing'
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),

  metadata: text("metadata"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),

  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, {
      onDelete: "cascade",
    }),

  userId: text("user_id")
    .notNull()
    .references(() => user.id, {
      onDelete: "cascade",
    }),

  role: text("role").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("member_org_idx").on(table.organizationId),
  index("member_user_idx").on(table.userId),
]);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),

  email: text("email").notNull(),

  inviterId: text("inviter_id")
    .references(() => user.id, { onDelete: "set null" }),

  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, {
      onDelete: "cascade",
    }),

  role: text("role").notNull(),

  status: text("status", { enum: ["pending", "accepted", "declined", "expired"] }).default("pending").notNull(),

  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("invitation_org_idx").on(table.organizationId),
  index("invitation_inviter_idx").on(table.inviterId),
]);

export const organizationRelations = relations(
  organization,
  ({ many }) => ({
    members: many(member),
    invitations: many(invitation),
  })
);

export const memberRelations = relations(member, ({ one }) => ({
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),

  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
}));

export const invitationRelations = relations(
  invitation,
  ({ one }) => ({
    organization: one(organization, {
      fields: [invitation.organizationId],
      references: [organization.id],
    }),

    inviter: one(user, {
      fields: [invitation.inviterId],
      references: [user.id],
    }),
  })
);

// ==========================================
// GTM Agent Tables
// ==========================================

export const gtmResearchRun = pgTable(
  "gtm_research_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    websiteUrl: text("website_url").notNull(),
    companyName: text("company_name").notNull(),
    companyDescription: text("company_description").notNull(),
    logoUrl: text("logo_url"),
    companySize: text("company_size", {
      enum: ["1-10", "11-50", "51-200", "200+"],
    }).notNull(),
    contextDoc: text("context_doc"),
    status: text("status").default("in_progress").notNull(),
    currentStage: text("current_stage", {
      enum: [
        "research_company",
        "research_competitors",
        "define_segments",
        "done",
      ],
    })
      .default("research_company")
      .notNull(),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    instagramUrl: text("instagram_url"),
    seoKeywords: jsonb("seo_keywords").$type<string[]>(),
    synthesizedProfile: jsonb("synthesized_profile").$type<SynthesizedCompanyProfile>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
  },
  (table) => [index("gtm_research_run_org_idx").on(table.organizationId)]
);

export interface SynthesizedCompanyProfile {
  summary: string;
  industry: string;
  productFocus: string;
  targetCustomerLanguage: string;
  signals: string[];
}

export const gtmCompetitor = pgTable(
  "gtm_competitor",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    researchRunId: text("research_run_id")
      .notNull()
      .references(() => gtmResearchRun.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    description: text("description").notNull(),
    keywords: jsonb("keywords").$type<string[]>(),
    logoUrl: text("logo_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("gtm_competitor_run_idx").on(table.researchRunId)]
);

export const gtmIcpSegment = pgTable(
  "gtm_icp_segment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    researchRunId: text("research_run_id")
      .notNull()
      .references(() => gtmResearchRun.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    painPoint: text("pain_point").notNull(),
    criteria: jsonb("criteria").$type<string[]>().notNull(),
    exampleCompanies: jsonb("example_companies")
      .$type<{ name: string; domain: string }[]>()
      .notNull(),
    // Explicitly labeled as an LLM best-guess estimate, not a verified/sourced figure
    estimatedSizeLabel: text("estimated_size_label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("gtm_icp_segment_run_idx").on(table.researchRunId)]
);

export const gtmOutreachCampaign = pgTable(
  "gtm_outreach_campaign",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    icpSegmentId: text("icp_segment_id")
      .notNull()
      .references(() => gtmIcpSegment.id, { onDelete: "cascade" }),
    researchRunId: text("research_run_id")
      .notNull()
      .references(() => gtmResearchRun.id, { onDelete: "cascade" }),
    status: text("status").default("in_progress").notNull(),
    currentStage: text("current_stage", {
      enum: [
        "find_companies",
        "find_contacts",
        "write_emails",
        "awaiting_approval",
        "send_emails",
        "done_for_now",
        "done",
      ],
    })
      .default("find_companies")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("gtm_campaign_segment_idx").on(table.icpSegmentId),
    index("gtm_campaign_run_idx").on(table.researchRunId),
  ]
);

export const gtmProspectCompany = pgTable(
  "gtm_prospect_company",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    outreachCampaignId: text("outreach_campaign_id")
      .notNull()
      .references(() => gtmOutreachCampaign.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    linkedinUrl: text("linkedin_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("gtm_prospect_company_campaign_idx").on(table.outreachCampaignId),
  ]
);

export const gtmCompanyMetricSnapshot = pgTable(
  "gtm_company_metric_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    prospectCompanyId: text("prospect_company_id")
      .notNull()
      .references(() => gtmProspectCompany.id, { onDelete: "cascade" }),
    scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
    employeeCountLabel: text("employee_count_label"),
    linkedinFollowerCount: integer("linkedin_follower_count"),
  },
  (table) => [
    index("gtm_metric_snapshot_company_idx").on(table.prospectCompanyId),
  ]
);

export const gtmContact = pgTable(
  "gtm_contact",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    prospectCompanyId: text("prospect_company_id")
      .notNull()
      .references(() => gtmProspectCompany.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title").notNull(),
    linkedinUrl: text("linkedin_url"),
    email: text("email"),
    emailSource: text("email_source", {
      enum: [
        "found_on_site",
        "pattern_guessed_mx_valid",
        "pattern_guessed_unverified",
        "company_fallback",
        "none",
      ],
    })
      .default("none")
      .notNull(),
    geo: text("geo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("gtm_contact_company_idx").on(table.prospectCompanyId)]
);

export const gtmEmailDraft = pgTable(
  "gtm_email_draft",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    contactId: text("contact_id")
      .notNull()
      .references(() => gtmContact.id, { onDelete: "cascade" }),
    outreachCampaignId: text("outreach_campaign_id")
      .notNull()
      .references(() => gtmOutreachCampaign.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status", {
      enum: ["draft", "approved", "rejected", "sent", "failed"],
    })
      .default("draft")
      .notNull(),
    providerMessageId: text("provider_message_id"),
    threadId: text("thread_id"),
    sentAt: timestamp("sent_at"),
    lastPolledAt: timestamp("last_polled_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
  },
  (table) => [
    index("gtm_email_draft_contact_idx").on(table.contactId),
    index("gtm_email_draft_campaign_idx").on(table.outreachCampaignId),
    index("gtm_email_draft_thread_idx").on(table.threadId),
  ]
);

export const gtmConnectedMailbox = pgTable(
  "gtm_connected_mailbox",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").default("gmail").notNull(),
    email: text("email").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    encryptedAccessToken: text("encrypted_access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    status: text("status", {
      enum: ["connected", "revoked"],
    })
      .default("connected")
      .notNull(),
    dailySendCount: integer("daily_send_count").default(0).notNull(),
    lastSendResetDate: text("last_send_reset_date"),
    connectedBy: text("connected_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("gtm_connected_mailbox_org_idx").on(table.organizationId),
  ]
);

export const gtmEmailEvent = pgTable(
  "gtm_email_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    emailDraftId: text("email_draft_id")
      .notNull()
      .references(() => gtmEmailDraft.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["replied", "bounced", "opened"],
    }).notNull(),
    classifiedIntent: text("classified_intent", {
      enum: ["interested", "not_interested", "question", "auto_reply", "unclear"],
    }),
    rawSnippet: text("raw_snippet"),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    index("gtm_email_event_draft_idx").on(table.emailDraftId),
    index("gtm_email_event_type_idx").on(table.type),
  ]
);

export const gtmMeeting = pgTable(
  "gtm_meeting",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    contactId: text("contact_id")
      .notNull()
      .references(() => gtmContact.id, { onDelete: "cascade" }),
    outreachCampaignId: text("outreach_campaign_id").references(
      () => gtmOutreachCampaign.id,
      { onDelete: "cascade" }
    ),
    scheduledAt: timestamp("scheduled_at").notNull(),
    status: text("status", {
      enum: ["booked", "cancelled"],
    })
      .default("booked")
      .notNull(),
    calcomBookingUid: text("calcom_booking_uid"),
    attendeeEmail: text("attendee_email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("gtm_meeting_contact_idx").on(table.contactId),
    index("gtm_meeting_campaign_idx").on(table.outreachCampaignId),
    index("gtm_meeting_attendee_email_idx").on(table.attendeeEmail),
    index("gtm_meeting_calcom_uid_idx").on(table.calcomBookingUid),
  ]
);

// Relations
export const gtmResearchRunRelations = relations(
  gtmResearchRun,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [gtmResearchRun.organizationId],
      references: [organization.id],
    }),
    creator: one(user, {
      fields: [gtmResearchRun.createdBy],
      references: [user.id],
    }),
    competitors: many(gtmCompetitor),
    icpSegments: many(gtmIcpSegment),
    campaigns: many(gtmOutreachCampaign),
  })
);

export const gtmCompetitorRelations = relations(gtmCompetitor, ({ one }) => ({
  researchRun: one(gtmResearchRun, {
    fields: [gtmCompetitor.researchRunId],
    references: [gtmResearchRun.id],
  }),
}));

export const gtmIcpSegmentRelations = relations(
  gtmIcpSegment,
  ({ one, many }) => ({
    researchRun: one(gtmResearchRun, {
      fields: [gtmIcpSegment.researchRunId],
      references: [gtmResearchRun.id],
    }),
    campaigns: many(gtmOutreachCampaign),
  })
);

export const gtmOutreachCampaignRelations = relations(
  gtmOutreachCampaign,
  ({ one, many }) => ({
    icpSegment: one(gtmIcpSegment, {
      fields: [gtmOutreachCampaign.icpSegmentId],
      references: [gtmIcpSegment.id],
    }),
    researchRun: one(gtmResearchRun, {
      fields: [gtmOutreachCampaign.researchRunId],
      references: [gtmResearchRun.id],
    }),
    prospectCompanies: many(gtmProspectCompany),
    emailDrafts: many(gtmEmailDraft),
    meetings: many(gtmMeeting),
  })
);

export const gtmProspectCompanyRelations = relations(
  gtmProspectCompany,
  ({ one, many }) => ({
    outreachCampaign: one(gtmOutreachCampaign, {
      fields: [gtmProspectCompany.outreachCampaignId],
      references: [gtmOutreachCampaign.id],
    }),
    metricSnapshots: many(gtmCompanyMetricSnapshot),
    contacts: many(gtmContact),
  })
);

export const gtmCompanyMetricSnapshotRelations = relations(
  gtmCompanyMetricSnapshot,
  ({ one }) => ({
    prospectCompany: one(gtmProspectCompany, {
      fields: [gtmCompanyMetricSnapshot.prospectCompanyId],
      references: [gtmProspectCompany.id],
    }),
  })
);

export const gtmContactRelations = relations(gtmContact, ({ one, many }) => ({
  prospectCompany: one(gtmProspectCompany, {
    fields: [gtmContact.prospectCompanyId],
    references: [gtmProspectCompany.id],
  }),
  emailDrafts: many(gtmEmailDraft),
  meetings: many(gtmMeeting),
}));

export const gtmEmailDraftRelations = relations(gtmEmailDraft, ({ one, many }) => ({
  contact: one(gtmContact, {
    fields: [gtmEmailDraft.contactId],
    references: [gtmContact.id],
  }),
  outreachCampaign: one(gtmOutreachCampaign, {
    fields: [gtmEmailDraft.outreachCampaignId],
    references: [gtmOutreachCampaign.id],
  }),
  reviewer: one(user, {
    fields: [gtmEmailDraft.reviewedBy],
    references: [user.id],
  }),
  events: many(gtmEmailEvent),
}));

export const gtmEmailEventRelations = relations(gtmEmailEvent, ({ one }) => ({
  emailDraft: one(gtmEmailDraft, {
    fields: [gtmEmailEvent.emailDraftId],
    references: [gtmEmailDraft.id],
  }),
}));

export const gtmMeetingRelations = relations(gtmMeeting, ({ one }) => ({
  contact: one(gtmContact, {
    fields: [gtmMeeting.contactId],
    references: [gtmContact.id],
  }),
  campaign: one(gtmOutreachCampaign, {
    fields: [gtmMeeting.outreachCampaignId],
    references: [gtmOutreachCampaign.id],
  }),
}));

export const gtmConnectedMailboxRelations = relations(
  gtmConnectedMailbox,
  ({ one }) => ({
    organization: one(organization, {
      fields: [gtmConnectedMailbox.organizationId],
      references: [organization.id],
    }),
    connectedByUser: one(user, {
      fields: [gtmConnectedMailbox.connectedBy],
      references: [user.id],
    }),
  })
);

