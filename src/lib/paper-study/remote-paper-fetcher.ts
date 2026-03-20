import * as cheerio from "cheerio";
import { extractPdfText } from "@/lib/files/pdf-parser";
import { normalizeText } from "@/lib/files/text-extractor";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface PaperFigure {
  url: string;
  caption: string;
  figureId?: string;
  /** Base64 data URI of the image, populated by downloadFigureImages(). */
  dataUrl?: string;
}

export interface RemotePaperContent {
  fullText: string;
  figures: PaperFigure[];
  source: "arxiv-html" | "pdf" | "none";
}

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const HTML_TIMEOUT_MS = 30_000;
const PDF_TIMEOUT_MS = 45_000;
const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_MAX_CHARS = 30_000;

const USER_AGENT =
  "InnoClaw/1.0 (Academic Research Tool; mailto:noreply@example.com)";

// ---------------------------------------------------------------------
// arXiv helpers
// ---------------------------------------------------------------------

/** Extract the base arXiv ID from a URL or raw id string, stripping version suffix. */
function extractArxivId(articleId: string, articleUrl: string): string | null {
  // Try to extract from URL first
  const urlMatch = articleUrl.match(
    /arxiv\.org\/(?:abs|html|pdf)\/(\d{4}\.\d{4,5})/
  );
  if (urlMatch) return urlMatch[1];

  // Try HuggingFace papers URL (which wraps arXiv IDs)
  const hfMatch = articleUrl.match(
    /huggingface\.co\/papers\/(\d{4}\.\d{4,5})/
  );
  if (hfMatch) return hfMatch[1];

  // Try raw ID
  const idMatch = articleId.match(/^(\d{4}\.\d{4,5})/);
  if (idMatch) return idMatch[1];

  return null;
}

