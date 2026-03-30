import path from "path";
import type { ArticleSource } from "./types";
import { readFileBuffer, validatePath } from "@/lib/files/filesystem";
import { extractText, isSupportedFile, normalizeText } from "@/lib/files/text-extractor";
import { extractPdfText } from "@/lib/files/pdf-parser";
import {
  buildArxivPdfUrl,
  buildBioRxivPdfUrl,
  extractArxivIdFromUrl,
  normalizeArxivUrl,
  normalizeBioRxivUrl,
} from "./url-utils";

export interface PaperRef {
  url: string;
  source: ArticleSource;
  pdfUrl?: string;
  title?: string;
}

export interface ReadPaperResult {
  text: string;
  truncated: boolean;
  charsExtracted: number;
  pdfUrl?: string;
  source: ArticleSource;
}

const PAPER_DOWNLOAD_TIMEOUT_MS = 30_000;

function normalizeUrlForSource(url: string, source: ArticleSource): string {
  if (source === "arxiv") {
    return normalizeArxivUrl(url);
  }
  if (source === "biorxiv") {
    return normalizeBioRxivUrl(url);
  }
  return url;
}

export function resolvePaperPdfUrl(paper: PaperRef): string | undefined {
  if (paper.pdfUrl) {
    return normalizeUrlForSource(paper.pdfUrl, paper.source);
  }

  if (paper.source === "arxiv") {
    const arxivId = extractArxivIdFromUrl(paper.url);
    if (arxivId) {
      return buildArxivPdfUrl(arxivId);
    }
  }

  if (paper.source === "biorxiv") {
    return buildBioRxivPdfUrl(paper.url);
  }

  return undefined;
}

async function downloadPdfBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "open-notebook/1.0",
    },
    signal: AbortSignal.timeout(PAPER_DOWNLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Paper download failed: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function resolvePaperPdfBuffer(paper: PaperRef): Promise<Buffer | null> {
  if (paper.source === "local") {
    const filePath = validatePath(paper.url);
    if (path.extname(filePath).toLowerCase() !== ".pdf") {
      return null;
    }
    return readFileBuffer(filePath);
  }

  const pdfUrl = resolvePaperPdfUrl(paper);
  if (!pdfUrl) {
    return null;
  }

  return downloadPdfBuffer(pdfUrl);
}

export async function readPaperText(
  paper: PaperRef,
  options?: { maxChars?: number },
): Promise<ReadPaperResult | null> {
  const maxChars = options?.maxChars ?? 20_000;

  if (paper.source === "local") {
    const filePath = validatePath(paper.url);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".pdf") {
      const buffer = await readFileBuffer(filePath);
      const text = await extractPdfText(buffer);
      return {
        text: text.slice(0, maxChars),
        truncated: text.length > maxChars,
        charsExtracted: Math.min(text.length, maxChars),
        pdfUrl: undefined,
        source: paper.source,
      };
    }

    if (!isSupportedFile(filePath)) {
      return null;
    }

    const rawText = await extractText(filePath);
    const normalized = normalizeText(rawText);
    return {
      text: normalized.slice(0, maxChars),
      truncated: normalized.length > maxChars,
      charsExtracted: Math.min(normalized.length, maxChars),
      pdfUrl: undefined,
      source: paper.source,
    };
  }

  const pdfUrl = resolvePaperPdfUrl(paper);
  if (!pdfUrl) {
    return null;
  }

  const buffer = await downloadPdfBuffer(pdfUrl);
  const text = await extractPdfText(buffer);
  return {
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    charsExtracted: Math.min(text.length, maxChars),
    pdfUrl,
    source: paper.source,
  };
}
