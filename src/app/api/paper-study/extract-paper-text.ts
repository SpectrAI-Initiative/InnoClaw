import { extractText, isSupportedFile, normalizeText } from "@/lib/files/text-extractor";
import { validatePath } from "@/lib/files/filesystem";
import {
  fetchRemotePaperContent,
  type RemotePaperContent,
} from "@/lib/paper-study/remote-paper-fetcher";

interface ArticleRef {
  id: string;
  url: string;
  pdfUrl?: string;
  source: string;
}

/**
 * Extract full paper text for feeding into discussion/ideation agents.
 * Supports both local files and remote papers (arXiv, Semantic Scholar, etc.).
 *
 * @param article - must have `id`, `url`, optional `pdfUrl`, and `source`
 * @param maxChars - truncate to this many characters to fit context windows
 */
export async function extractPaperFullText(
  article: ArticleRef,
  maxChars: number = 30_000,
): Promise<string | undefined> {
  if (article.source === "local") {
    try {
      const filePath = validatePath(article.url);
      if (!isSupportedFile(filePath)) return undefined;

      const rawText = await extractText(filePath);
      if (!rawText || rawText.trim().length < 50) return undefined;

      const text = normalizeText(rawText);
      return text.slice(0, maxChars);
    } catch {
      return undefined;
    }
  }

  // Remote sources: arXiv, Semantic Scholar, HuggingFace, etc.
  try {
    const result = await fetchRemotePaperContent(article, maxChars);
    return result.fullText || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract full paper content including figures.
 * Returns both text and figure information for richer context.
 */
export async function extractPaperFullContent(
  article: ArticleRef,
  maxChars: number = 30_000,
): Promise<RemotePaperContent> {
  if (article.source === "local") {
    try {
      const filePath = validatePath(article.url);
      if (!isSupportedFile(filePath)) {
        return { fullText: "", figures: [], source: "none" };
      }

      const rawText = await extractText(filePath);
      if (!rawText || rawText.trim().length < 50) {
        return { fullText: "", figures: [], source: "none" };
      }

      const text = normalizeText(rawText).slice(0, maxChars);
      return { fullText: text, figures: [], source: "pdf" };
    } catch {
      return { fullText: "", figures: [], source: "none" };
    }
  }

  try {
    return await fetchRemotePaperContent(article, maxChars);
  } catch {
    return { fullText: "", figures: [], source: "none" };
  }
}
