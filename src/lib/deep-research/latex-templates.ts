// =============================================================
// Deep Research — LaTeX Conference Templates
// =============================================================
// Conference template definitions for NeurIPS, ICLR, and ICML.
// Ported from AutoResearchClaw's templates/conference.py.
//
// Each template stores the LaTeX preamble, document structure,
// author format, and bibliography style needed to produce a
// submission-ready .tex file.

// =============================================================
// Types
// =============================================================

export type ConferenceName = "neurips_2025" | "iclr_2026" | "icml_2026";
export type AuthorFormat = "neurips" | "iclr" | "icml";
export type ColumnCount = 1 | 2;

export interface ConferenceTemplate {
  name: ConferenceName;
  displayName: string;
  year: number;
  documentClass: string;
  stylePackage: string;
  styleOptions: string;
  extraPackages: string[];
  authorFormat: AuthorFormat;
  bibStyle: string;
  columns: ColumnCount;
  styleDownloadUrl: string;
  preambleExtra: string;
  /** Whether this template needs CJK (Chinese/Japanese/Korean) support. */
  needsCJK?: boolean;
}

export interface LaTeXPaperInput {
  title: string;
  authors: string;
  abstract: string;
  sections: LaTeXSection[];
  bibFile: string;
  bibEntries: BibTeXEntry[];
  figures: LaTeXFigure[];
  tables: LaTeXTable[];
}

export interface LaTeXSection {
  heading: string;
  content: string;  // Markdown content, will be converted
}

export interface BibTeXEntry {
  citationKey: string;
  entryType: string;  // "article", "inproceedings", "misc", etc.
  title: string;
  authors: string;    // "Author1, First and Author2, Second"
  year?: number;
  venue?: string;     // Journal or conference name
  doi?: string;
  url?: string;
  pages?: string;
  volume?: string;
  number?: string;
  month?: string;
}

export interface LaTeXFigure {
  filename: string;
  caption: string;
  label: string;
  width?: string;  // e.g. "0.8\\linewidth"
}

export interface LaTeXTable {
  caption: string;
  label: string;
  headers: string[];
  rows: string[][];
  columnAlignment?: string;  // e.g. "lcc"
}

// =============================================================
// Conference Templates
// =============================================================

const NEURIPS_2025: ConferenceTemplate = {
  name: "neurips_2025",
  displayName: "NeurIPS 2025",
  year: 2025,
  documentClass: "article",
  stylePackage: "neurips_2025",
  styleOptions: "preprint",
  extraPackages: [
    "inputenc",
    "fontenc[T1]",
    "hyperref",
    "url",
    "booktabs",
    "amsfonts",
    "nicefrac",
    "microtype",
    "xcolor",
    "graphicx",
    "amsmath",
    "amssymb",
    "natbib",
    "algorithm",
    "algorithmic",
  ],
  authorFormat: "neurips",
  bibStyle: "unsrtnat",
  columns: 1,
  styleDownloadUrl:
    "https://media.neurips.cc/Conferences/NeurIPS2025/Styles/neurips_2025.sty",
  preambleExtra: "",
};

const ICLR_2026: ConferenceTemplate = {
  name: "iclr_2026",
  displayName: "ICLR 2026",
  year: 2026,
  documentClass: "article",
  stylePackage: "iclr2026_conference",
  styleOptions: "",
  extraPackages: [
    "times",
    "hyperref",
    "url",
    "graphicx",
    "amsmath",
    "amssymb",
    "natbib",
    "booktabs",
    "multirow",
    "xcolor",
    "algorithm",
    "algorithmic",
  ],
  authorFormat: "iclr",
  bibStyle: "natbib",
  columns: 1,
  styleDownloadUrl: "https://iclr.cc/Conferences/2026/Styles/iclr2026_conference.sty",
  preambleExtra: "",
};

const ICML_2026: ConferenceTemplate = {
  name: "icml_2026",
  displayName: "ICML 2026",
  year: 2026,
  documentClass: "article",
  stylePackage: "icml2026",
  styleOptions: "",
  extraPackages: [
    "times",
    "hyperref",
    "url",
    "graphicx",
    "amsmath",
    "amssymb",
    "natbib",
    "booktabs",
    "xcolor",
    "algorithm",
    "algorithmic",
  ],
  authorFormat: "icml",
  bibStyle: "icml2026",
  columns: 1,
  styleDownloadUrl: "https://icml.cc/Conferences/2026/Styles/icml2026.sty",
  preambleExtra:
    "\\icmltitlerunning{__TITLE__}",
};

export const CONFERENCE_TEMPLATES: Record<ConferenceName, ConferenceTemplate> = {
  neurips_2025: NEURIPS_2025,
  iclr_2026: ICLR_2026,
  icml_2026: ICML_2026,
};

export const CONFERENCE_TEMPLATE_LIST = Object.values(CONFERENCE_TEMPLATES);

export function getTemplate(name: ConferenceName): ConferenceTemplate {
  return CONFERENCE_TEMPLATES[name];
}

// =============================================================
// Author Formatting
// =============================================================

function formatNeurIPSAuthors(authors: string): string {
  const authorList = authors
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  return `\\author{${authorList.join(" \\\\\n  ")}}`;
}

function formatICLRAuthors(authors: string): string {
  const authorList = authors
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  return `\\author{${authorList.join(" \\\\\n")}}`;
}

