export interface ChunkOptions {
  maxChunkSize: number;
  /** Reserved for future use. Currently not applied during chunking. */
  chunkOverlap: number;
  separators: string[];
}

export interface Chunk {
  content: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChunkSize: 2000,
  chunkOverlap: 400,
  separators: ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "],
};

/**
 * Recursively split text into chunks using a hierarchy of separators.
 */
function splitText(
  text: string,
  maxSize: number,
  separators: string[]
): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  // Find the first separator that splits the text
  for (const sep of separators) {
    const parts = text.split(sep);
    if (parts.length <= 1) continue;

    const results: string[] = [];
    let current = "";

    for (const part of parts) {
      const candidate = current ? current + sep + part : part;

      if (candidate.length > maxSize && current) {
        results.push(current);
        current = part;
      } else {
        current = candidate;
      }
    }

    if (current) {
      results.push(current);
    }

    // Recursively split any chunks that are still too large
    const finalResults: string[] = [];
    for (const result of results) {
      if (result.length > maxSize) {
        // Try with remaining separators
        const remaining = separators.slice(separators.indexOf(sep) + 1);
        if (remaining.length > 0) {
          finalResults.push(...splitText(result, maxSize, remaining));
        } else {
          // Force split by character count as last resort
          for (let i = 0; i < result.length; i += maxSize) {
            finalResults.push(result.slice(i, i + maxSize));
          }
        }
      } else {
        finalResults.push(result);
      }
    }

    return finalResults;
  }

  // No separator worked, force split
  const results: string[] = [];
  for (let i = 0; i < text.length; i += maxSize) {
    results.push(text.slice(i, i + maxSize));
  }
  return results;
}

/**
 * Chunk text into overlapping segments for RAG.
 */
export function chunkText(
  text: string,
  options?: Partial<ChunkOptions>
): Chunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rawChunks = splitText(text, opts.maxChunkSize, opts.separators);

  const chunks: Chunk[] = [];
  let charOffset = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    const content = rawChunks[i].trim();
    if (!content) continue;

    // Find the actual position in the original text
    const startChar = text.indexOf(content, charOffset);
    const endChar = startChar + content.length;

    chunks.push({
      content,
      chunkIndex: chunks.length,
      startChar: startChar >= 0 ? startChar : charOffset,
      endChar: startChar >= 0 ? endChar : charOffset + content.length,
    });

    charOffset = startChar >= 0 ? startChar + 1 : charOffset + content.length;

    // Explicit overlap chunks are not created to avoid duplicate content.
    // Related context from adjacent text segments may be retrieved naturally
    // by the retriever if it is semantically similar.
  }

  return chunks;
}
