import { db, sqlite } from "@/lib/db";
import { sourceChunks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Vector store using cosine similarity computed in JavaScript.
 * This is a portable fallback that works everywhere without native extensions.
 * For production with large datasets, consider sqlite-vec or a dedicated vector DB.
 */

// In-memory cache of embeddings: chunkId -> number[]
const embeddingCache = new Map<string, number[]>();
let vectorTableInitialized = false;

// Initialize the embeddings table
function ensureVectorTable() {
  if (vectorTableInitialized) {
    return;
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chunk_embeddings (
      chunk_id TEXT PRIMARY KEY,
      embedding BLOB NOT NULL
    )
  `);
  vectorTableInitialized = true;
}

/**
 * Store an embedding for a chunk
 */
export function insertEmbedding(chunkId: string, embedding: number[]): void {
  ensureVectorTable();
  const buffer = Buffer.from(new Float32Array(embedding).buffer);

  sqlite
    .prepare(
      "INSERT OR REPLACE INTO chunk_embeddings (chunk_id, embedding) VALUES (?, ?)"
    )
    .run(chunkId, buffer);

  embeddingCache.set(chunkId, embedding);
}

/**
 * Store multiple embeddings in batch
 */
export function insertEmbeddings(
  items: { chunkId: string; embedding: number[] }[]
): void {
  ensureVectorTable();
  const stmt = sqlite.prepare(
    "INSERT OR REPLACE INTO chunk_embeddings (chunk_id, embedding) VALUES (?, ?)"
  );

  const insertMany = sqlite.transaction(
    (entries: { chunkId: string; embedding: number[] }[]) => {
      for (const { chunkId, embedding } of entries) {
        const buffer = Buffer.from(new Float32Array(embedding).buffer);
        stmt.run(chunkId, buffer);
        embeddingCache.set(chunkId, embedding);
      }
    }
  );

  insertMany(items);
}

/**
 * Delete embeddings for given chunk IDs
 */
export function deleteEmbeddings(chunkIds: string[]): void {
  if (chunkIds.length === 0) return;
  ensureVectorTable();

  const placeholders = chunkIds.map(() => "?").join(",");
  sqlite
    .prepare(`DELETE FROM chunk_embeddings WHERE chunk_id IN (${placeholders})`)
    .run(...chunkIds);

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

  deleteEmbeddings(chunks.map((c) => c.id));
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
 * Load an embedding from DB or cache
 */
function loadEmbedding(chunkId: string): number[] | null {
  ensureVectorTable();
  if (embeddingCache.has(chunkId)) {
    return embeddingCache.get(chunkId)!;
  }

  const row = sqlite
    .prepare("SELECT embedding FROM chunk_embeddings WHERE chunk_id = ?")
    .get(chunkId) as { embedding: Buffer } | undefined;

  if (!row) return null;

  const embedding = Array.from(new Float32Array(row.embedding.buffer));
  embeddingCache.set(chunkId, embedding);
  return embedding;
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
  // Get all chunk IDs for this workspace
  const workspaceChunks = await db
    .select({ id: sourceChunks.id })
    .from(sourceChunks)
    .where(eq(sourceChunks.workspaceId, workspaceId));

  const results: { chunkId: string; similarity: number }[] = [];

  for (const chunk of workspaceChunks) {
    const embedding = loadEmbedding(chunk.id);
    if (!embedding) continue;

    const similarity = cosineSimilarity(queryEmbedding, embedding);
    results.push({ chunkId: chunk.id, similarity });
  }

  // Sort by similarity descending and take top K
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}