function formatICMLAuthors(authors: string): string {
  const authorList = authors
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  return (
    "\\begin{icmlauthorlist}\n" +
    authorList.map((a) => `\\icmlauthor{${a}}{}`).join("\n") +
    "\n\\end{icmlauthorlist}"
  );
}

function formatAuthors(authors: string, format: AuthorFormat): string {
  switch (format) {
    case "neurips":
      return formatNeurIPSAuthors(authors);
    case "iclr":
      return formatICLRAuthors(authors);
    case "icml":
      return formatICMLAuthors(authors);
  }
}

// =============================================================
// Preamble Rendering
// =============================================================

/**
 * Detect if text contains CJK (Chinese/Japanese/Korean) characters.
 */
export function containsCJK(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);
}

/**
 * Build CJK support preamble for xelatex or ctex.
 */
export function buildCJKPreamble(): string {
  return `
% CJK (Chinese/Japanese/Korean) support
\\usepackage[UTF8,scheme=plain]{ctex}
\\setCJKmainfont{Songti SC}[AutoFakeBold=2.5]
\\setCJKsansfont{PingFang SC}[AutoFakeBold=2.5]
\\setCJKmonofont{STFangsong}
`;
}

export function renderLaTeXPreamble(
  template: ConferenceTemplate,
  input: Pick<LaTeXPaperInput, "title" | "authors" | "abstract">,
  cjkEnabled?: boolean,
): string {
  const options = template.styleOptions
    ? `[${template.styleOptions}]`
    : "";
  const allPackages = [...template.extraPackages];
  const pkgLines = allPackages
    .map((p) => {
      if (p.includes("[")) {
        const [name, opts] = p.split("[");
        return `\\usepackage[${opts}{${name}}`;
      }
      return `\\usepackage{${p}}`;
    })
    .join("\n");

  const styleComment = template.styleDownloadUrl
    ? `% Download style file: ${template.styleDownloadUrl}\n`
    : "";
  const styleLine = template.stylePackage
    ? `\\usepackage${options}{${template.stylePackage}}\n`
    : "";

  const preambleExtra = template.preambleExtra.replace(
    "__TITLE__",
    input.title,
  );

  // ICML author block goes after \begin{document}
  const preambleAuthor =
    template.authorFormat === "icml"
      ? ""
      : `${formatAuthors(input.authors, template.authorFormat)}\n`;
  const postDocAuthor =
    template.authorFormat === "icml"
      ? `${formatAuthors(input.authors, template.authorFormat)}\n\n`
      : "";

  const cjkBlock = (cjkEnabled || template.needsCJK) ? buildCJKPreamble() : "";

  return (
    `${styleComment}` +
    `\\documentclass{${template.documentClass}}\n` +
    `${styleLine}` +
    `${pkgLines}\n` +
    `${preambleExtra}\n` +
    `${cjkBlock}\n` +
    `\n` +
    `\\title{${input.title}}\n` +
    `\n` +
    `${preambleAuthor}` +
    `\n` +
    `\\begin{document}\n` +
    `${postDocAuthor}` +
    `\\begin{abstract}\n` +
    `${input.abstract}\n` +
    `\\end{abstract}\n` +
    `\n` +
    `\\maketitle\n`
  );
}

// =============================================================
// Footer Rendering (bibliography + end document)
// =============================================================

export function renderLaTeXFooter(
  template: ConferenceTemplate,
  bibFile: string = "references",
): string {
  return (
    `\n\\bibliographystyle{${template.bibStyle}}\n` +
    `\\bibliography{${bibFile}}\n` +
    `\n` +
    `\\end{document}\n`
  );
}

// =============================================================
// Figure & Table Rendering
// =============================================================

export function renderLaTeXFigure(figure: LaTeXFigure): string {
  const width = figure.width || "0.8\\linewidth";
  return (
    `\\begin{figure}[htbp]\n` +
    `  \\centering\n` +
    `  \\includegraphics[width=${width}]{${figure.filename}}\n` +
    `  \\caption{${figure.caption}}\n` +
    `  \\label{${figure.label}}\n` +
    `\\end{figure}\n`
  );
}

export function renderLaTeXTable(table: LaTeXTable): string {
  const alignment = table.columnAlignment || "l" + "c".repeat(table.headers.length - 1);
  const headerRow = table.headers.join(" & ");
  const dataRows = table.rows
    .map((row) => row.join(" & "))
    .join(" \\\\\n    ");

  return (
    `\\begin{table}[htbp]\n` +
    `  \\centering\n` +
    `  \\caption{${table.caption}}\n` +
    `  \\label{${table.label}}\n` +
    `  \\begin{tabular}{${alignment}}\n` +
    `    \\toprule\n` +
    `    ${headerRow} \\\\\n` +
    `    \\midrule\n` +
    `    ${dataRows} \\\\\n` +
    `    \\bottomrule\n` +
    `  \\end{tabular}\n` +
    `\\end{table}\n`
  );
}

// =============================================================
// Template Selection Helper
// =============================================================

export function getDefaultTemplate(): ConferenceTemplate {
  return NEURIPS_2025;
}

export function listAvailableTemplates(): Array<{
  name: ConferenceName;
  displayName: string;
  year: number;
}> {
  return CONFERENCE_TEMPLATE_LIST.map((t) => ({
    name: t.name,
    displayName: t.displayName,
    year: t.year,
  }));
}
