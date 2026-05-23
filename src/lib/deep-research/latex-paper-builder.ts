// =============================================================
// Deep Research — LaTeX Paper Builder
// =============================================================
// Orchestrates full academic paper generation:
//   preamble + body (markdown→LaTeX) + BibTeX + figures + tables
// Ported from AutoResearchClaw's _review_publish.py and converter.py.

import { extractBibTeXEntries, renderBibTeXFile } from "./bibtex-generator";
import { convertMarkdownToLaTeX } from "./markdown-to-latex";
import {
  getTemplate,
  renderLaTeXPreamble,
  renderLaTeXFooter,
  renderLaTeXFigure,
  renderLaTeXTable,
  getDefaultTemplate,
  listAvailableTemplates,
  containsCJK,
} from "./latex-templates";
import type {
  ConferenceTemplate,
  ConferenceName,
  LaTeXPaperInput,
  LaTeXSection,
  LaTeXFigure,
  LaTeXTable,
  BibTeXEntry,
} from "./latex-templates";
import type { DeepResearchArtifact } from "./types";

// =============================================================
// Paper Builder Inputs
// =============================================================

export interface BuildLaTeXPaperInput {
  /** Markdown report text from final-report artifact. */
  markdownReport: string;
  /** All artifacts for BibTeX extraction and context. */
  artifacts: DeepResearchArtifact[];
  /** Conference template to use. */
  conference?: ConferenceName;
  /** Paper title (extracted from markdown if not provided). */
  title?: string;
  /** Author string. */
  authors?: string;
  /** Custom abstract (extracted from markdown if not provided). */
  abstract?: string;
  /** Additional LaTeX sections to append. */
  extraSections?: LaTeXSection[];
  /** Additional figures. */
  extraFigures?: LaTeXFigure[];
  /** Additional tables. */
  extraTables?: LaTeXTable[];
}

export interface BuildLaTeXPaperResult {
  /** The complete .tex file content. */
  texContent: string;
  /** The .bib file content. */
  bibContent: string;
  /** Extracted paper title. */
  title: string;
  /** Extracted abstract. */
  abstract: string;
  /** BibTeX entries used. */
  bibEntries: BibTeXEntry[];
  /** Figures included. */
  figures: LaTeXFigure[];
  /** Tables included. */
  tables: LaTeXTable[];
  /** Conference template used. */
  conference: ConferenceName;
  /** Word count estimate of the body. */
  wordCount: number;
}

// =============================================================
// Main Builder
// =============================================================

/**
 * Build a complete LaTeX academic paper from a markdown research report.
 */
export function buildLaTeXPaper(
  input: BuildLaTeXPaperInput,
): BuildLaTeXPaperResult {
  const template = input.conference
    ? getTemplate(input.conference)
    : getDefaultTemplate();

  // Step 1: Convert markdown to LaTeX
  const converted = convertMarkdownToLaTeX(input.markdownReport, {
    title: input.title,
  });

  const title = input.title || converted.extractedTitle || "Research Report";
  const abstract =
    input.abstract || converted.abstract || "No abstract available.";
  const authors = input.authors || "Anonymous";

  // Step 2: Generate BibTeX from evidence cards
  const bibEntries = extractBibTeXEntries(input.artifacts);
  const bibContent = renderBibTeXFile(bibEntries);

  // Step 3: Build preamble (with CJK auto-detection)
  const hasCJK = containsCJK(title) || containsCJK(abstract) || containsCJK(input.markdownReport.slice(0, 2000));
  const preamble = renderLaTeXPreamble(template, { title, authors, abstract }, hasCJK);

  // Step 4: Build footer
  const bibFile = "references";
  const footer = renderLaTeXFooter(template, bibFile);

  // Step 5: Append figures
  let body = converted.body;
  const allFigures = [...converted.figures, ...(input.extraFigures ?? [])];
  if (allFigures.length > 0) {
    body += "\n\n% --- Figures ---\n\n";
    for (const fig of allFigures) {
      body += renderLaTeXFigure(fig) + "\n";
    }
  }

  // Step 6: Append tables
  const allTables = [...converted.tables, ...(input.extraTables ?? [])];
  if (allTables.length > 0) {
    body += "\n\n% --- Tables ---\n\n";
    for (const table of allTables) {
      body += renderLaTeXTable(table) + "\n";
    }
  }

  // Step 7: Append extra sections
  if (input.extraSections && input.extraSections.length > 0) {
    body += "\n\n% --- Additional Sections ---\n\n";
    for (const section of input.extraSections) {
      body += `\\section{${section.heading}}\n\n`;
      body += section.content + "\n\n";
    }
  }

  // Step 8: Assemble full document
  const texContent = preamble + "\n" + body + "\n" + footer;

  // Step 9: Word count
  const wordCount = body.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    texContent,
    bibContent,
    title,
    abstract,
    bibEntries,
    figures: allFigures,
    tables: allTables,
    conference: template.name,
    wordCount,
  };
}

// =============================================================
// Convenience Exports
// =============================================================

export {
  getTemplate,
  getDefaultTemplate,
  listAvailableTemplates,
};

export type {
  ConferenceTemplate,
  ConferenceName,
  LaTeXPaperInput,
  LaTeXSection,
  LaTeXFigure,
  LaTeXTable,
  BibTeXEntry,
};
