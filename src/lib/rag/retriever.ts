import { db } from "@/lib/db";
import { sourceChunks, sources } from "@/lib/db/schema";
import { eq, inArray, asc } from "drizzle-orm";
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

  // 2. Generate query embedding and search for similar chunks (wrapped in try/catch to preserve filename chunks)
  const embeddingChunks: RetrievedChunk[] = [];
  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = await searchSimilar(queryEmbedding, workspaceId, topK);

    if (results.length > 0) {
      const chunkIds = results.map((r) => r.chunkId);
      const chunks = await db
        .select({
          id: sourceChunks.id,
          content: sourceChunks.content,
          sourceId: sourceChunks.sourceId,
        })
        .from(sourceChunks)
        .where(inArray(sourceChunks.id, chunkIds));

      const sourceIds = [...new Set(chunks.map((c) => c.sourceId))];
      const sourceMeta = sourceIds.length > 0
        ? await db
            .select({ id: sources.id, fileName: sources.fileName, relativePath: sources.relativePath })
            .from(sources)
            .where(inArray(sources.id, sourceIds))
        : [];
      const sourceMap = new Map(sourceMeta.map((s) => [s.id, s]));

      const chunkMap = new Map(chunks.map((c) => [c.id, c]));
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

  // 3. Merge: filename-matched chunks first, then embedding results (deduplicated)
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

  const lowerQuery = query.toLowerCase();
  const matchedSources = workspaceSources.filter((s) =>
    lowerQuery.includes(s.fileName.toLowerCase())
  );

  if (matchedSources.length === 0) return [];

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
 * Splits query into keywords and scores chunks by counting keyword matches in JavaScript.
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

  // Get all chunks for this workspace
  const allChunks = await db
    .select({
      id: sourceChunks.id,
      content: sourceChunks.content,
      sourceId: sourceChunks.sourceId,
    })
    .from(sourceChunks)
    .where(eq(sourceChunks.workspaceId, workspaceId));

  if (allChunks.length === 0) return [];

  // Score chunks by number of keyword matches
  const scored = allChunks.map((chunk) => {
    const lowerContent = chunk.content.toLowerCase();
    const matchCount = keywords.filter((kw) => lowerContent.includes(kw)).length;
    return { ...chunk, matchCount };
  });

  // Filter to chunks with at least one match, sort by match count
  const matched = scored
    .filter((c) => c.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, topK);

  // If no keyword matches, return first chunks of each source (deterministic ordering)
  let topChunks;
  if (matched.length > 0) {
    topChunks = matched;
  } else {
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
