import * as cheerio from "cheerio";
import { readFileBuffer, readFile } from "./filesystem";
import path from "path";
import { ALL_TEXT_EXTS } from "@/lib/constants";

// Supported file extensions for RAG indexing — derived from shared constants
// plus pdf, md, markdown, htm which are handled specially.
const EXTRA_EXTS = [".pdf", ".md", ".markdown", ".htm"] as const;
export const SUPPORTED_EXTENSIONS = new Set<string>([
  ...ALL_TEXT_EXTS.map((ext) => `.${ext}`),
  ...EXTRA_EXTS,
]);

/**
 * Check if a file extension is supported for text extraction
 */
export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Extract text content from a file based on its type.
 */
export async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".pdf": {
      const buffer = await readFileBuffer(filePath);
      const { extractPdfText } = await import("./pdf-parser");
      return extractPdfText(buffer);
    }

    case ".html":
    case ".htm": {
      const html = await readFile(filePath);
      const $ = cheerio.load(html);
      // Remove non-content elements
      $(
        "script, style, nav, header, footer, aside, .sidebar, .nav, .menu"
      ).remove();
      return $.text().replace(/\s+/g, " ").trim();
    }

    case ".json": {
      const content = await readFile(filePath);
      try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return content;
      }
    }

    default: {
      // All other supported text-based files
      return readFile(filePath);
    }
  }
}

/**
 * Normalize extracted text content.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .replace(/^\s+$/gm, "")
    .trim();
}
