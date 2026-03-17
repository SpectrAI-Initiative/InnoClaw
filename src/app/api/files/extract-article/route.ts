import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { extractText, isSupportedFile } from "@/lib/files/text-extractor";
import { validatePath } from "@/lib/files/filesystem";
import { jsonError } from "@/lib/api-errors";
import { logAndIgnore } from "@/lib/utils/log";
import { PAPER } from "@/lib/constants";
import type { Article } from "@/lib/article-search/types";

/**
 * Try to extract the abstract from raw paper text using common heading patterns.
 * Looks for "Abstract" / "ABSTRACT" / "Summary" headings and extracts text up to
 * the next section boundary (e.g., "Introduction", "Keywords", "1.", "I.").
 * Returns undefined if no abstract section is found.
 */
function extractAbstractFromText(text: string): string | undefined {
  // Match "Abstract" or "Summary" as a heading (may be followed by optional colon/period/dash)
  const abstractStart = text.match(
    /(?:^|\n)\s*(?:abstract|summary)\s*[:\.\-—]?\s*\n?/i
  );
  if (!abstractStart || abstractStart.index === undefined) return undefined;

  const startPos = abstractStart.index + abstractStart[0].length;
  const afterAbstract = text.slice(startPos, startPos + 5000);

  // Find the next section boundary
  const sectionBoundary = afterAbstract.match(
    /\n\s*(?:1[\.\s]|I[\.\s]|introduction|keywords|key\s*words|index\s*terms|categories|ccs\s*concepts)\s*/i
  );

  const abstractText = sectionBoundary && sectionBoundary.index !== undefined
    ? afterAbstract.slice(0, sectionBoundary.index)
    : afterAbstract.slice(0, 2000);

  const cleaned = abstractText.replace(/\s+/g, " ").trim();
  // Sanity check: too short means we probably didn't find a real abstract
  return cleaned.length >= 50 ? cleaned : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { filePath } = await req.json();

    if (!filePath || typeof filePath !== "string") {
      return jsonError("Missing filePath", 400);
    }

    // Security: validate path is within workspace roots
    const validated = validatePath(filePath);

    if (!isSupportedFile(validated)) {
      return jsonError("Unsupported file type", 400);
    }

    // Extract text from the file
    const rawText = await extractText(validated);
    if (!rawText.trim()) {
      return jsonError("Could not extract text from file", 400);
    }

    // Truncate for AI extraction
    const truncated = rawText.slice(0, PAPER.MAX_EXTRACT_CONTEXT);
    const fileName = path.basename(validated, path.extname(validated));

    let title = fileName;
    let authors: string[] = [];
    // Use heuristic abstract extraction as fallback (not naive first-N-chars)
    let abstract = extractAbstractFromText(rawText) ?? rawText.slice(0, PAPER.MAX_ABSTRACT_LENGTH);
    let publishedDate = "";

    // Use AI to extract metadata if available
    if (isAIAvailable()) {
      try {
        const model = await getConfiguredModel();
        const result = await generateText({
          model,
          system: `You extract paper metadata from academic document text. Return ONLY valid JSON with these fields:
- "title": string (paper title, usually the first prominent line)
- "authors": string[] (author names only — do NOT include affiliations, emails, or institutions)
- "abstract": string (the paper's abstract — this is the summary paragraph that appears AFTER the title/authors/affiliations section and BEFORE the Introduction. It usually starts after an "Abstract" heading. Do NOT put author names, affiliations, or emails in this field. Up to 500 words.)
- "publishedDate": string (ISO 8601 date if found, or empty string)

IMPORTANT: The "abstract" field must contain the actual research summary, NOT author names or affiliations. If you cannot find a clear abstract section, use the first substantive paragraph that describes the paper's research content.`,
          prompt: `Extract metadata from this document:\n\nFilename: ${fileName}\n\nContent:\n${truncated}`,
          maxOutputTokens: 800,
        });

        // Parse AI response
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.title) title = parsed.title;
          if (Array.isArray(parsed.authors)) authors = parsed.authors;
          if (parsed.abstract) abstract = parsed.abstract;
          if (parsed.publishedDate) publishedDate = parsed.publishedDate;
        }
      } catch (err) {
        logAndIgnore("extract-article:ai")(err);
      }
    }

    const article: Article = {
      id: crypto.createHash("md5").update(validated).digest("hex").slice(0, 16),
      title,
      authors,
      abstract,
      url: validated,
      publishedDate,
      source: "local",
    };

    return NextResponse.json(article);
  } catch (error) {
    console.error("Extract article error:", error);
    const message =
      error instanceof Error ? error.message : "Extraction failed";
    return jsonError(message, 500);
  }
}