/** Fetch the HTML version of an arXiv paper. */
async function fetchArxivHtml(
  arxivId: string,
  timeoutMs = HTML_TIMEOUT_MS
): Promise<string | null> {
  const url = `https://arxiv.org/html/${arxivId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) return null;

    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Download a single image and return as base64 data URI. */
async function fetchImageAsDataUrl(
  imgUrl: string,
  referer: string
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(imgUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;

    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) return null;

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 5 * 1024 * 1024 || buffer.byteLength === 0) return null;

    const contentType = res.headers.get("content-type") || "image/png";
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse arXiv HTML to extract text and figures (downloading images inline). */
async function extractTextAndFiguresFromHtml(
  html: string,
  baseUrl: string
): Promise<{ text: string; figures: PaperFigure[] }> {
  const $ = cheerio.load(html);

  // Collect figure info before removing elements
  const rawFigures: { url: string; caption: string; figureId?: string }[] = [];
  $("figure").each((_i, el) => {
    const $fig = $(el);
    const $img = $fig.find("img[src]").first();
    const $caption = $fig.find("figcaption");

    if ($img.length === 0 && $caption.length === 0) return;

    let imgSrc = $img.attr("src") || "";
    // Resolve relative URLs
    if (imgSrc && !imgSrc.startsWith("http")) {
      // arXiv HTML has two patterns for image src:
      // 1. "2310.06825v1/x1.png" — already contains versioned ID prefix
      //    → must resolve against https://arxiv.org/html/
      // 2. "x1.png" — just the filename
      //    → must resolve against https://arxiv.org/html/{arxivId}/
      // Detect pattern 1: src starts with an arXiv-ID-like prefix (digits.digits)
      const hasIdPrefix = /^\d{4}\.\d{4,5}/.test(imgSrc);
      const resolveBase = hasIdPrefix
        ? baseUrl.replace(/\/[^/]+\/?$/, "/") // strip last path segment → .../html/
        : baseUrl;
      imgSrc = new URL(imgSrc, resolveBase).href;
    }

    const caption = $caption.text().trim();
    const figureId = $fig.attr("id") || undefined;

    if (imgSrc || caption) {
      rawFigures.push({ url: imgSrc, caption, figureId });
    }
  });

  // Remove non-content elements
  $(
    "script, style, nav, header, footer, aside, .ltx_page_footer, .ltx_page_header, #header, .arxiv-watermark"
  ).remove();

  const text = $.text().replace(/\s+/g, " ").trim();

  // Download figure images in parallel (with Referer from the HTML page)
  const figurePromises = rawFigures
    .filter((f) => f.url)
    .slice(0, 10)
    .map(async (f): Promise<PaperFigure> => {
      const dataUrl = await fetchImageAsDataUrl(f.url, baseUrl);
      return { ...f, dataUrl: dataUrl || undefined };
    });

  const figures = await Promise.all(figurePromises);
  // Keep all figures that have a URL (even if base64 download failed).
  // Downstream consumers (note-generator) can retry the download.
  const validFigures = figures.filter((f) => f.url || f.dataUrl);

  return { text, figures: validFigures };
}

// ---------------------------------------------------------------------
// PDF helpers
// ---------------------------------------------------------------------

/** Download a remote PDF and return its buffer. */
async function fetchRemotePdf(
  pdfUrl: string,
  timeoutMs = PDF_TIMEOUT_MS
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(pdfUrl, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    // Check file size before downloading
    const contentLength = res.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_PDF_BYTES) {
      console.warn(
        `PDF too large: ${contentLength} bytes (max ${MAX_PDF_BYTES})`
      );
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_PDF_BYTES) return null;

    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------

/**
 * Fetch full paper content from remote sources.
 *
 * Strategy:
 * - arXiv: try HTML first (has figures), fall back to PDF
 * - Others: try pdfUrl if available
 */
export async function fetchRemotePaperContent(
  article: {
    id: string;
    url: string;
    pdfUrl?: string;
    source: string;
  },
  maxChars = DEFAULT_MAX_CHARS
): Promise<RemotePaperContent> {
  const empty: RemotePaperContent = {
    fullText: "",
    figures: [],
    source: "none",
  };

  const isArxiv =
    article.source === "arxiv" ||
    article.source === "huggingface" ||
    article.url.includes("arxiv.org") ||
    article.url.includes("huggingface.co/papers/");
  const arxivId = isArxiv
    ? extractArxivId(article.id, article.url)
    : null;

  // --- Strategy 1: arXiv HTML (best quality — has figures) ---
  if (arxivId) {
    const html = await fetchArxivHtml(arxivId);
    if (html) {
      const baseUrl = `https://arxiv.org/html/${arxivId}/`;
      const { text, figures } = await extractTextAndFiguresFromHtml(html, baseUrl);
      if (text.length > 200) {
        const normalized = normalizeText(text);
        return {
          fullText: normalized.slice(0, maxChars),
          figures,
          source: "arxiv-html",
        };
      }
    }
  }

  // --- Strategy 2: PDF download ---
  const pdfUrl =
    article.pdfUrl ||
    (arxivId ? `https://arxiv.org/pdf/${arxivId}` : null);

  if (pdfUrl) {
    const buffer = await fetchRemotePdf(pdfUrl);
    if (buffer) {
      try {
        const rawText = await extractPdfText(buffer);
        if (rawText && rawText.trim().length > 100) {
          const normalized = normalizeText(rawText);
          return {
            fullText: normalized.slice(0, maxChars),
            figures: [], // PDF parsing doesn't extract figures
            source: "pdf",
          };
        }
      } catch (err) {
        console.warn("PDF text extraction failed:", err);
      }
    }
  }

  return empty;
}

// ---------------------------------------------------------------------
// Figure image downloader
// ---------------------------------------------------------------------

const IMG_TIMEOUT_MS = 10_000;
const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB per image

/**
 * Download figure images and embed them as base64 data URIs.
 * This avoids CORS issues when displaying images in the browser
 * and ensures images persist when saved as notes.
 */
export async function downloadFigureImages(
  figures: PaperFigure[],
  maxImages = 10
): Promise<PaperFigure[]> {
  const toDownload = figures.filter((f) => f.url).slice(0, maxImages);

  const results = await Promise.allSettled(
    toDownload.map(async (fig) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), IMG_TIMEOUT_MS);

      try {
        const res = await fetch(fig.url, {
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT },
        });
        if (!res.ok) return fig;

        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_IMG_BYTES) return fig;

        const buffer = await res.arrayBuffer();
        if (buffer.byteLength > MAX_IMG_BYTES) return fig;

        const contentType = res.headers.get("content-type") || "image/png";
        const base64 = Buffer.from(buffer).toString("base64");
        return { ...fig, dataUrl: `data:${contentType};base64,${base64}` };
      } catch {
        return fig;
      } finally {
        clearTimeout(timer);
      }
    })
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : toDownload[i]
  );
}
