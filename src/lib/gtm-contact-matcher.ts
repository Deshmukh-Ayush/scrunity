import { SearchResultItem } from "./firecrawl";

export interface TeamCandidate {
  name: string;
  title: string;
  url?: string;
  source: "team_page_scrape" | "site_search_snippet" | "linkedin_snippet";
}

export interface TitleMatchResult {
  score: number;
  matchedRole: string;
  reason: string;
}

/**
 * Normalizes title strings for reliable comparison.
 */
function cleanTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[–—|:•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Evaluates how closely a candidate's title matches the derived target roles.
 * Returns a score between 0 and 100.
 */
export function scoreTitleMatch(candidateTitle: string, targetRoles: string[]): TitleMatchResult {
  const cand = cleanTitle(candidateTitle);
  let bestScore = 0;
  let bestRole = "";
  let bestReason = "No semantic overlap with target roles";

  for (const role of targetRoles) {
    const target = cleanTitle(role);
    if (!target) continue;

    // 1. Exact match (e.g. "Clinical Director" === "Clinical Director")
    if (cand === target) {
      return {
        score: 100,
        matchedRole: role,
        reason: `Exact match between candidate title "${candidateTitle}" and target role "${role}".`,
      };
    }

    // 2. Candidate title contains the full target role phrase
    // e.g. "Associate Clinical Director" or "Clinical Director, LMFT" containing "Clinical Director"
    if (cand.includes(target)) {
      const score = 85 + Math.min(10, Math.floor((target.length / cand.length) * 10));
      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
        bestReason = `Candidate title "${candidateTitle}" contains the full target role "${role}".`;
      }
    }

    // 3. Target role contains the full candidate title (e.g. target="Chief Technology Officer", candidate="CTO")
    if (target.includes(cand) && cand.length >= 3) {
      const score = 75;
      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
        bestReason = `Target role "${role}" contains candidate title "${candidateTitle}".`;
      }
    }

    // 4. Word-token complete overlap (all significant words of target role are in candidate title)
    // e.g. target="Director of Clinical Operations", candidate="Clinical Operations Director"
    const targetTokens = target.split(/\s+/).filter((t) => t.length > 2 && !["and", "the", "for", "of"].includes(t));
    const candTokens = cand.split(/[\s,/-]+/).filter((t) => t.length > 2 && !["and", "the", "for", "of"].includes(t));

    if (targetTokens.length > 0) {
      const allTokensMatched = targetTokens.every((tt) =>
        candTokens.some((ct) => ct === tt || ct.startsWith(tt) || tt.startsWith(ct))
      );
      if (allTokensMatched) {
        const score = 80;
        if (score > bestScore) {
          bestScore = score;
          bestRole = role;
          bestReason = `All key terms from target role "${role}" appear in candidate title "${candidateTitle}".`;
        }
      }
    }
  }

  return {
    score: bestScore,
    matchedRole: bestRole,
    reason: bestReason,
  };
}

/**
 * Validates that an extracted string is a plausible real human name.
 * Strictly rejects temporal phrases (e.g. "3 days ago"), filler text ("and co"),
 * corporate suffixes ("Inc", "LLC"), and standalone job titles.
 */
export function isValidPersonName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 50) return false;

  // Reject relative dates / temporal expressions (e.g., "3 days ago", "yesterday")
  if (/\b(days?|hours?|weeks?|months?|years?|minutes?|secs?)\s+ago\b/i.test(trimmed)) return false;
  if (/\b(yesterday|tomorrow|today|recently|updated|published|posted)\b/i.test(trimmed)) return false;

  // Reject company/legal suffixes and filler expressions
  if (/\b(and\s+co|and\s+company|inc\.?|llc\.?|ltd\.?|corp\.?|team|solutions|services|group|holdings|agency|studios|platform|technologies|partners|consulting)\b/i.test(trimmed)) return false;

  // Reject role title prefixes (e.g. "VP Business Development", "SVP Sales", "Director of...")
  if (/^(?:vp|vice president|svp|evp|avp|chief|head|director|manager|lead)\b/i.test(trimmed)) return false;

  // Reject common standalone role titles erroneously captured as names
  const lower = trimmed.toLowerCase();
  const bannedRoles = [
    "vp", "vice president", "president", "founder", "co-founder", "cofounder",
    "ceo", "cto", "coo", "cmo", "cfo", "cro", "cio", "cpo",
    "director", "managing director", "head of", "manager", "lead", "leader",
    "general partner", "partner", "associate", "intern", "engineer", "sales",
    "business development", "growth", "marketing", "operations", "clinical director",
    "practice manager", "support", "admin", "administrator", "info", "contact",
    "suite leaders"
  ];
  if (bannedRoles.includes(lower)) return false;
  if (/\b(sales|business development|suite leaders)\b/i.test(trimmed)) return false;

  // Clean title prefix (Dr., Prof.) and trailing credentials (e.g. ", PhD, MBA", ", MD", ", CPA")
  let cleaned = trimmed.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)\s+/i, "");
  cleaned = cleaned.replace(/(?:,\s*(?:[A-Z]{2,6}|PhD|MBA|MD|CPA|Esq|MS|MA))+$/i, "").trim();

  const words = cleaned.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;

  // Each word must start with an uppercase letter and be a proper noun
  for (const w of words) {
    if (!/^[A-Z][a-zA-Z'’-]{1,25}$/.test(w)) {
      return false;
    }
  }

  return true;
}

