/**
 * Shared format contract between the paper-roast prompt and the roast UI.
 *
 * Each per-paper review starts with a level-3 heading `### 论文：<original title>`.
 * Roasts generated before 2026-11 used `### 📄 <title>`; that form is still
 * recognised so previously saved roasts keep their per-paper action buttons.
 */

/** Prefix the prompt asks the model to put before each paper title. */
export const ROAST_PAPER_HEADING_PREFIX = "论文：";

const PAPER_HEADING_TEXT = /^\s*(?:📄|论文\s*[:：])\s*(.+?)\s*$/u;

/**
 * If `headingText` (the text of an h3, without `###`) is a per-paper heading,
 * return the paper title; otherwise null.
 */
export function parseRoastPaperHeading(headingText: string): string | null {
  const match = headingText.match(PAPER_HEADING_TEXT);
  return match ? match[1] : null;
}

/** Same as {@link parseRoastPaperHeading} but for a raw markdown line (`### …`). */
export function parseRoastPaperHeadingLine(line: string): string | null {
  const match = line.match(/^###\s+(.*)$/);
  return match ? parseRoastPaperHeading(match[1]) : null;
}
