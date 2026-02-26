import { db } from "@/lib/db";
import { sourceChunks, sources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";
import { searchSimilar } from "./vector-store";

export interface RetrievedChunk {
  chunkId: string;
  sourceId: string;
  fileName: string;
  relativePath: string;
  content: string;
  similarity: number;
}

/**
 * Retrieve the most relevant chunks for a query within a workspace.
 */
export async function retrieveRelevantChunks(
  query: string,
  workspaceId: string,
  topK: number = 8
): Promise<RetrievedChunk[]> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Search for similar chunks
  const results = await searchSimilar(queryEmbedding, workspaceId, topK);

  if (results.length === 0) return [];

  // 3. Fetch chunk content and source metadata
  const enrichedChunks: RetrievedChunk[] = [];

  for (const result of results) {
    const chunk = await db
      .select({
        id: sourceChunks.id,
        content: sourceChunks.content,
        sourceId: sourceChunks.sourceId,
      })
      .from(sourceChunks)
      .where(eq(sourceChunks.id, result.chunkId))
      .limit(1);

    if (chunk.length === 0) continue;

    const source = await db
      .select({
        fileName: sources.fileName,
        relativePath: sources.relativePath,
      })
      .from(sources)
      .where(eq(sources.id, chunk[0].sourceId))
      .limit(1);

    if (source.length === 0) continue;

    enrichedChunks.push({
      chunkId: result.chunkId,
      sourceId: chunk[0].sourceId,
      fileName: source[0].fileName,
      relativePath: source[0].relativePath,
      content: chunk[0].content,
      similarity: result.similarity,
    });
  }

  return enrichedChunks;
}
