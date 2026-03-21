import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { streamText } from "ai";
import { getConfiguredModel, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { buildStructuredNotePrompt } from "@/lib/ai/paper-prompts";
import { extractPaperFullContent } from "../extract-paper-text";
import {
  downloadFiguresToLocal,
  buildNoteFrontmatter,
  generateNoteFilename,
  extractMethodName,
  assembleNote,
  postProcessNoteImages,
} from "@/lib/paper-study/note-generator";

export async function POST(req: NextRequest) {
  try {
    const { article, notesDir, llmProvider, llmModel } = await req.json();

    if (!article || !article.title) {
      return new Response("Missing article data", { status: 400 });
    }

    if (!notesDir) {
      return new Response("Missing notesDir", { status: 400 });
    }

    // Basic path traversal / sandboxing guard for notesDir
    if (typeof notesDir !== "string") {
      return new Response("Invalid notesDir", { status: 400 });
    }
    // Reject absolute paths to avoid writing outside the intended workspace
    if (path.isAbsolute(notesDir)) {
      return new Response("Invalid notesDir", { status: 400 });
    }
    // Reject any usage of parent directory segments (e.g., "../")
    const unsafeSegments = notesDir.split(/[/\\]+/).some(segment => segment === "..");
    if (unsafeSegments) {
      return new Response("Invalid notesDir", { status: 400 });
    }
    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or SHLAB_API_KEY in .env.local.",
        { status: 503 },
      );
    }

    const { model } = llmProvider && llmModel
      ? getModelFromOverride(llmProvider, llmModel)
      : { model: await getConfiguredModel() };

    // Step 1: Extract full paper content and figures
    const articleRef = {
      id: article.id || "",
      url: article.url || "",
      pdfUrl: article.pdfUrl,
      source: article.source || "",
    };
    const paperContent = await extractPaperFullContent(articleRef, 30_000);

    const fullText = paperContent.fullText || article.abstract || "";
    if (!fullText || fullText.length < 100) {
      return new Response(
        JSON.stringify({ error: "no_full_text" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    // Step 2: Extract method name
    const methodName = extractMethodName(article.title);
    const noteBaseName = methodName
      .replace(/[/\\:*?"<>|]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60);

    // Step 3: Download figures to local assets
    const localFigures = await downloadFiguresToLocal(
      paperContent.figures || [],
      notesDir,
      noteBaseName
    );

    // Step 4: Build prompt with figure references
    const figuresForPrompt = localFigures.map((f) => ({
      url: f.url,
      caption: f.caption,
      figureId: f.figureId,
      localRef: f.localRef || undefined,
    }));

    const systemPrompt = buildStructuredNotePrompt(
      {
        title: article.title,
        authors: Array.isArray(article.authors) ? article.authors : [],
        publishedDate: article.publishedDate || "",
        source: article.source || "",
        abstract: article.abstract || "",
      },
      fullText,
      figuresForPrompt,
    );

    // Step 5: Build frontmatter
    const hasLocalFigs = localFigures.some((f) => f.localRef);
    const frontmatter = buildNoteFrontmatter(
      {
        id: article.id || "",
        title: article.title,
        authors: Array.isArray(article.authors) ? article.authors : [],
        publishedDate: article.publishedDate || "",
        url: article.url || "",
        source: article.source || "",
      },
      methodName,
      hasLocalFigs,
    );

    // Step 6: Stream the note generation
    const encoder = new TextEncoder();
    const fileName = generateNoteFilename(methodName, article.title);
    const filePath = path.join(notesDir, fileName);

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: "请根据上述论文内容，按照模板格式生成完整的结构化笔记。",
      maxOutputTokens: 16384,
      abortSignal: req.signal,
    });

    let fullBody = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Send metadata as first line
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "meta",
              methodName,
              fileName,
              filePath,
              figureCount: localFigures.filter((f) => f.localRef).length,
            }) + "\n",
          ),
        );

        try {
          for await (const chunk of result.textStream) {
            fullBody += chunk;
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "text", text: chunk }) + "\n",
              ),
            );
          }

          // Post-process: replace remote image URLs with local Obsidian refs
          const processedBody = postProcessNoteImages(fullBody, localFigures);

          // Save the complete note to disk
          const noteContent = assembleNote(frontmatter, processedBody);
          await mkdir(path.dirname(filePath), { recursive: true });
          await writeFile(filePath, noteContent, "utf-8");

          // Send completion signal
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "done",
                filePath,
                noteLength: noteContent.split("\n").length,
              }) + "\n",
            ),
          );

          controller.close();
        } catch (error) {
          if (req.signal.aborted) {
            controller.close();
            return;
          }
          console.error("Note generation stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Generate note error:", error);
    return new Response(
      error instanceof Error ? error.message : "Note generation failed",
      { status: 500 },
    );
  }
}
