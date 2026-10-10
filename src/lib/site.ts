export const siteConfig = {
  name: "Scrunity",
  shortName: "Scrunity",
  title: "Scrunity — B2B Client Workspace & Revenue Protection",
  description:
    "Scrunity is a B2B client workspace for agencies and freelancers to manage projects, contracts, deliverables, and client collaboration in one place.",
  url: process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "https://app.scrunity.com",
  landingUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://landing.scrunity.com",
  brandColor: "#00aff9",
  creator: "@scrunity",
  keywords: [
    "agency client workspace",
    "b2b client portal",
    "contract management",
    "e-signatures",
    "deliverables review",
    "scope creep prevention",
    "milestone payments",
    "agency revenue protection",
  ],
};

export function getAbsoluteUrl(path: string = ""): string {
  const base = siteConfig.url.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
