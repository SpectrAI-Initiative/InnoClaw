import { validatePath } from "@/lib/files/filesystem";
import { extractText, isSupportedFile, normalizeText } from "@/lib/files/text-extractor";
import { resolvePaperPdfBuffer } from "@/lib/article-search/paper-content";
import {
  extractPdfPagesWithImages,
  extractPdfPagesTextOnly,
  type PaperContentPart,
} from "@/lib/files/pdf-image-extractor";
import type { PaperArticleRef } from "./article-ref";

// Re-export for convenience
export type { PaperContentPart } from "@/lib/files/pdf-image-extractor";

/**
 * Extract structured paper content (text + page images) from any source.
 * Returns interleaved PaperContentPart[] for multimodal agent consumption.
 *
 * @param article - must have `url`, `source`, and optionally `pdfUrl`
 * @param withImages - whether to render page images (requires canvas; set false for text-only providers)
 * @param maxPages - maximum pages to process
 */
export async function extractPaperContent(
  article: PaperArticleRef,
  withImages: boolean = true,
  maxPages: number = 20,
): Promise<PaperContentPart[] | undefined> {
  try {
    const buffer = await resolvePaperPdfBuffer(article);

    if (buffer) {
      // PDF path — extract with or without images
      const parts = withImages
        ? await extractPdfPagesWithImages(buffer, { maxPages })
        : await extractPdfPagesTextOnly(buffer, maxPages);
      return parts.length > 0 ? parts : undefined;
    }

    // Non-PDF local file — text only
    if (article.source === "local") {
      const filePath = validatePath(article.url);
      if (!isSupportedFile(filePath)) return undefined;
      const rawText = await extractText(filePath);
      if (!rawText || rawText.trim().length < 50) return undefined;
      const text = normalizeText(rawText);
      return [{ type: "text", pageNumber: 1, text }];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract text-only paper content (backward compatible).
 * Kept for callers that don't need images.
 */
export async function extractPaperFullText(
  article: PaperArticleRef,
  maxChars: number = 30_000,
): Promise<string | undefined> {
  const parts = await extractPaperContent(article, false, 30);
  if (!parts) return undefined;

  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");

  return text.length > 0 ? text.slice(0, maxChars) : undefined;
}
