import dns from "node:dns";
import { extractDomain } from "./firecrawl";
import { isValidPersonName } from "./gtm-contact-matcher";

/**
 * Checks whether a domain has valid MX (Mail Exchange) records.
 * Uses Node DNS with public DNS servers (8.8.8.8) and Cloudflare DNS over HTTPS (DoH) fallback.
 * Strictly free and does NOT use outbound SMTP port 25.
 */
export async function checkDomainMxRecords(domain: string): Promise<boolean> {
  const cleanDomain = extractDomain(domain);
  if (!cleanDomain || !cleanDomain.includes(".")) {
    return false;
  }

  // 1. Try Node native DNS resolution
  try {
    const resolver = new dns.promises.Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);
    const records = await resolver.resolveMx(cleanDomain);
    if (records && records.length > 0) {
      return true;
    }
  } catch (err: any) {
    // If not ENOTFOUND, could be local UDP port 53 issue, fallback to DoH
    if (err?.code === "ENOTFOUND" || err?.code === "NODATA") {
      return false;
    }
  }

  // 2. Fallback: Cloudflare DNS over HTTPS (DoH) - works everywhere including edge/Vercel
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=MX`,
      {
        headers: { Accept: "application/dns-json" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.Answer) && json.Answer.length > 0) {
        return true;
      }
    }
  } catch (dohErr) {
    console.warn(`[DoH MX check error] ${cleanDomain}:`, dohErr);
  }

  return false;
}

/**
 * Generates pattern-guessed email candidates for a given name and domain.
 */
export function generateEmailGuesses(
  fullName: string,
  domain: string
): string[] {
  if (!isValidPersonName(fullName)) {
    return [];
  }

  const cleanDomain = extractDomain(domain);
  const parts = fullName
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0 || !cleanDomain) return [];

  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";

  const candidates: string[] = [];

  if (first && last) {
    candidates.push(`${first}.${last}@${cleanDomain}`);
    candidates.push(`${first[0]}${last}@${cleanDomain}`);
    candidates.push(`${first}@${cleanDomain}`);
    candidates.push(`${first}${last[0]}@${cleanDomain}`);
  } else if (first) {
    candidates.push(`${first}@${cleanDomain}`);
  }

  return candidates;
}

/**
 * Extracts emails from scraped text, filtering out generic spam or asset placeholders.
 */
export function extractEmailsFromText(text: string, domain?: string): string[] {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const matches = text.match(emailRegex) || [];
  const cleanDomain = domain ? extractDomain(domain) : null;

  const valid = new Set<string>();
  for (const raw of matches) {
    const email = raw.toLowerCase().trim();
    // Exclude dummy or static asset false positives
    if (
      email.endsWith(".png") ||
      email.endsWith(".jpg") ||
      email.endsWith(".svg") ||
      email.includes("example.com") ||
      email.includes("sentry.io") ||
      email.includes("domain.com") ||
      email.includes("test@")
    ) {
      continue;
    }

    if (cleanDomain && !email.endsWith(`@${cleanDomain}`)) {
      // If domain specified, prefer matching domain
      continue;
    }

    valid.add(email);
  }

  return Array.from(valid);
}
