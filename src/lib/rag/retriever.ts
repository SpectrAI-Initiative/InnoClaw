import { db } from "@/lib/db";
import { sourceChunks, sources } from "@/lib/db/schema";
import { eq, inArray, like, or, and } from "drizzle-orm";
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
 * When the query mentions a source filename, the first chunks of that file
 * are always included so meta-questions (title, summary) can be answered.
 *
 * Note: filename-matched chunks are prioritised and placed first. If there
 * are many filename matches they may displace some embedding-based results
 * after the list is capped to topK.
 */
export async function retrieveRelevantChunks(
  query: string,
  workspaceId: string,
  topK: number = 8
): Promise<RetrievedChunk[]> {
  // 1. Check if query mentions any source filename
  const fileNameChunks = await getChunksByMentionedFilename(query, workspaceId);

  // 2. Generate query embedding and search for similar chunks.
  //    If embedding fails, return filename chunks instead of throwing.
  const embeddingChunks: RetrievedChunk[] = [];
  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = await searchSimilar(queryEmbedding, workspaceId, topK);

    if (results.length > 0) {
      // 3. Batch-fetch chunk content and source metadata
      const chunkIds = results.map((r) => r.chunkId);
      const chunks = await db
        .select({
          id: sourceChunks.id,
          content: sourceChunks.content,
          sourceId: sourceChunks.sourceId,
        })
        .from(sourceChunks)
        .where(inArray(sourceChunks.id, chunkIds));

      const chunkMap = new Map(chunks.map((c) => [c.id, c]));

      // Collect unique source IDs and fetch source metadata in one query
      const uniqueSourceIds = [...new Set(chunks.map((c) => c.sourceId))];
      const sourceMeta = uniqueSourceIds.length > 0
        ? await db
            .select({
              id: sources.id,
              fileName: sources.fileName,
              relativePath: sources.relativePath,
            })
            .from(sources)
            .where(inArray(sources.id, uniqueSourceIds))
        : [];

      const sourceMap = new Map(sourceMeta.map((s) => [s.id, s]));

      for (const result of results) {
        const chunk = chunkMap.get(result.chunkId);
        if (!chunk) continue;
        const source = sourceMap.get(chunk.sourceId);
        if (!source) continue;

        embeddingChunks.push({
          chunkId: result.chunkId,
          sourceId: chunk.sourceId,
          fileName: source.fileName,
          relativePath: source.relativePath,
          content: chunk.content,
          similarity: result.similarity,
        });
      }
    }
  } catch (error) {
    console.warn("Embedding-based retrieval failed:", error);
    // If we have filename chunks we can still return those
    if (fileNameChunks.length > 0) return fileNameChunks;
    throw error;
  }

  // 4. Merge: filename-matched chunks first, then embedding results (deduplicated)
  if (fileNameChunks.length === 0) return embeddingChunks;

  const seen = new Set(fileNameChunks.map((c) => c.chunkId));
  const merged = [...fileNameChunks];
  for (const chunk of embeddingChunks) {
    if (!seen.has(chunk.chunkId)) {
      merged.push(chunk);
      seen.add(chunk.chunkId);
    }
  }
  return merged.slice(0, topK);
}

/**
 * Check whether `query` contains the exact filename as a distinct token
 * (bounded by whitespace, punctuation, or start/end of string).
 */
