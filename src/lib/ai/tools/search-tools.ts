import { tool } from "ai";
import { z } from "zod";
import {
  searchArticles as doSearchArticles,
  findRelatedArticles,
} from "@/lib/article-search";
import type { Article } from "@/lib/article-search";
import { PAPER } from "@/lib/constants";

/** Format an Article for LLM-friendly output. */
function formatArticle(a: Article) {
  return {
    id: a.id,
    title: a.title,
    authors: a.authors.slice(0, PAPER.MAX_AUTHORS_DISPLAY).join(", ") + (a.authors.length > PAPER.MAX_AUTHORS_DISPLAY ? " et al." : ""),
    abstract: a.abstract.length > PAPER.MAX_ABSTRACT_LENGTH ? a.abstract.slice(0, PAPER.MAX_ABSTRACT_LENGTH) + "\u2026" : a.abstract,
    url: a.url,
    pdfUrl: a.pdfUrl,
    publishedDate: a.publishedDate,
    source: a.source,
  };
}

export function createSearchTools() {
  return {
    searchArticles: tool({
      description:
        "Search for academic articles from arXiv and Hugging Face Daily Papers. " +
        "Returns matching articles with title, authors, abstract, link, and date. " +
        "Supports keyword search with optional date filtering. " +
        "After displaying results, users can ask for a detailed summary of specific articles and related article recommendations.",
      inputSchema: z
        .object({
          keywords: z
            .array(z.string())
            .default([])
            .describe(
              "Keywords to search for (e.g. ['transformer', 'attention']). " +
                "Required for keyword search; can be omitted when using 'findRelatedTo'."
            ),
          maxResults: z
            .number()
            .min(1)
            .max(30)
            .optional()
            .describe("Maximum results per source (default: 10, max: 30)"),
          dateFrom: z
            .string()
            .optional()
            .describe(
              "Only return articles published after this date (ISO 8601, e.g. '2025-01-01')"
            ),
          dateTo: z
            .string()
            .optional()
            .describe(
              "Only return articles published before this date (ISO 8601, e.g. '2025-12-31')"
            ),
          sources: z
            .array(z.enum(["arxiv", "huggingface"]))
            .optional()
            .describe(
              "Data sources to search (default: both 'arxiv' and 'huggingface')"
            ),
          findRelatedTo: z
            .object({
              id: z.string(),
              title: z.string(),
              source: z.enum(["arxiv", "huggingface"]),
            })
            .optional()
            .describe(
              "If provided, find articles related to this article instead of performing a keyword search"
            ),
        })
        .refine(
          (data) =>
            (Array.isArray(data.keywords) && data.keywords.length > 0) ||
            !!data.findRelatedTo,
          {
            message:
              "Provide at least one keyword or a 'findRelatedTo' article.",
            path: ["keywords"],
          }
        ),
      execute: async ({
        keywords,
        maxResults,
        dateFrom,
        dateTo,
        sources,
        findRelatedTo,
      }) => {
        if (findRelatedTo) {
          const related = await findRelatedArticles(
            {
              id: findRelatedTo.id,
              title: findRelatedTo.title,
              authors: [],
              abstract: "",
              url: "",
              publishedDate: "",
              source: findRelatedTo.source,
            },
            3
          );
          return {
            relatedTo: findRelatedTo.title,
            articles: related.map(formatArticle),
            totalCount: related.length,
          };
        }

        const result = await doSearchArticles({
          keywords,
          maxResults,
          dateFrom,
          dateTo,
          sources,
        });

        return {
          articles: result.articles.map(formatArticle),
          totalCount: result.totalCount,
          errors: result.errors,
        };
      },
    }),
  };
}
