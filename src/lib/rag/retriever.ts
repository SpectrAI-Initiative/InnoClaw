import { db } from "@/lib/db";
import { sourceChunks, sources } from "@/lib/db/schema";
import { eq, inArray, like, or, and, asc } from "drizzle-orm";
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
 * Merge strategy: filename-matched chunks are included first, but are capped
 * to at most (topK - floor(topK/2)) slots so that at least floor(topK/2)
 * slots are always reserved for embedding-based results. This prevents a
 * large number of filename matches from crowding out semantic retrieval.
 */
export async function retrieveRelevantChunks(
  query: string,
  workspaceId: string,
  topK: number = 8
): Promise<RetrievedChunk[]> {
  // 1. Check if query mentions any source filename (only when query looks like it contains a filename)
  let fileNameChunks: RetrievedChunk[] = [];
  if (looksLikeFileReference(query)) {
    fileNameChunks = await getChunksByMentionedFilename(query, workspaceId);
  }

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
    console.warn("Embedding-based retrieval failed, continuing with filename-matched chunks:", error);
  }

  // 4. Merge: filename-matched chunks first, then embedding results (deduplicated).
  //    Reserve at least floor(topK/2) slots for embedding-based results so that
  //    a large number of filename matches cannot crowd out semantic retrieval.
  if (fileNameChunks.length === 0) return embeddingChunks.slice(0, topK);

  const minEmbeddingSlots = topK > 1 ? Math.floor(topK / 2) : 0;
  const filenameSlots = Math.min(fileNameChunks.length, topK - minEmbeddingSlots);

  const seen = new Set<string>();
  const merged: RetrievedChunk[] = [];

  for (const chunk of fileNameChunks.slice(0, filenameSlots)) {
    merged.push(chunk);
    seen.add(chunk.chunkId);
  }

  for (const chunk of embeddingChunks) {
    if (merged.length >= topK) break;
    if (!seen.has(chunk.chunkId)) {
      merged.push(chunk);
      seen.add(chunk.chunkId);
    }
  }

  return merged;
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
 * Quick pre-check: does the query look like it references a file?
 * Matches common extensions or quoted names to avoid a full-table scan on every request.
 */
function looksLikeFileReference(query: string): boolean {
  return /\w+\.\w{1,5}\b/.test(query) || /"[^"]+"|'[^']+'/.test(query);
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
  const matchedIds = matchedSources.map((s) => s.id);
  const chunks = await db
    .select({
      id: sourceChunks.id,
      content: sourceChunks.content,
      sourceId: sourceChunks.sourceId,
      chunkIndex: sourceChunks.chunkIndex,
    })
    .from(sourceChunks)
    .where(inArray(sourceChunks.sourceId, matchedIds))
    .orderBy(asc(sourceChunks.sourceId), asc(sourceChunks.chunkIndex));

  // Keep only the first 3 chunks per source
  const sourceMap = new Map(matchedSources.map((s) => [s.id, s]));
  const perSourceCount = new Map<string, number>();
  const results: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const count = perSourceCount.get(chunk.sourceId) ?? 0;
    if (count >= 3) continue;
    perSourceCount.set(chunk.sourceId, count + 1);
    const src = sourceMap.get(chunk.sourceId)!;
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
 * into memory. Scores chunks by counting keyword matches in JavaScript.
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

  // Score chunks by number of keyword matches, sort and take topK
  const scored = matchedChunks.map((chunk) => {
    const lowerContent = chunk.content.toLowerCase();
    const matchCount = keywords.filter((kw) => lowerContent.includes(kw)).length;
    return { ...chunk, matchCount };
  });

  const matched = scored
    .filter((c) => c.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, topK);

  // If no keyword matches, return first chunks of each source (deterministic ordering)
  let topChunks;
  if (matched.length > 0) {
    topChunks = matched;
  } else {
    const allChunks = await db
      .select({
        id: sourceChunks.id,
        content: sourceChunks.content,
        sourceId: sourceChunks.sourceId,
      })
      .from(sourceChunks)
      .where(eq(sourceChunks.workspaceId, workspaceId));

    const sortedAllChunks = [...allChunks].sort((a, b) => {
      if (a.sourceId === b.sourceId) {
        return String(a.id).localeCompare(String(b.id));
      }
      return String(a.sourceId).localeCompare(String(b.sourceId));
    });

    const firstChunksPerSource: typeof allChunks = [];
    const seenSourceIds = new Set<string>();
    for (const chunk of sortedAllChunks) {
      if (!seenSourceIds.has(chunk.sourceId)) {
        seenSourceIds.add(chunk.sourceId);
        firstChunksPerSource.push(chunk);
        if (firstChunksPerSource.length >= topK) break;
      }
    }
    topChunks = firstChunksPerSource;
  }

  if (topChunks.length === 0) return [];

  // Enrich with source metadata (batch query)
  const sourceIds = [...new Set(topChunks.map((c) => c.sourceId))];
  const sourceMeta = sourceIds.length > 0
    ? await db
        .select({ id: sources.id, fileName: sources.fileName, relativePath: sources.relativePath })
        .from(sources)
        .where(inArray(sources.id, sourceIds))
    : [];
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
