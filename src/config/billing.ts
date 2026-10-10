export type PlanTier =
  | "free"
  | "pilot"
  | "starter"
  | "growth"
  | "scale"
  | "freelancer"
  | "agency";

export interface PlanConfig {
  id: PlanTier;
  name: string;
  priceMonthly: number;
  aiCredits: number;
  maxActiveCampaigns: number | "unlimited";
  includedSeats: number;
  maxSeats: number; // includedSeats for backwards compatibility
  features: string[];
  priceId?: string; // Dodo Payments Product/Price ID
  isPopular?: boolean;
}

export const TOPUP_CONFIG = {
  credits: 100,
  priceUsd: 12,
  priceId: process.env.NEXT_PUBLIC_DODO_TOPUP_PRICE_ID,
};

export const EXTRA_SEAT_CONFIG = {
  priceMonthlyUsd: 10,
  priceId: process.env.NEXT_PUBLIC_DODO_EXTRA_SEAT_PRICE_ID,
};

export const BILLING_CONFIG: Record<PlanTier, PlanConfig> = {
  free: {
    id: "free",
    name: "No Active Plan",
    priceMonthly: 0,
    aiCredits: 0,
    maxActiveCampaigns: 0,
    includedSeats: 1,
    maxSeats: 1,
    features: [
      "0 AI prospect credits (stages 1-3 research free & uncapped)",
      "0 active campaigns (upgrade to launch outreach)",
      "1 user seat",
      "Stages 1-3 research always free & uncapped",
      "Email draft review & approvals",
    ],
  },
  pilot: {
    id: "pilot",
    name: "Pilot",
    priceMonthly: 39,
    aiCredits: 300,
    maxActiveCampaigns: 2,
    includedSeats: 1,
    maxSeats: 1,
    features: [
      "300 AI prospect credits / month",
      "2 active campaigns at a time",
      "1 user seat included",
      "Stages 1-3 research always free & uncapped",
      "Throttled Gmail outreach",
      "Real-time pipeline analytics",
    ],
    priceId: process.env.NEXT_PUBLIC_DODO_PILOT_PRICE_ID,
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 79,
    aiCredits: 600,
    maxActiveCampaigns: 3,
    includedSeats: 2,
    maxSeats: 2,
    features: [
      "600 AI prospect credits / month",
      "3 active campaigns at a time",
      "2 seats included",
      "Stages 1-3 research always free & uncapped",
      "Throttled Gmail outreach",
      "Real-time pipeline analytics",
      "CSV & prospect exports",
    ],
    isPopular: true,
    priceId: process.env.NEXT_PUBLIC_DODO_STARTER_PRICE_ID,
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthly: 179,
    aiCredits: 1800,
    maxActiveCampaigns: 8,
    includedSeats: 3,
    maxSeats: 3,
    features: [
      "1,800 AI prospect credits / month",
      "8 active campaigns at a time",
      "3 seats included",
      "Stages 1-3 research always free & uncapped",
      "Priority pipeline execution",
      "Team collaboration & shared mailbox",
      "Webhook alerts & integrations",
    ],
    priceId: process.env.NEXT_PUBLIC_DODO_GROWTH_PRICE_ID,
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceMonthly: 349,
    aiCredits: 5000,
    maxActiveCampaigns: "unlimited",
    includedSeats: 5,
    maxSeats: 5,
    features: [
      "5,000 AI prospect credits / month",
      "Unlimited active campaigns",
      "5 seats included",
      "Stages 1-3 research always free & uncapped",
      "Custom send schedules",
      "Dedicated account manager",
      "Custom integrations & SLA",
    ],
    priceId: process.env.NEXT_PUBLIC_DODO_SCALE_PRICE_ID,
  },
  // Legacy aliases for backward compatibility with early accounts
  freelancer: {
    id: "freelancer",
    name: "Freelancer (Legacy)",
    priceMonthly: 39,
    aiCredits: 300,
    maxActiveCampaigns: 2,
    includedSeats: 1,
    maxSeats: 1,
    features: ["300 AI credits", "2 active campaigns", "1 seat"],
    priceId: process.env.NEXT_PUBLIC_DODO_PILOT_PRICE_ID || process.env.NEXT_PUBLIC_DODO_FREELANCER_PRICE_ID,
  },
  agency: {
    id: "agency",
    name: "Agency (Legacy)",
    priceMonthly: 179,
    aiCredits: 1800,
    maxActiveCampaigns: 8,
    includedSeats: 3,
    maxSeats: 3,
    features: ["1,800 AI credits", "8 active campaigns", "3 seats"],
    priceId: process.env.NEXT_PUBLIC_DODO_GROWTH_PRICE_ID || process.env.NEXT_PUBLIC_DODO_AGENCY_PRICE_ID,
  },
};

/**
 * Checks if local billing bypass is active.
 * Kept for interface backward-compatibility; returns false to ensure metering is strictly respected.
 */
export const isBillingBypassed = (): boolean => {
  return false;
};

/**
 * Helper to get active limits for an organization's plan.
 * Fallbacks to 'free' (unsubscribed state with 0 credits and 0 campaigns).
 */
export const getPlanLimits = (plan: PlanTier | string = "free"): PlanConfig => {
  const normalized = (plan || "free").toLowerCase();
  if (normalized === "freelancer") return BILLING_CONFIG.freelancer;
  if (normalized === "agency") return BILLING_CONFIG.agency;
  if (normalized === "enterprise") return BILLING_CONFIG.free; // Enterprise does not exist; treat as unsubscribed
  return (BILLING_CONFIG as Record<string, PlanConfig>)[normalized] || BILLING_CONFIG.free;
};

/**
 * Helper to get total allowed seats for an organization (included + extra purchased).
 */
export const getTotalAllowedSeats = (
  plan: PlanTier | string = "free",
  extraSeats: number = 0
): number => {
  const config = getPlanLimits(plan);
  return config.includedSeats + Math.max(0, extraSeats);
};

/**
 * Helper to get max active campaigns for an organization.
 */
export const getMaxActiveCampaigns = (
  plan: PlanTier | string = "free"
): number | "unlimited" => {
  const config = getPlanLimits(plan);
  return config.maxActiveCampaigns;
};
