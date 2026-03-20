import { tool } from "ai";
import { z } from "zod";
import {
  fetchRemotePaperContent,
  type RemotePaperContent,
} from "@/lib/paper-study/remote-paper-fetcher";

/**
 * Create paper-specific chat tools that let the LLM fetch full text
 * and extract figures from the paper being discussed.
 *
 * A closure-based cache ensures each resource is fetched at most once
 * per chat session.
 */
export function createPaperChatTools(article: {
  id: string;
  url: string;
  pdfUrl?: string;
  source: string;
}) {
  let cachedContent: RemotePaperContent | null = null;

  async function ensureContent(): Promise<RemotePaperContent> {
    if (!cachedContent) {
      cachedContent = await fetchRemotePaperContent(article);
    }
    return cachedContent;
  }

  return {
    fetchPaperFullText: tool({
      description:
        "Fetch the full text of the paper currently being discussed. " +
        "Use this when the user asks about specific sections, methods, results, " +
        "formulas, or details not available in the abstract. " +
        "Returns the full paper text (may be truncated for very long papers).",
      inputSchema: z.object({
        reason: z
          .string()
          .describe("Brief reason why full text is needed"),
      }),
      execute: async ({ reason: _reason }) => {
        const content = await ensureContent();
        if (!content.fullText) {
          return {
            error: "Could not retrieve the full text for this paper.",
          };
        }
        return {
          text: content.fullText,
          source: content.source,
          charCount: content.fullText.length,
        };
      },
    }),

    extractPaperFigures: tool({
      description:
        "Extract figures (images) and their captions from the paper. " +
        "Use this when the user asks about figures, diagrams, architecture " +
        "illustrations, result plots, or visual content of the paper. " +
        "Works best for arXiv papers with HTML versions available.",
      inputSchema: z.object({
        reason: z
          .string()
          .describe("Brief reason why figures are needed"),
      }),
      execute: async ({ reason: _reason }) => {
        const content = await ensureContent();
        if (content.figures.length === 0) {
          return {
            figures: [] as Array<{ url: string; caption: string; id?: string }>,
            count: 0,
            note:
              content.source === "pdf"
                ? "Paper was fetched as PDF; figure extraction requires the HTML version (arXiv only)."
                : "No figures could be extracted from this paper.",
          };
        }
        return {
          figures: content.figures.map((f) => ({
            url: f.url,
            caption: f.caption,
            id: f.figureId,
          })),
          count: content.figures.length,
        };
      },
    }),
  };
}
