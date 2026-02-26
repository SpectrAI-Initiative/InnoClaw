import { db } from "@/lib/db";
import { sources, sourceChunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  extractText,
  normalizeText,
  isSupportedFile,
} from "@/lib/files/text-extractor";
import {
  listAllFiles,
  validatePath,
} from "@/lib/files/filesystem";
import { chunkText } from "./chunker";
import { generateEmbeddings } from "./embeddings";
import { insertEmbeddings, deleteEmbeddings } from "./vector-store";
import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

/**
 * Compute a hash of file content for change detection.
 */
async function computeFileHash(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("md5").update(buffer).digest("hex");
}

/**
 * Process a single source file: extract text, chunk, embed, store.
 */
async function processSource(sourceId: string, filePath: string) {
  try {
    // Extract text
    const rawText = await extractText(filePath);
    const text = normalizeText(rawText);

    if (!text || text.length < 10) {
      // File has no or insufficient content to process meaningfully
      await db
        .update(sources)
        .set({ rawContent: text || "", isProcessed: true })
        .where(eq(sources.id, sourceId));
      return;
    }

    // Update raw content
    await db
      .update(sources)
      .set({ rawContent: text })
      .where(eq(sources.id, sourceId));

    // Get the workspace ID
    const source = await db
      .select({ workspaceId: sources.workspaceId })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);

    if (source.length === 0) return;
    const workspaceId = source[0].workspaceId;

    // Delete existing chunks for this source
    const existingChunks = await db
      .select({ id: sourceChunks.id })
      .from(sourceChunks)
      .where(eq(sourceChunks.sourceId, sourceId));

    if (existingChunks.length > 0) {
      deleteEmbeddings(existingChunks.map((c) => c.id));
      await db
        .delete(sourceChunks)
        .where(eq(sourceChunks.sourceId, sourceId));
    }

    // Chunk the text
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await db
        .update(sources)
        .set({ isProcessed: true })
        .where(eq(sources.id, sourceId));
      return;
    }

    // Store chunks in DB
    const chunkRecords = chunks.map((chunk) => ({
      id: nanoid(),
      sourceId,
      workspaceId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      startChar: chunk.startChar,
      endChar: chunk.endChar,
    }));

    for (const record of chunkRecords) {
      await db.insert(sourceChunks).values(record);
    }

    // Generate and store embeddings only if an embedding API key is available
    if (process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY) {
      try {
        const texts = chunkRecords.map((r) => r.content);
        const embeddings = await generateEmbeddings(texts);

        const embeddingItems = chunkRecords.map((record, i) => ({
          chunkId: record.id,
          embedding: embeddings[i],
        }));

        insertEmbeddings(embeddingItems);
      } catch (embeddingError) {
        console.warn(
          `Embedding generation failed for source ${sourceId} (chunks still stored, keyword search available):`,
          embeddingError
        );
      }
    }

    // Mark source as processed
    await db
      .update(sources)
      .set({ isProcessed: true })
      .where(eq(sources.id, sourceId));
  } catch (error) {
    console.error(`Failed to process source ${sourceId}:`, error);
    // Don't mark as processed so it can be retried
  }
}

/**
 * Sync a workspace: scan folder, diff with DB, ingest new/changed, remove deleted.
 */
export async function syncWorkspace(
  workspaceId: string,
  folderPath: string
): Promise<{ newCount: number; updatedCount: number; removedCount: number }> {
  validatePath(folderPath);

  let newCount = 0;
  let updatedCount = 0;
  let removedCount = 0;

  // 1. List all files in the workspace folder
  const allFiles = await listAllFiles(folderPath);
  const supportedFiles = allFiles.filter((f) => isSupportedFile(f.absolutePath));

  // 2. Get existing sources from DB
  const existingSources = await db
    .select()
    .from(sources)
    .where(eq(sources.workspaceId, workspaceId));

  const existingMap = new Map(existingSources.map((s) => [s.relativePath, s]));
  const scannedPaths = new Set(supportedFiles.map((f) => f.relativePath));

  // 3. Process new and changed files
  for (const file of supportedFiles) {
    const existing = existingMap.get(file.relativePath);

    if (!existing) {
      // New file
      const hash = await computeFileHash(file.absolutePath);
      const id = nanoid();

      await db.insert(sources).values({
        id,
        workspaceId,
        relativePath: file.relativePath,
        fileName: path.basename(file.relativePath),
        fileType: path.extname(file.relativePath).slice(1).toLowerCase(),
        fileSize: file.size,
        fileHash: hash,
        rawContent: "",
        isProcessed: false,
        lastModified: file.mtime,
      });

      await processSource(id, file.absolutePath);
      newCount++;
    } else {
      // Check if changed
      const hash = await computeFileHash(file.absolutePath);
      if (hash !== existing.fileHash) {
        // File has changed
        await db
          .update(sources)
          .set({
            fileHash: hash,
            fileSize: file.size,
            lastModified: file.mtime,
            isProcessed: false,
          })
          .where(eq(sources.id, existing.id));

        await processSource(existing.id, file.absolutePath);
        updatedCount++;
      }
    }
  }

  // 4. Remove deleted files
  for (const existing of existingSources) {
    if (!scannedPaths.has(existing.relativePath)) {
      // File was deleted
      const chunks = await db
        .select({ id: sourceChunks.id })
        .from(sourceChunks)
        .where(eq(sourceChunks.sourceId, existing.id));

      deleteEmbeddings(chunks.map((c) => c.id));
      await db
        .delete(sourceChunks)
        .where(eq(sourceChunks.sourceId, existing.id));
      await db.delete(sources).where(eq(sources.id, existing.id));
      removedCount++;
    }
  }

  return { newCount, updatedCount, removedCount };
}