function queryContainsFilename(query: string, fileName: string): boolean {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|[\\s"',.;:!?()\\[\\]])${escaped}(?:$|[\\s"',.;:!?()\\[\\]])`, "i");
  return pattern.test(query);
}

/**
 * When the query mentions a source filename, return the first few chunks
 * of that source so meta-questions (title, abstract, overview) can be answered.
 */
async function getChunksByMentionedFilename(
  query: string,
  workspaceId: string
): Promise<RetrievedChunk[]> {
  const workspaceSources = await db
    .select({ id: sources.id, fileName: sources.fileName, relativePath: sources.relativePath })
    .from(sources)
    .where(eq(sources.workspaceId, workspaceId));

  const matchedSources = workspaceSources.filter((s) =>
    queryContainsFilename(query, s.fileName)
  );

  if (matchedSources.length === 0) return [];

  // Batch-fetch chunks for all matched sources in a single query
  const matchedSourceIds = matchedSources.map((s) => s.id);
  const allChunks = await db
    .select({ id: sourceChunks.id, content: sourceChunks.content, sourceId: sourceChunks.sourceId, chunkIndex: sourceChunks.chunkIndex })
    .from(sourceChunks)
    .where(inArray(sourceChunks.sourceId, matchedSourceIds))
    .orderBy(sourceChunks.chunkIndex);

  // Group by source and take the first 3 chunks per source
  const sourceMetaMap = new Map(matchedSources.map((s) => [s.id, s]));
  const perSourceCount = new Map<string, number>();
  const results: RetrievedChunk[] = [];

  for (const chunk of allChunks) {
    const count = perSourceCount.get(chunk.sourceId) ?? 0;
    if (count >= 3) continue;
    perSourceCount.set(chunk.sourceId, count + 1);

    const src = sourceMetaMap.get(chunk.sourceId)!;
    results.push({
      chunkId: chunk.id,
      sourceId: src.id,
      fileName: src.fileName,
      relativePath: src.relativePath,
      content: chunk.content,
      similarity: 1.0,
    });
  }

  return results;
}

/**
 * Fallback retrieval using keyword matching when embedding-based search is unavailable.
 * Uses SQL LIKE to filter chunks at the database level, avoiding loading all chunks
 * into memory.
 */
export async function retrieveByKeywordSearch(
  query: string,
  workspaceId: string,
  topK: number = 8
): Promise<RetrievedChunk[]> {
  // Extract meaningful keywords (filter out very short words)
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (keywords.length === 0) return [];

  // Build SQL LIKE conditions for each keyword and filter at DB level
  // Escape SQL LIKE wildcards to prevent injection
  const sanitize = (s: string) => s.replace(/[%_\\]/g, "\\$&");
  const likeConditions = keywords.map((kw) => like(sourceChunks.content, `%${sanitize(kw)}%`));
  const keywordFilter = likeConditions.length === 1
    ? likeConditions[0]
    : or(...likeConditions)!;
  const matchedChunks = await db
    .select({
      id: sourceChunks.id,
      content: sourceChunks.content,
      sourceId: sourceChunks.sourceId,
    })
    .from(sourceChunks)
    .where(and(eq(sourceChunks.workspaceId, workspaceId), keywordFilter));

  let topChunks: typeof matchedChunks;
  if (matchedChunks.length > 0) {
    // Score chunks by number of keyword matches, sort and take topK
    const scored = matchedChunks.map((chunk) => {
      const lowerContent = chunk.content.toLowerCase();
      const matchCount = keywords.filter((kw) => lowerContent.includes(kw)).length;
      return { ...chunk, matchCount };
    });
    scored.sort((a, b) => b.matchCount - a.matchCount);
    topChunks = scored.slice(0, topK);
  } else {
    // No keyword matches – return first few chunks of the workspace
    topChunks = await db
      .select({
        id: sourceChunks.id,
        content: sourceChunks.content,
        sourceId: sourceChunks.sourceId,
      })
      .from(sourceChunks)
      .where(eq(sourceChunks.workspaceId, workspaceId))
      .limit(topK);
  }

  if (topChunks.length === 0) return [];

  // Batch-fetch source metadata for all chunks in one query
  const uniqueSourceIds = [...new Set(topChunks.map((c) => c.sourceId))];
  const sourceMeta = await db
    .select({
      id: sources.id,
      fileName: sources.fileName,
      relativePath: sources.relativePath,
    })
    .from(sources)
    .where(inArray(sources.id, uniqueSourceIds));

  const sourceMap = new Map(sourceMeta.map((s) => [s.id, s]));

  const enrichedChunks: RetrievedChunk[] = [];
  for (const chunk of topChunks) {
    const source = sourceMap.get(chunk.sourceId);
    if (!source) continue;

    enrichedChunks.push({
      chunkId: chunk.id,
      sourceId: chunk.sourceId,
      fileName: source.fileName,
      relativePath: source.relativePath,
      content: chunk.content,
      similarity: "matchCount" in chunk ? (chunk as { matchCount: number }).matchCount / keywords.length : 0,
    });
  }

  return enrichedChunks;
}
