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

      // Ignore navigation links or skip-to-content
      if (
        !rawName.toLowerCase().includes("skip to") &&
        !rawName.toLowerCase().includes("our team") &&
        !rawName.toLowerCase().includes("read more") &&
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
      candidates.push({
        name: boldMatch[1].trim(),
        title: boldMatch[2].trim(),
        source: "team_page_scrape",
      });
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
          rawName.length > 2 &&
          rawName.length < 40 &&
          !rawName.toLowerCase().includes("telehealth") &&
          !rawName.toLowerCase().includes("linkedin") &&
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
    // Example: "... Dr.Kamlesh Desai. Co-Founder - ..."
    // Example: "... Meegan Yassa, LMFT. Clinical Director ..."
    const snippetMatches = [
      /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s*,\s*[A-Z]{2,5})?)\s*[-–|:.•·]\s*(Co-Founder|Founder|Clinical Director|Practice Manager|Director|CEO|CTO|COO|Associate|Intern)/gi,
      /(Dr\.?\s*[A-Z][a-z]+\s+[A-Z][a-z]+)\s*[-–|:.•·]\s*(Co-Founder|Founder|Clinical Director|Practice Manager|Director|CEO|CTO|COO)/gi,
    ];

    for (const regex of snippetMatches) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(snippet)) !== null) {
        if (match[1] && match[2]) {
          candidates.push({
            name: match[1].trim(),
            title: match[2].trim(),
            url: item.url,
            source: "site_search_snippet",
          });
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
