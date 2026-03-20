/**
 * Structured note generator for paper study.
 *
 * Generates dailypaper-skills style Obsidian notes with:
 * - Rich YAML frontmatter
 * - Structured sections (motivation, method, formulas, figures, experiments)
 * - Wikilink concept linking
 * - Downloaded figures with local references
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { StructuredNoteFrontmatter } from "@/lib/utils/obsidian";
import { generateStructuredFrontmatter } from "@/lib/utils/obsidian";
import type { PaperFigure } from "./remote-paper-fetcher";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteGenerationResult {
  /** Full note content including frontmatter. */
  content: string;
  /** Absolute path where the note was saved. */
  filePath: string;
  /** Method/model name extracted from the paper. */
  methodName: string;
  /** Figures that were downloaded locally. */
  localFigures: Array<{ originalUrl: string; localPath: string }>;
}

// ---------------------------------------------------------------------------
// Image download
// ---------------------------------------------------------------------------

const IMG_TIMEOUT_MS = 15_000;
const MAX_IMG_BYTES = 10 * 1024 * 1024;

/**
 * Download paper figures to a local `assets/` directory.
 * Returns updated figures with `localRef` for Obsidian embedding.
 */
export async function downloadFiguresToLocal(
  figures: PaperFigure[],
  notesDir: string,
  noteBaseName: string
): Promise<
  Array<PaperFigure & { localRef?: string; localPath?: string }>
> {
  if (figures.length === 0) return [];

  const assetsDir = path.join(notesDir, "assets", noteBaseName);
  try {
    await mkdir(assetsDir, { recursive: true });
  } catch {
    // Directory might already exist
  }

  const results = await Promise.allSettled(
    figures.slice(0, 15).map(async (fig, i) => {
      if (!fig.url && !fig.dataUrl) return { ...fig };

      const ext = guessImageExtension(fig.url);
      const filename = `fig${i + 1}${ext}`;
      const localPath = path.join(assetsDir, filename);
      // Obsidian wikilink uses relative path from notes dir: assets/noteBaseName/fig1.png
      const obsidianRef = `${noteBaseName}/${filename}`;

      try {
        let buffer: Buffer;

        if (fig.dataUrl) {
          // Already have base64 data
          const base64Data = fig.dataUrl.split(",")[1];
          buffer = Buffer.from(base64Data, "base64");
        } else {
          // Download from URL
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), IMG_TIMEOUT_MS);

          try {
            // Build headers — arXiv requires a Referer to serve images
            const headers: Record<string, string> = {
              "User-Agent": "InnoClaw/1.0 (Academic Research Tool; mailto:noreply@example.com)",
              Accept: "image/*,*/*;q=0.8",
            };
            if (fig.url.includes("arxiv.org")) {
              // Extract the paper HTML page URL as Referer
              const idMatch = fig.url.match(/\/html\/([\d.]+(?:v\d+)?)/);
              headers["Referer"] = idMatch
                ? `https://arxiv.org/html/${idMatch[1]}/`
                : "https://arxiv.org/";
            }

            const res = await fetch(fig.url, {
              signal: controller.signal,
              headers,
            });
            if (!res.ok) {
              console.warn(`[note-generator] Image download failed (${res.status}): ${fig.url}`);
              return { ...fig };
            }

            const arrayBuffer = await res.arrayBuffer();
            if (arrayBuffer.byteLength > MAX_IMG_BYTES || arrayBuffer.byteLength === 0) {
              console.warn(`[note-generator] Image size invalid (${arrayBuffer.byteLength} bytes): ${fig.url}`);
              return { ...fig };
            }
            buffer = Buffer.from(arrayBuffer);
          } finally {
            clearTimeout(timer);
          }
        }

        await writeFile(localPath, buffer);

        return {
          ...fig,
          localRef: `![[${obsidianRef}|600]]`,
          localPath,
        };
      } catch {
        // Download failed — keep remote URL reference
        return { ...fig };
      }
    })
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : figures[i]
  );
}

function guessImageExtension(url: string): string {
  if (!url) return ".png";
  const lower = url.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return ".jpg";
  if (lower.includes(".svg")) return ".svg";
  if (lower.includes(".gif")) return ".gif";
  if (lower.includes(".webp")) return ".webp";
  return ".png";
}

// ---------------------------------------------------------------------------
// Frontmatter generation
// ---------------------------------------------------------------------------

/**
 * Build structured note frontmatter for a paper.
 */
