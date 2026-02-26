import type { RetrievedChunk } from "@/lib/rag/retriever";

/**
 * Build a system prompt for the chat that includes retrieved source context.
 */
export function buildChatSystemPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return `You are a helpful research assistant. The user's workspace has no indexed files yet, or no relevant content was found for their question. Let them know that they should add files to their workspace and sync to enable source-grounded answers.`;
  }

  const sourcesContext = chunks
    .map((chunk, i) => {
      return `[Source ${i + 1}: "${chunk.fileName}" (${chunk.relativePath})]\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  // Build a lookup from source number to filename for citation instructions
  const sourceList = chunks
    .map((chunk, i) => `- [Source ${i + 1}: "${chunk.fileName}"]`)
    .join("\n");

  return `You are a helpful research assistant. Answer the user's questions based ONLY on the following source materials from their workspace files. If the sources don't contain enough information to answer a question, say so clearly.

When referencing information from the sources, cite them using the format [Source N: "filename"] where N is the source number and filename is the file name. Each citation MUST be a separate bracketed reference. For example: [Source 1: "report.pdf"][Source 2: "data.csv"].

## Source Materials

${sourcesContext}

## Source Index
${sourceList}

## Rules
1. Only use information from the provided sources.
2. Always cite your sources using [Source N: "filename"] notation (e.g. [Source 1: "${chunks[0]?.fileName || "file.pdf"}"]).
3. If you cannot find relevant information in the sources, say "I don't have enough information in the provided sources to answer that question."
4. Be concise but thorough.
5. If multiple sources support a point, cite each one in its own brackets. For example, write [Source 1: "a.pdf"][Source 2: "b.pdf"][Source 3: "c.pdf"]. NEVER group multiple sources in a single bracket like [Source 1; Source 2; Source 3: "file.pdf"] — this format is forbidden.
6. Every citation must include the filename. Always use [Source N: "filename"], never just [Source N].
7. When your response contains multiple suggestions, recommendations, options, or action items for the user to choose from, wrap them in a SELECT block so the user can interactively select. Use [SELECT:multi] when the user can pick more than one, and [SELECT:single] when only one choice makes sense. Format:

[SELECT:multi]
- Option 1 description
- Option 2 description
- Option 3 description
[/SELECT]

Keep each option on a single line starting with "- " or "* ". Do NOT use SELECT blocks for purely informational lists, explanations, or steps — only use them when the user is expected to choose or prioritize among the items.
8. Respond in the same language as the user's message.`;
}

/**
 * Build a system prompt for generating notes of a specific type.
 */
export function buildGeneratePrompt(
  type: string,
  sourceContents: { fileName: string; content: string }[]
): string {
  const combined = sourceContents
    .map((s) => `## ${s.fileName}\n\n${s.content}`)
    .join("\n\n---\n\n");

  const typeInstructions: Record<string, string> = {
    summary:
      "Create a comprehensive summary of the provided source materials. Highlight key points, main arguments, and important findings.",
    faq: "Generate a list of frequently asked questions (and their answers) based on the provided source materials. Cover the most important topics.",
    briefing:
      "Create a briefing document that provides a structured overview of the provided source materials. Include an executive summary, key findings, and recommendations.",
    timeline:
      "Extract and organize key events, milestones, or chronological information from the provided source materials into a timeline format.",
  };

  return `You are a document analysis assistant. ${typeInstructions[type] || typeInstructions.summary}

Respond in the same language as the majority of the source content.

## Source Materials

${combined}`;
}
