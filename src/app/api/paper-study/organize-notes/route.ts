import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildNotesOrganizePrompt } from "@/lib/ai/prompts";
import {
  listDirectory,
  readFile,
  createDirectory,
  renameFile,
} from "@/lib/files/filesystem";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { notesDir, dryRun } = await req.json();

    if (!notesDir || typeof notesDir !== "string") {
      return NextResponse.json(
        { error: "Missing notesDir" },
        { status: 400 }
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI is not configured. Please set an API key in .env.local." },
        { status: 503 }
      );
    }

    // List all .md files in the notes directory (top-level only)
    const entries = await listDirectory(notesDir);
    const mdFiles = entries.filter(
      (e) => e.type === "file" && e.name.endsWith(".md")
    );

    if (mdFiles.length === 0) {
      return NextResponse.json({ categories: [] });
    }

    // Read excerpts from each file
    const fileData = await Promise.all(
      mdFiles.map(async (f) => {
        try {
          const content = await readFile(path.join(notesDir, f.name));
          return {
            name: f.name,
            excerpt: content.slice(0, 500),
          };
        } catch {
          return { name: f.name, excerpt: "" };
        }
      })
    );

    // Ask LLM to classify
    const model = await getConfiguredModel();
    const prompt = buildNotesOrganizePrompt(fileData);

    const { text } = await generateText({
      model,
      prompt,
      temperature: 0.3,
    });

    // Parse JSON response from LLM
    let categories: Array<{ name: string; files: string[] }>;
    try {
      // Extract JSON from potential markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [
        null,
        text,
      ];
      const parsed = JSON.parse(jsonMatch[1]!.trim());
      categories = parsed.categories || [];
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM classification result" },
        { status: 500 }
      );
    }

    // Validate that all referenced files actually exist
    const existingNames = new Set(mdFiles.map((f) => f.name));
    for (const cat of categories) {
      cat.files = cat.files.filter((f) => existingNames.has(f));
    }
    // Remove empty categories
    categories = categories.filter((c) => c.files.length > 0);

    if (dryRun) {
      return NextResponse.json({ categories });
    }

    // Execute: create subdirectories and move files
    for (const cat of categories) {
      const subDir = path.join(notesDir, cat.name);
      try {
        await createDirectory(subDir);
      } catch {
        // Directory may already exist
      }

      for (const fileName of cat.files) {
        const src = path.join(notesDir, fileName);
        const dest = path.join(subDir, fileName);
        try {
          await renameFile(src, dest);
        } catch (err) {
          console.error(`Failed to move ${fileName} to ${cat.name}:`, err);
        }
      }
    }

    return NextResponse.json({ categories, executed: true });
  } catch (error) {
    console.error("Organize notes error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Organize failed" },
      { status: 500 }
    );
  }
}
