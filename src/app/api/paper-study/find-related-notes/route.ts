import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildFindRelatedNotesPrompt } from "@/lib/ai/prompts";
import { listDirectory, readFile } from "@/lib/files/filesystem";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { notesDir, article } = await req.json();

    if (!notesDir || typeof notesDir !== "string") {
      return NextResponse.json(
        { error: "Missing notesDir" },
        { status: 400 }
      );
    }

    if (!article || !article.title) {
      return NextResponse.json(
        { error: "Missing article data" },
        { status: 400 }
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI is not configured." },
        { status: 503 }
      );
    }

    // Recursively collect all .md files from notesDir
    const allFiles = await collectMdFiles(notesDir, notesDir);

    if (allFiles.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // Read excerpts from each file
    const fileData = await Promise.all(
      allFiles.map(async (f) => {
        try {
          const content = await readFile(f.fullPath);
          return {
            name: f.relativeName,
            excerpt: content.slice(0, 500),
            fullContent: content,
          };
        } catch {
          return { name: f.relativeName, excerpt: "", fullContent: "" };
        }
      })
    );

    const validFiles = fileData.filter((f) => f.excerpt.length > 0);
    if (validFiles.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // Ask LLM to find related notes
    const model = await getConfiguredModel();
    const prompt = buildFindRelatedNotesPrompt(
      { title: article.title, abstract: article.abstract || "" },
      validFiles.map((f) => ({ name: f.name, excerpt: f.excerpt }))
    );

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.3,
    });

    // Parse JSON response
    let related: Array<{ name: string; reason: string }>;
    try {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
        null,
        text,
      ];
      const parsed = JSON.parse(jsonMatch[1]!.trim());
      related = parsed.related || [];
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response" },
        { status: 500 }
      );
    }

    // Validate and enrich with full content
    const fileMap = new Map(validFiles.map((f) => [f.name, f.fullContent]));
    const enrichedRelated = related
      .filter((r) => fileMap.has(r.name))
      .map((r) => ({
        name: r.name,
        reason: r.reason,
        content: fileMap.get(r.name)!,
      }));

    return NextResponse.json({ related: enrichedRelated });
  } catch (error) {
    console.error("Find related notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

async function collectMdFiles(
  dir: string,
  rootDir: string
): Promise<Array<{ fullPath: string; relativeName: string }>> {
  const results: Array<{ fullPath: string; relativeName: string }> = [];
  try {
    const entries = await listDirectory(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.type === "directory") {
        const subFiles = await collectMdFiles(fullPath, rootDir);
        results.push(...subFiles);
      } else if (entry.type === "file" && entry.name.endsWith(".md")) {
        const relativeName = path.relative(rootDir, fullPath);
        results.push({ fullPath, relativeName });
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return results;
}
