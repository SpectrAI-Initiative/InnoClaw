import { extractText, isSupportedFile, normalizeText } from "@/lib/files/text-extractor";
import { validatePath } from "@/lib/files/filesystem";


/**
 * Extract full paper text for local files to feed into discussion/ideation agents.
 * For non-local sources (arXiv, etc.), returns undefined (future: download PDF).
 *
 * @param article - must have `url` (file path for local) and `source`
 * @param maxChars - truncate to this many characters to fit context windows
 */
export async function extractPaperFullText(
  article: { url: string; source: string },
  maxChars: number = 30_000,
): Promise<string | undefined> {
  if (article.source !== "local") {
    // Non-local sources (arXiv, HuggingFace, etc.) — not yet supported
    return undefined;
  }

  try {
    const filePath = validatePath(article.url);
    if (!isSupportedFile(filePath)) return undefined;

    const rawText = await extractText(filePath);
    if (!rawText || rawText.trim().length < 50) return undefined;

    const text = normalizeText(rawText);
    return text.slice(0, maxChars);
  } catch {
    // File not accessible or extraction failed — gracefully fall back
    return undefined;
  }
}
