// =============================================================
// Deep Research — Structured Evidence Cards
// =============================================================
// Pure data module: no LLM calls. Builds, merges, and validates
// structured evidence cards from tool results.

import type {
  EvidenceCard,
  EvidenceCardCollection,
  SourceEntry,
  RawExcerpt,
  EvidenceRetrievalStatus,
} from "./types";

// -------------------------------------------------------------------
// Build an EvidenceCard from raw search tool results
// -------------------------------------------------------------------

interface ToolResultArticle {
  title?: string;
  url?: string;
  link?: string;
  authors?: string[];
  year?: number;
  venue?: string;
  doi?: string;
  abstract?: string;
  summary?: string;
  findings?: string;
  content?: string;
}

/**
 * Build a structured EvidenceCard from raw search tool result objects.
 * Accepts the heterogeneous article shapes returned by different search tools.
 */
export function buildEvidenceCardFromToolResults(
  toolResults: unknown[],
  query: string,
): EvidenceCard {
  const sources: SourceEntry[] = [];
  const rawExcerpts: RawExcerpt[] = [];
  let sourcesAttempted = 0;

  for (const result of toolResults) {
    const articles = extractArticlesFromResult(result);
    sourcesAttempted += articles.length > 0 ? articles.length : 1;

    for (const article of articles) {
      const sourceIndex = sources.length;
      sources.push({
        title: article.title ?? "Untitled",
        url: article.url ?? article.link ?? "",
        authors: article.authors,
        year: article.year,
        venue: article.venue,
        doi: article.doi,
        retrievalMethod: "search_tool",
        retrievedAt: new Date().toISOString(),
      });

      const excerptText = article.abstract ?? article.summary ?? article.findings ?? article.content;
      if (excerptText) {
        rawExcerpts.push({
          text: excerptText,
          sourceIndex,
        });
      }
    }
  }

  const retrievalStatus = classifyRetrievalStatus(sources.length, sourcesAttempted);

  return {
    id: generateCardId(),
    query,
    sources,
    rawExcerpts,
    retrievalStatus,
    sourcesFound: sources.length,
    sourcesAttempted: Math.max(sourcesAttempted, 1),
    retrievalNotes: buildRetrievalNotes(retrievalStatus, sources.length, sourcesAttempted),
    createdAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------
// Merge multiple evidence cards into a collection
// -------------------------------------------------------------------

export function mergeEvidenceCards(cards: EvidenceCard[]): EvidenceCardCollection {
  let successful = 0;
  let partial = 0;
  let failed = 0;
  let empty = 0;

  for (const card of cards) {
    switch (card.retrievalStatus) {
      case "success": successful++; break;
      case "partial": partial++; break;
      case "failed_retrieval": failed++; break;
      case "insufficient_evidence":
      case "empty": empty++; break;
    }
  }

  return {
    cards,
    totalSources: cards.reduce((sum, c) => sum + c.sources.length, 0),
    totalExcerpts: cards.reduce((sum, c) => sum + c.rawExcerpts.length, 0),
    retrievalSummary: { successful, partial, failed, empty },
  };
}

// -------------------------------------------------------------------
// Assess evidence honesty — catch silent retrieval-failure-to-conclusion
// -------------------------------------------------------------------

export interface EvidenceHonestyAssessment {
  honest: boolean;
  issues: string[];
}

/**
 * Check an evidence card for signs of silent retrieval failure
 * being converted into conclusions (the "evidence honesty" problem).
 */
export function assessEvidenceHonesty(card: EvidenceCard): EvidenceHonestyAssessment {
  const issues: string[] = [];

  // Flag 1: Zero sources but card claims success
  if (card.sourcesFound === 0 && card.retrievalStatus === "success") {
    issues.push("Card claims success but has zero sources — likely silent retrieval failure");
  }

  // Flag 2: No raw excerpts despite having sources
  if (card.sources.length > 0 && card.rawExcerpts.length === 0) {
    issues.push("Card has sources but no raw excerpts — evidence may be fabricated or missing");
  }

  // Flag 3: All sources missing URLs
  if (card.sources.length > 0 && card.sources.every(s => !s.url || s.url === "")) {
    issues.push("All sources lack URLs — cannot verify provenance");
  }

  // Flag 4: Sources found is far below attempted
  if (card.sourcesAttempted > 0 && card.sourcesFound / card.sourcesAttempted < 0.2) {
    issues.push(
      `Low retrieval rate: ${card.sourcesFound}/${card.sourcesAttempted} sources found — ` +
      `topic may be poorly covered or queries need refinement`
    );
  }

  // Flag 5: Retrieval status is empty/failed but card was not flagged
  if (
    (card.retrievalStatus === "empty" || card.retrievalStatus === "failed_retrieval") &&
    card.sources.length > 0
  ) {
    issues.push("Retrieval status indicates failure but card contains sources — status mismatch");
  }

  return {
    honest: issues.length === 0,
    issues,
  };
}

// -------------------------------------------------------------------
// Render an evidence card as markdown
// -------------------------------------------------------------------

export function evidenceCardToMarkdown(card: EvidenceCard): string {
  const lines: string[] = [];

  lines.push(`## Evidence Card: ${card.query}`);
  lines.push("");
  lines.push(`**Retrieval Status**: ${card.retrievalStatus}`);
  lines.push(`**Sources Found**: ${card.sourcesFound} / ${card.sourcesAttempted} attempted`);
  lines.push(`**Notes**: ${card.retrievalNotes}`);
  lines.push("");

  if (card.sources.length > 0) {
    lines.push("### Sources");
    lines.push("");
    for (let i = 0; i < card.sources.length; i++) {
      const s = card.sources[i];
      const authorStr = s.authors?.join(", ") ?? "Unknown";
      const yearStr = s.year ? ` (${s.year})` : "";
      lines.push(`${i + 1}. **${s.title}**${yearStr}`);
      lines.push(`   - Authors: ${authorStr}`);
      if (s.venue) lines.push(`   - Venue: ${s.venue}`);
      if (s.url) lines.push(`   - URL: ${s.url}`);
      if (s.doi) lines.push(`   - DOI: ${s.doi}`);
    }
    lines.push("");
  }

  if (card.rawExcerpts.length > 0) {
    lines.push("### Key Excerpts");
    lines.push("");
    for (const excerpt of card.rawExcerpts) {
      const source = card.sources[excerpt.sourceIndex];
      const sourceRef = source ? source.title : `Source #${excerpt.sourceIndex}`;
      lines.push(`> ${excerpt.text.slice(0, 500)}${excerpt.text.length > 500 ? "..." : ""}`);
      lines.push(`> — *${sourceRef}*${excerpt.section ? `, ${excerpt.section}` : ""}`);
      lines.push("");
    }
  }

  // Honesty check
  const honesty = assessEvidenceHonesty(card);
  if (!honesty.honest) {
    lines.push("### Evidence Honesty Warnings");
    lines.push("");
    for (const issue of honesty.issues) {
      lines.push(`- ⚠ ${issue}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function extractArticlesFromResult(result: unknown): ToolResultArticle[] {
  if (!result || typeof result !== "object") return [];

  const obj = result as Record<string, unknown>;

  // Handle { output: { articles: [...] } } shape
  const output = obj.output as Record<string, unknown> | undefined;
  if (output?.articles && Array.isArray(output.articles)) {
    return output.articles as ToolResultArticle[];
  }

  // Handle { articles: [...] } shape
  if (obj.articles && Array.isArray(obj.articles)) {
    return obj.articles as ToolResultArticle[];
  }

  // Handle { results: [...] } shape
  if (obj.results && Array.isArray(obj.results)) {
    return obj.results as ToolResultArticle[];
  }

  // Handle direct article shape
  if (obj.title || obj.url) {
    return [obj as unknown as ToolResultArticle];
  }

  return [];
}

function classifyRetrievalStatus(found: number, attempted: number): EvidenceRetrievalStatus {
  if (found === 0) return "empty";
  if (attempted === 0) return "failed_retrieval";
  const ratio = found / attempted;
  if (ratio >= 0.8) return "success";
  if (ratio >= 0.3) return "partial";
  return "insufficient_evidence";
}

function buildRetrievalNotes(status: EvidenceRetrievalStatus, found: number, attempted: number): string {
  switch (status) {
    case "success":
      return `Retrieved ${found} sources successfully.`;
    case "partial":
      return `Partial retrieval: ${found}/${attempted} sources found. Some queries may need refinement.`;
    case "insufficient_evidence":
      return `Low retrieval rate: only ${found}/${attempted} sources found. Topic may be poorly covered.`;
    case "failed_retrieval":
      return "Retrieval failed: no search attempts completed.";
    case "empty":
      return "No sources found. This topic area may need different search terms or broader queries.";
  }
}

let cardCounter = 0;
function generateCardId(): string {
  cardCounter++;
  return `ec_${Date.now()}_${cardCounter}`;
}
