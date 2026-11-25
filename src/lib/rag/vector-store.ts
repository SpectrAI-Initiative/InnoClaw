import { db } from "@/lib/db";
import { chunkEmbeddings, sourceChunks } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

/**
 * Vector store using cosine similarity computed in JavaScript.
 * Embeddings are stored as Float32 blobs in `chunk_embeddings`.
 * For large datasets, consider a dedicated vector database.
 */

// In-memory cache of embeddings: chunkId -> number[]
const embeddingCache = new Map<string, number[]>();

/** Rows per INSERT / DELETE statement, to stay well below max_allowed_packet. */
const WRITE_BATCH_SIZE = 200;

export function encodeEmbedding(embedding: number[]): Buffer {
  return Buffer.from(new Float32Array(embedding).buffer);
}

export function decodeEmbedding(buffer: Buffer): number[] {
  // Copy first: a Buffer may be a view into a larger pooled ArrayBuffer.
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return Array.from(new Float32Array(bytes.buffer));
}

function chunked<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/**
 * Store an embedding for a chunk
 */
export async function insertEmbedding(
  chunkId: string,
  embedding: number[]
): Promise<void> {
  await insertEmbeddings([{ chunkId, embedding }]);
}

/**
 * Store multiple embeddings in batch (insert or replace).
 */
export async function insertEmbeddings(
  items: { chunkId: string; embedding: number[] }[]
): Promise<void> {
  if (items.length === 0) return;

  await db.transaction(async (tx) => {
    for (const batch of chunked(items, WRITE_BATCH_SIZE)) {
      await tx
        .insert(chunkEmbeddings)
        .values(
          batch.map(({ chunkId, embedding }) => ({
            chunkId,
            embedding: encodeEmbedding(embedding),
          }))
        )
        .onDuplicateKeyUpdate({
          // Take the value from the row being inserted (INSERT ... ON DUPLICATE KEY UPDATE).
          set: { embedding: sql`values(${sql.identifier("embedding")})` },
        });
    }
  });

  for (const { chunkId, embedding } of items) {
    embeddingCache.set(chunkId, embedding);
  }
}

/**
 * Delete embeddings for given chunk IDs
 */
export async function deleteEmbeddings(chunkIds: string[]): Promise<void> {
  if (chunkIds.length === 0) return;

  for (const batch of chunked(chunkIds, WRITE_BATCH_SIZE)) {
    await db
      .delete(chunkEmbeddings)
      .where(inArray(chunkEmbeddings.chunkId, batch));
  }

  for (const id of chunkIds) {
    embeddingCache.delete(id);
  }
}

/**
 * Delete all embeddings for a workspace (via chunk IDs from source_chunks table)
 */
export async function deleteEmbeddingsByWorkspace(
  workspaceId: string
): Promise<void> {
  const chunks = await db
    .select({ id: sourceChunks.id })
    .from(sourceChunks)
    .where(eq(sourceChunks.workspaceId, workspaceId));

  await deleteEmbeddings(chunks.map((c) => c.id));
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Search for the most similar chunks to a query embedding.
 * Filters to only chunks belonging to the specified workspace.
 */
export async function searchSimilar(
  queryEmbedding: number[],
  workspaceId: string,
  topK: number = 8
): Promise<{ chunkId: string; similarity: number }[]> {
  // Chunk IDs of the workspace that have an embedding
  const workspaceChunks = await db
    .select({ id: sourceChunks.id })
    .from(sourceChunks)
    .innerJoin(chunkEmbeddings, eq(chunkEmbeddings.chunkId, sourceChunks.id))
    .where(eq(sourceChunks.workspaceId, workspaceId));

  // Load every embedding missing from the cache in one round trip
  const missing = workspaceChunks.filter((c) => !embeddingCache.has(c.id));
  for (const batch of chunked(missing.map((c) => c.id), 1000)) {
    const rows = await db
      .select({ chunkId: chunkEmbeddings.chunkId, embedding: chunkEmbeddings.embedding })
      .from(chunkEmbeddings)
      .where(inArray(chunkEmbeddings.chunkId, batch));
    for (const row of rows) {
      embeddingCache.set(row.chunkId, decodeEmbedding(row.embedding));
    }
  }

  const results: { chunkId: string; similarity: number }[] = [];
  for (const chunk of workspaceChunks) {
    const embedding = embeddingCache.get(chunk.id);
    if (!embedding) continue;
    results.push({ chunkId: chunk.id, similarity: cosineSimilarity(queryEmbedding, embedding) });
  }

  // Sort by similarity descending and take top K
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}
