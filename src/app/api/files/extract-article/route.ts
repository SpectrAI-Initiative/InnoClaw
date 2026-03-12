import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { extractText, isSupportedFile } from "@/lib/files/text-extractor";
import { validatePath } from "@/lib/files/filesystem";
import type { Article } from "@/lib/article-search/types";

export async function POST(req: NextRequest) {
  try {
    const { filePath } = await req.json();

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json({ error: "Missing filePath" }, { status: 400 });
    }

    // Security: validate path is within workspace roots
    const validated = validatePath(filePath);

    if (!isSupportedFile(validated)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    // Extract text from the file
    const rawText = await extractText(validated);
    if (!rawText.trim()) {
      return NextResponse.json({ error: "Could not extract text from file" }, { status: 400 });
    }

    // Truncate for AI extraction (first ~4000 chars is enough for metadata)
    const truncated = rawText.slice(0, 4000);
    const fileName = path.basename(validated, path.extname(validated));

    let title = fileName;
    let authors: string[] = [];
    let abstract = rawText.slice(0, 500);
    let publishedDate = "";

    // Use AI to extract metadata if available
    if (isAIAvailable()) {
      try {
        const model = await getConfiguredModel();
        const result = await generateText({
          model,
          system: `You extract paper metadata from text. Return ONLY valid JSON with these fields:
- "title": string (paper title)
- "authors": string[] (author names)
- "abstract": string (the paper's abstract, up to 500 words)
- "publishedDate": string (ISO 8601 date if found, or empty string)

If a field cannot be determined, use sensible defaults: title from filename, empty array for authors, first paragraph for abstract, empty string for date.`,
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
      } catch {
        // AI extraction failed — use fallbacks (already set above)
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 },
    );
  }
}
