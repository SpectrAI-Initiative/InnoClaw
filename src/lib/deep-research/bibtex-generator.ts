// =============================================================
// Deep Research — BibTeX Generator
// =============================================================
// Generates BibTeX entries from collected evidence cards and citations.
// Ported from AutoResearchClaw's citation verification and BibTeX export.

import type {
  DeepResearchArtifact,
  EvidenceCard,
  BibTeXEntry,
} from "./types";

// =============================================================
// BibTeX Entry Generation
// =============================================================

/**
 * Generate a sanitized citation key from title and authors.
 * e.g. "Smith et al. 2024" → "smith2024title"
 */
function generateCitationKey(
  authors: string,
  year: number | undefined,
  title: string,
): string {
  const firstAuthor = authors.split(",")[0]?.trim().split(" ").pop()?.toLowerCase() ?? "unknown";
  const yearStr = year ? String(year) : "unknown";
  const titleWords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);
  return `${firstAuthor}${yearStr}${titleWords.join("")}`;
}

/**
 * Detect BibTeX entry type from source metadata.
 */
function detectEntryType(source: Record<string, unknown>): string {
  const venue = (source.venue as string) ?? (source.journal as string) ?? "";
  const venueLower = venue.toLowerCase();

  if (
    venueLower.includes("conference") ||
    venueLower.includes("proceedings") ||
    venueLower.includes("workshop") ||
    venueLower.includes("symposium") ||
    venueLower.includes("neurips") ||
    venueLower.includes("iclr") ||
    venueLower.includes("icml") ||
    venueLower.includes("cvpr") ||
    venueLower.includes("aaai") ||
    venueLower.includes("acl") ||
    venueLower.includes("emnlp")
  ) {
    return "inproceedings";
  }

  if (
    venueLower.includes("arxiv") ||
    venueLower.includes("preprint") ||
    venueLower.includes("tech report") ||
    venueLower.includes("biorxiv")
  ) {
    return "misc";
  }

  return "article";
}

/**
 * Parse author list into BibTeX format ("Author, First and Author, Second").
 */
function parseBibTeXAuthors(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw
      .map((a) => {
        if (typeof a === "string") return a.trim();
        if (typeof a === "object" && a !== null) {
          const name =
            (a as Record<string, unknown>).name as string ??
            (a as Record<string, unknown>).author as string ??
            "";
          return String(name).trim();
        }
        return "";
      })
      .filter(Boolean)
      .join(" and ");
  }

  if (typeof raw === "string") {
    // Split by "and" or comma
    const parts = raw
      .split(/\s+(?:and|&)\s+|,\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length <= 1) return raw.trim();

    // Convert "First Last" to "Last, First" for each author
    return parts
      .map((name) => {
        const words = name.split(/\s+/);
        if (words.length >= 2) {
          const lastName = words.pop()!;
          return `${lastName}, ${words.join(" ")}`;
        }
        return name;
      })
      .join(" and ");
  }

  return "Unknown";
}

/**
 * Convert a single EvidenceCard source to a BibTeX entry.
 */
function sourceToBibTeX(
  source: Record<string, unknown>,
  index: number,
): BibTeXEntry {
  const title = (source.title as string) ?? `Unknown Title ${index}`;
  const authors = parseBibTeXAuthors(source.authors ?? source.author);
  const year =
    (source.year as number) ??
    (source.date as number) ??
    (source.publishedYear as number);
  const entryType = detectEntryType(source);
  const citationKey = generateCitationKey(authors, year, title);
  const venue = (source.venue as string) ?? (source.journal as string) ?? undefined;
  const doi = (source.doi as string) ?? undefined;
  const url = (source.url as string) ?? undefined;

  return {
    citationKey,
    entryType,
    title,
    authors,
    year,
    venue,
    doi,
    url,
  };
}

/**
 * Render a single BibTeX entry as a string.
 */
export function renderBibTeXEntry(entry: BibTeXEntry): string {
  const lines: string[] = [];
  lines.push(`@${entry.entryType}{${entry.citationKey},`);
  lines.push(`  title = {${entry.title}},`);
  lines.push(`  author = {${entry.authors}},`);

  if (entry.year) lines.push(`  year = {${entry.year}},`);
  if (entry.venue) {
    if (entry.entryType === "inproceedings") {
      lines.push(`  booktitle = {${entry.venue}},`);
    } else {
      lines.push(`  journal = {${entry.venue}},`);
    }
  }
  if (entry.doi) lines.push(`  doi = {${entry.doi}},`);
  if (entry.url) lines.push(`  url = {${entry.url}},`);
  if (entry.pages) lines.push(`  pages = {${entry.pages}},`);
  if (entry.volume) lines.push(`  volume = {${entry.volume}},`);
  if (entry.number) lines.push(`  number = {${entry.number}},`);

  lines.push("}");
  return lines.join("\n");
}

// =============================================================
// Main Generator
// =============================================================

/**
 * Extract BibTeX entries from evidence cards and other artifacts.
 */
export function extractBibTeXEntries(
  artifacts: DeepResearchArtifact[],
): BibTeXEntry[] {
  const evidenceCards = artifacts.filter(
    (a) => a.artifactType === "evidence_card",
  );

  const sources: Array<{
    source: Record<string, unknown>;
    index: number;
  }> = [];
  const seen = new Set<string>();

  for (const card of evidenceCards) {
    const content = card.content as Record<string, unknown> | null;
    const cardSources =
      (content?.sources as Array<Record<string, unknown>>) ?? [];
    for (const source of cardSources) {
      const key = JSON.stringify(source).slice(0, 200);
      if (!seen.has(key)) {
        seen.add(key);
        sources.push({ source, index: sources.length + 1 });
      }
    }
  }

  return sources
    .map(({ source, index }) => sourceToBibTeX(source, index))
    .filter((entry) => entry.title !== "Unknown Title");
}

/**
 * Render all BibTeX entries as a complete .bib file content.
 */
export function renderBibTeXFile(entries: BibTeXEntry[]): string {
  if (entries.length === 0) return "";

  const deduped = deduplicateEntries(entries);
  const rendered = deduped.map(renderBibTeXEntry);

  return (
    "% Generated by InnoClaw Deep Research\n" +
    `% ${deduped.length} references\n\n` +
    rendered.join("\n\n") +
    "\n"
  );
}

/**
 * Deduplicate BibTeX entries by citation key.
 */
function deduplicateEntries(entries: BibTeXEntry[]): BibTeXEntry[] {
  const seen = new Map<string, BibTeXEntry>();
  for (const entry of entries) {
    if (!seen.has(entry.citationKey)) {
      seen.set(entry.citationKey, entry);
    }
  }
  return Array.from(seen.values());
}

/**
 * Build a citation key → author-year label mapping for in-text referencing.
 */
export function buildCitationKeyMap(
  entries: BibTeXEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    const label = entry.year
      ? `${entry.authors.split(" and ")[0]?.split(",")[0]?.trim() ?? "Unknown"} et al., ${entry.year}`
      : entry.authors.split(" and ")[0] ?? "Unknown";
    map.set(entry.citationKey, label);
  }
  return map;
}
