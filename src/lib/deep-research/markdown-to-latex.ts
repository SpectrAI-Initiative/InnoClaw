// =============================================================
// Deep Research — Markdown-to-LaTeX Converter
// =============================================================
// Converts markdown research reports into LaTeX for academic paper output.
// Ported from AutoResearchClaw's templates/converter.py.
//
// Handles: inline math \(...\), display math \[...\], $$...$$, bold/italic,
// headings, bullet/numbered lists, code blocks, tables, \cite{}, \ref{},
// figures, and cross-references.

import type { LaTeXFigure, LaTeXTable, BibTeXEntry } from "./latex-templates";

// =============================================================
// Conversion context
// =============================================================

interface ConversionContext {
  figureCount: number;
  tableCount: number;
  citationKeys: Set<string>;
  inList: boolean;
  listType: "itemize" | "enumerate" | null;
  listDepth: number;
}

function createContext(): ConversionContext {
  return {
    figureCount: 0,
    tableCount: 0,
    citationKeys: new Set(),
    inList: false,
    listType: null,
    listDepth: 0,
  };
}

// =============================================================
// Inline conversion
// =============================================================

function convertInlineMarkdown(line: string): string {
  let result = line;

  // Inline code: `code` → \texttt{code}
  result = result.replace(/`([^`]+)`/g, "\\texttt{$1}");

  // Bold italic: ***text*** → \textbf{\textit{text}}
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "\\textbf{\\textit{$1}}");

  // Bold: **text** → \textbf{text}
  result = result.replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}");

  // Italic: *text* → \textit{text}
  result = result.replace(/\*(.+?)\*/g, "\\textit{$1}");

  // Inline math: \(...\) → $...$
  result = result.replace(/\\\((.+?)\\\)/g, "$$1$");

  // Inline math: $...$ (keep as-is but escape underscores that aren't in math)
  // Already handled — $...$ is valid LaTeX

  // Links: [text](url) → \href{url}{text}
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    "\\href{$2}{$1}",
  );

  // Citations: [@key] or \cite{key} (keep as-is, already LaTeX)
  
  return result;
}

// =============================================================
// Display math
// =============================================================

function convertDisplayMath(line: string): string | null {
  // $$...$$ → \[...\]
  if (/^\$\$/.test(line.trim())) {
    return "\\[";
  }

  // \[...\] (keep as-is)
  if (/^\\\[/.test(line.trim())) {
    return "\\[";
  }

  return null;
}

function isDisplayMathEnd(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed === "$$" ||
    trimmed === "\\]" ||
    /^\$\$/.test(trimmed) ||
    /^\\\]/.test(trimmed)
  );
}

// =============================================================
// Table conversion
// =============================================================

interface ParsedTable {
  headers: string[];
  alignment: string;
  rows: string[][];
}

function parseMarkdownTable(lines: string[], startIdx: number): ParsedTable | null {
  const headerLine = lines[startIdx]?.trim();
  const separatorLine = lines[startIdx + 1]?.trim();

  if (!headerLine || !separatorLine) return null;
  if (!/^\|.*\|$/.test(headerLine)) return null;
  if (!/^\|[\s\-:|]+\|$/.test(separatorLine)) return null;

  const headers = headerLine
    .split("|")
    .slice(1, -1)
    .map((h) => h.trim());

  const alignment = separatorLine
    .split("|")
    .slice(1, -1)
    .map((a) => {
      const trimmed = a.trim();
      if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "c";
      if (trimmed.endsWith(":")) return "r";
      return "l";
    })
    .join("");

  const rows: string[][] = [];
  for (let i = startIdx + 2; i < lines.length; i++) {
    const row = lines[i].trim();
    if (!/^\|.*\|$/.test(row)) break;
    rows.push(
      row
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  }

  return { headers, alignment, rows };
}

// =============================================================
// Main converter
// =============================================================

export interface MarkdownToLaTeXOptions {
  /** Fallback title if none found in markdown. */
  title?: string;
  /** Whether to use \section* (unnumbered) vs \section. */
  unnumberedSections?: boolean;
}

export interface MarkdownToLaTeXResult {
  body: string;
  abstract: string;
  extractedTitle: string;
  figures: LaTeXFigure[];
  tables: LaTeXTable[];
}

/**
 * Convert a markdown document to LaTeX body content.
 */
export function convertMarkdownToLaTeX(
  markdown: string,
  options: MarkdownToLaTeXOptions = {},
): MarkdownToLaTeXResult {
  const ctx = createContext();
  const lines = markdown.split("\n");
  const output: string[] = [];
  let abstract = "";
  let extractedTitle = options.title ?? "";
  let inAbstract = false;
  let abstractLines: string[] = [];
  const figures: LaTeXFigure[] = [];
  const tables: LaTeXTable[] = [];
  let inDisplayMath = false;
  let inCodeBlock = false;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Extract title: # Title
    if (/^#\s/.test(line) && !extractedTitle) {
      extractedTitle = line.replace(/^#\s+/, "").trim();
      i++;
      continue;
    }

    // Extract abstract
    if (
      /^#+\s*(?:Abstract|摘要)/i.test(line) &&
      !inAbstract &&
      !abstract
    ) {
      inAbstract = true;
      i++;
      continue;
    }

    if (inAbstract) {
      // End abstract at next heading or empty line followed by heading
      if (
        /^#+\s/.test(line) ||
        (line === "" && i + 1 < lines.length && /^#+\s/.test(lines[i + 1].trim()))
      ) {
        inAbstract = false;
        abstract = abstractLines.join("\n").trim();
        abstractLines = [];
        // Don't increment i — reprocess this line
      } else {
        if (line) abstractLines.push(line);
        i++;
        continue;
      }
    }

    // Display math start
    if (!inCodeBlock) {
      const mathStart = convertDisplayMath(line);
      if (mathStart) {
        inDisplayMath = true;
        output.push(mathStart);
        i++;
        continue;
      }
    }

    // Display math end
    if (inDisplayMath && isDisplayMathEnd(line)) {
      inDisplayMath = false;
      output.push("\\]");
      i++;
      continue;
    }

    // Display math content (pass through)
    if (inDisplayMath) {
      output.push(raw);
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        output.push("\\end{lstlisting}");
      } else {
        inCodeBlock = true;
        output.push("\\begin{lstlisting}[language=Python]");
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      output.push(raw);
      i++;
      continue;
    }

    // Try markdown table
    const parsedTable = parseMarkdownTable(lines, i);
    if (parsedTable && !ctx.inList) {
      ctx.tableCount++;
      const caption = `Table ${ctx.tableCount}`;
      const label = `tab:auto${ctx.tableCount}`;
      const latexTable = renderParsedTable(
        parsedTable,
        caption,
        label,
      );
      output.push(latexTable);
      tables.push({
        caption,
        label,
        headers: parsedTable.headers,
        rows: parsedTable.rows,
        columnAlignment: parsedTable.alignment,
      });
      // Skip table lines
      i += 2 + parsedTable.rows.length;
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,6})\s+(.+)/.exec(line);
    if (headingMatch && !ctx.inList) {
      const level = headingMatch[1].length;
      const text = convertInlineMarkdown(headingMatch[2]);
      const sectionCmd = options.unnumberedSections ? "section*" : "section";
      const subCmd = options.unnumberedSections ? "subsection*" : "subsection";
      const subsubCmd = options.unnumberedSections ? "subsubsection*" : "subsubsection";

      if (ctx.inList) {
        output.push(`\\end{${ctx.listType}}`);
        ctx.inList = false;
        ctx.listType = null;
      }

      if (level === 1) output.push(`\\${sectionCmd}{${text}}`);
      else if (level === 2) output.push(`\\${subCmd}{${text}}`);
      else if (level === 3) output.push(`\\${subsubCmd}{${text}}`);
      else output.push(`\\paragraph{${text}}`);

      output.push("");
      i++;
      continue;
    }

    // Bullet lists
    if (/^[\-\*]\s/.test(line)) {
      if (!ctx.inList || ctx.listType !== "itemize") {
        if (ctx.inList) output.push(`\\end{${ctx.listType}}`);
        output.push("\\begin{itemize}");
        ctx.inList = true;
        ctx.listType = "itemize";
      }
      const item = line.replace(/^[\-\*]\s+/, "");
      output.push(`  \\item ${convertInlineMarkdown(item)}`);
      i++;
      continue;
    }

    // Numbered lists
    if (/^\d+[\.\)]\s/.test(line)) {
      if (!ctx.inList || ctx.listType !== "enumerate") {
        if (ctx.inList) output.push(`\\end{${ctx.listType}}`);
        output.push("\\begin{enumerate}");
        ctx.inList = true;
        ctx.listType = "enumerate";
      }
      const item = line.replace(/^\d+[\.\)]\s+/, "");
      output.push(`  \\item ${convertInlineMarkdown(item)}`);
      i++;
      continue;
    }

    // End list on empty line
    if (line === "" && ctx.inList) {
      output.push(`\\end{${ctx.listType}}`);
      output.push("");
      ctx.inList = false;
      ctx.listType = null;
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line)) {
      if (ctx.inList) {
        output.push(`\\end{${ctx.listType}}`);
        ctx.inList = false;
        ctx.listType = null;
      }
      output.push("\\hrulefill");
      output.push("");
      i++;
      continue;
    }

    // Figure references: ![caption](path) → LaTeX figure
    const figureMatch = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(line);
    if (figureMatch) {
      if (ctx.inList) {
        output.push(`\\end{${ctx.listType}}`);
        ctx.inList = false;
        ctx.listType = null;
      }
      ctx.figureCount++;
      const caption = figureMatch[1] || `Figure ${ctx.figureCount}`;
      const filename = figureMatch[2];
      const label = `fig:auto${ctx.figureCount}`;
      const width = "0.8\\linewidth";

      output.push("\\begin{figure}[htbp]");
      output.push("  \\centering");
      output.push(`  \\includegraphics[width=${width}]{${filename}}`);
      output.push(`  \\caption{${caption}}`);
      output.push(`  \\label{${label}}`);
      output.push("\\end{figure}");
      output.push("");

      figures.push({ filename, caption, label, width });
      i++;
      continue;
    }

    // Block quotes
    if (line.startsWith("> ")) {
      if (ctx.inList) {
        output.push(`\\end{${ctx.listType}}`);
        ctx.inList = false;
        ctx.listType = null;
      }
      const quoteText = line.replace(/^>\s*/, "");
      output.push("\\begin{quote}");
      output.push(convertInlineMarkdown(quoteText));
      // Collect continuation lines
      i++;
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        output.push(convertInlineMarkdown(lines[i].replace(/^>\s*/, "")));
        i++;
      }
      output.push("\\end{quote}");
      output.push("");
      continue;
    }

    // Regular paragraph text
    if (line !== "") {
      // Close list if needed
      if (ctx.inList && !/^[\-\*\d]/.test(line)) {
        output.push(`\\end{${ctx.listType}}`);
        ctx.inList = false;
        ctx.listType = null;
      }
      output.push(convertInlineMarkdown(line));
    } else {
      // Empty line → paragraph break
      output.push("");
    }

    i++;
  }

  // Close any open list
  if (ctx.inList) {
    output.push(`\\end{${ctx.listType}}`);
  }

  // Close any open math
  if (inDisplayMath) {
    output.push("\\]");
  }

  // Close any open code block
  if (inCodeBlock) {
    output.push("\\end{lstlisting}");
  }

  // If no abstract found, use first paragraph
  if (!abstract) {
    const firstParagraphs: string[] = [];
    for (const out of output) {
      if (out.trim() && !out.startsWith("\\")) {
        firstParagraphs.push(out);
        if (firstParagraphs.length >= 3) break;
      }
    }
    abstract = firstParagraphs.join(" ").slice(0, 500);
  }

  return {
    body: output.join("\n"),
    abstract,
    extractedTitle,
    figures,
    tables,
  };
}

// =============================================================
// Helpers
// =============================================================

function renderParsedTable(
  table: ParsedTable,
  caption: string,
  label: string,
): string {
  const headerRow = table.headers.join(" & ");
  const dataRows = table.rows
    .map((row) => {
      // Pad row to match header count
      while (row.length < table.headers.length) row.push("");
      return row.join(" & ");
    })
    .join(" \\\\\n    ");

  return (
    "\\begin{table}[htbp]\n" +
    "  \\centering\n" +
    `  \\caption{${caption}}\n` +
    `  \\label{${label}}\n` +
    `  \\begin{tabular}{${table.alignment}}\n` +
    "    \\toprule\n" +
    `    ${headerRow} \\\\\n` +
    "    \\midrule\n" +
    `    ${dataRows} \\\\\n` +
    "    \\bottomrule\n" +
    "  \\end{tabular}\n" +
    "\\end{table}"
  );
}

// =============================================================
// Full paper assembly
// =============================================================

/**
 * Assemble a complete LaTeX document from converted body and metadata.
 */
export function assembleLaTeXPaper(params: {
  preamble: string;
  body: string;
  footer: string;
  bibFile: string;
}): string {
  return params.preamble + "\n" + params.body + "\n" + params.footer;
}