export function buildNoteFrontmatter(
  article: {
    id: string;
    title: string;
    authors: string[];
    publishedDate: string;
    url: string;
    source: string;
  },
  methodName: string,
  hasLocalFigures: boolean
): string {
  const year = article.publishedDate
    ? new Date(article.publishedDate).getFullYear().toString()
    : new Date().getFullYear().toString();

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const meta: StructuredNoteFrontmatter = {
    title: article.title,
    date: dateStr,
    type: "structured_note",
    method_name: methodName,
    year,
    authors: article.authors.slice(0, 10),
    paper_url: [article.url],
    arxiv_id: extractArxivIdFromUrl(article.url, article.id),
    image_source: hasLocalFigures ? "local" : "online",
    tags: ["论文笔记"],
  };

  return generateStructuredFrontmatter(meta);
}

function extractArxivIdFromUrl(url: string, id: string): string | undefined {
  const match = url.match(/(\d{4}\.\d{4,5})/);
  if (match) return match[1];
  const idMatch = id.match(/^(\d{4}\.\d{4,5})/);
  if (idMatch) return idMatch[1];
  return undefined;
}

// ---------------------------------------------------------------------------
// Note file naming
// ---------------------------------------------------------------------------

/**
 * Generate a safe filename for the note.
 * Uses method/model name if available, otherwise sanitized title.
 */
export function generateNoteFilename(methodName: string, title: string): string {
  const name = methodName || title;
  return (
    name
      .replace(/[/\\:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) + ".md"
  );
}

/**
 * Extract a likely method/model name from the paper title.
 * Looks for CamelCase patterns, ALL-CAPS abbreviations, or quoted names.
 */
export function extractMethodName(title: string): string {
  // Try quoted names first: "MethodName" or 'MethodName'
  const quoted = title.match(/["']([A-Z][A-Za-z0-9+-]+)["']/);
  if (quoted) return quoted[1];

  // Try CamelCase pattern (at least 2 uppercase transitions)
  const camel = title.match(/\b([A-Z][a-z]+(?:[A-Z][a-z]*)+(?:\d+)?)\b/);
  if (camel) return camel[1];

  // Try ALL-CAPS acronym with possible digits (at least 2 chars)
  const caps = title.match(/\b([A-Z][A-Z0-9]{1,}(?:[-+][A-Z0-9]+)*)\b/);
  if (caps && !["THE", "AND", "FOR", "WITH", "FROM", "VIA", "USING", "TOWARDS", "LEARNING", "MODEL"].includes(caps[1])) {
    return caps[1];
  }

  // Try "Name:" at the start of the title
  const colonName = title.match(/^([A-Z][A-Za-z0-9+-]+)\s*:/);
  if (colonName) return colonName[1];

  // Fallback: use first few meaningful words
  return title.split(/\s+/).slice(0, 3).join(" ");
}

// ---------------------------------------------------------------------------
// Post-process: inject local image references
// ---------------------------------------------------------------------------

/**
 * Replace remote image URLs in LLM-generated note body with local Obsidian
 * `![[filename|600]]` references.
 *
 * The LLM may output standard markdown images like `![caption](https://arxiv.org/...)`.
 * This function maps those URLs back to the locally-downloaded files.
 */
export function postProcessNoteImages(
  noteBody: string,
  localFigures: Array<PaperFigure & { localRef?: string; localPath?: string }>
): string {
  if (localFigures.length === 0) return noteBody;

  // Build a map: remote URL → local Obsidian reference
  const urlToLocal = new Map<string, string>();
  for (const fig of localFigures) {
    if (fig.localRef && fig.url) {
      urlToLocal.set(fig.url, fig.localRef);
    }
    if (fig.localRef && fig.localPath) {
      // Also map by filename for partial matches
      const filename = path.basename(fig.localPath);
      urlToLocal.set(filename, fig.localRef);
    }
  }

  if (urlToLocal.size === 0) return noteBody;

  let processed = noteBody;

  // Replace standard markdown image refs: ![caption](url) → local ref
  processed = processed.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, caption, url) => {
      // Exact URL match
      if (urlToLocal.has(url)) {
        return urlToLocal.get(url)!;
      }
      // Try matching by checking if any known URL is a substring
      for (const [knownUrl, localRef] of urlToLocal.entries()) {
        if (url.includes(knownUrl) || knownUrl.includes(url)) {
          return localRef;
        }
      }
      // No match — keep original but add a caption comment
      return _match;
    }
  );

  // Also replace any remaining bare arXiv image URLs that weren't in markdown syntax
  // but appeared as plain text references
  for (const [url, localRef] of urlToLocal.entries()) {
    if (url.startsWith("http") && processed.includes(url)) {
      processed = processed.replace(url, localRef);
    }
  }

  return processed;
}

// ---------------------------------------------------------------------------
// Assemble full note
// ---------------------------------------------------------------------------

/**
 * Assemble the final note content from frontmatter + LLM-generated body.
 */
export function assembleNote(
  frontmatter: string,
  noteBody: string
): string {
  return `${frontmatter}\n\n${noteBody.trim()}\n`;
}