/**
 * Extracts candidate persons and titles from scraped team/about markdown.
 */
export function parseTeamFromMarkdown(markdown: string): TeamCandidate[] {
  const candidates: TeamCandidate[] = [];
  const lines = markdown.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Pattern 1: [Person Name, Credentials](url)\nTitle
    const linkMatch = line.match(/^\[([A-Z][a-zA-Z\s.,'-]+)\]\((https?:\/\/[^)]+)\)$/);
    if (linkMatch) {
      const rawName = linkMatch[1].trim();
      const url = linkMatch[2];

      if (
        isValidPersonName(rawName) &&
        nextLine.length > 2 &&
        nextLine.length < 80 &&
        !nextLine.startsWith("[") &&
        !nextLine.startsWith("!") &&
        !nextLine.startsWith("#") &&
        !nextLine.startsWith("http")
      ) {
        candidates.push({
          name: rawName,
          title: nextLine,
          url,
          source: "team_page_scrape",
        });
      }
    }

    // Pattern 2: **Person Name** - Title or ### Person Name \n Title
    const boldMatch = line.match(/^\*\*([A-Z][a-zA-Z\s.,'-]+)\*\*\s*[-–|:]\s*(.+)$/);
    if (boldMatch) {
      const rawName = boldMatch[1].trim();
      if (isValidPersonName(rawName)) {
        candidates.push({
          name: rawName,
          title: boldMatch[2].trim(),
          source: "team_page_scrape",
        });
      }
    }
  }

  return candidates;
}

/**
 * Extracts candidate persons and titles from search result snippets (Site search or LinkedIn).
 */
export function parseCandidatesFromSnippets(
  items: SearchResultItem[],
  source: "site_search_snippet" | "linkedin_snippet"
): TeamCandidate[] {
  const candidates: TeamCandidate[] = [];

  for (const item of items) {
    const title = item.title || "";
    const snippet = item.description || "";

    // 1. LinkedIn Title pattern: "First Last - Title at Company | LinkedIn"
    if (source === "linkedin_snippet") {
      const parts = title.split(/[-–|]/);
      if (parts.length >= 2) {
        const rawName = parts[0].trim();
        const rawTitle = parts[1].replace(/at .*$/i, "").trim();

        if (
          isValidPersonName(rawName) &&
          rawTitle.length > 2 &&
          rawTitle.length < 80
        ) {
          candidates.push({
            name: rawName,
            title: rawTitle,
            url: item.url,
            source: "linkedin_snippet",
          });
        }
      }
    }

    // 2. Site Snippet patterns
    // Example: "... Dr. Kamlesh Desai - Co-Founder ..."
    // Strictly case-sensitive: names must be capitalized proper nouns (NO /gi flag)
    const snippetMatches = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}(?:\s*,\s*[A-Z]{2,5})?)\s*[-–|:.•·]\s*(Co-Founder|Founder|Clinical Director|Practice Manager|Director|CEO|CTO|COO|Associate|Intern)/g,
      /(Dr\.?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-–|:.•·]\s*(Co-Founder|Founder|Clinical Director|Practice Manager|Director|CEO|CTO|COO)/g,
    ];

    for (const regex of snippetMatches) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(snippet)) !== null) {
        if (match[1] && match[2]) {
          const candidateName = match[1].trim();
          if (isValidPersonName(candidateName)) {
            candidates.push({
              name: candidateName,
              title: match[2].trim(),
              url: item.url,
              source: "site_search_snippet",
            });
          }
        }
      }
    }
  }

  return candidates;
}

export interface SelectedDecisionMaker {
  candidate: TeamCandidate;
  score: number;
  matchedRole: string;
  reason: string;
}

/**
 * Evaluates all candidates and returns ONLY the candidate whose title specifically
 * matches the target roles with high confidence (score >= 70).
 * Never selects an arbitrary candidate based on position or first-appearance.
 */
export function selectMatchingDecisionMaker(
  candidates: TeamCandidate[],
  targetRoles: string[]
): SelectedDecisionMaker | null {
  let bestMatch: SelectedDecisionMaker | null = null;

  for (const cand of candidates) {
    if (!isValidPersonName(cand.name)) continue;
    const match = scoreTitleMatch(cand.title, targetRoles);
    if (match.score >= 70) {
      if (!bestMatch || match.score > bestMatch.score) {
        bestMatch = {
          candidate: cand,
          score: match.score,
          matchedRole: match.matchedRole,
          reason: match.reason,
        };
      }
    }
  }

  return bestMatch;
}

export {
  checkEmailConfidenceFloor,
  checkLinkedInProfileGate,
  checkLeadQualificationGates,
  evaluateContactQualification,
  type GateCheckResult,
} from "./gtm-stage-5-5";
