import { tool } from "ai";
import { z } from "zod";
import {
  ALL_ARTICLE_SOURCES,
  SEARCHABLE_ARTICLE_SOURCES,
  searchArticles as doSearchArticles,
  findRelatedArticles,
} from "@/lib/article-search";
import type { Article } from "@/lib/article-search";
import { readPaperText, resolvePaperPdfUrl } from "@/lib/article-search/paper-content";
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
        "Search for academic articles from arXiv, Semantic Scholar, Hugging Face Daily Papers, bioRxiv, PubMed, and PubChem-linked literature. " +
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
            .array(z.enum(SEARCHABLE_ARTICLE_SOURCES))
            .optional()
            .describe(
              "Data sources to search (default: all supported paper sources)"
            ),
          findRelatedTo: z
            .object({
              id: z.string(),
              title: z.string(),
              source: z.enum(SEARCHABLE_ARTICLE_SOURCES),
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
        console.log(`[searchArticles] keywords=${JSON.stringify(keywords)} sources=${JSON.stringify(sources)} findRelatedTo=${!!findRelatedTo}`);

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
          console.log(`[searchArticles] findRelated returned ${related.length} articles`);
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

        console.log(`[searchArticles] search returned ${result.totalCount} articles, errors=${JSON.stringify(result.errors)}`);

        return {
          articles: result.articles.map(formatArticle),
          totalCount: result.totalCount,
          errors: result.errors,
        };
      },
    }),
    readPaper: tool({
      description:
        "Download a paper PDF over HTTPS when needed and extract readable text from the paper. " +
        "Use this after searchArticles when you need to verify findings beyond the abstract.",
      inputSchema: z
        .object({
          title: z.string().optional().describe("Paper title for reference"),
          url: z.string().describe("Canonical paper URL or local file path"),
          pdfUrl: z
            .string()
            .optional()
            .describe("Direct PDF URL when available; arXiv links will be normalized to HTTPS"),
          source: z
            .enum(ALL_ARTICLE_SOURCES)
            .describe("Source of the paper"),
          maxChars: z
            .number()
            .min(1000)
            .max(120000)
            .optional()
            .describe("Maximum number of characters to extract from the paper text"),
        }),
      execute: async ({ title, url, pdfUrl, source, maxChars }) => {
        const result = await readPaperText(
          {
            title,
            url,
            pdfUrl,
            source,
          },
          { maxChars },
        );

        if (!result) {
          return {
            title,
            url,
            pdfUrl: resolvePaperPdfUrl({ title, url, pdfUrl, source }),
            source,
            downloaded: false,
            error: "Could not resolve or read a paper PDF for this source.",
          };
        }

        return {
          title,
          url,
          pdfUrl: result.pdfUrl ?? resolvePaperPdfUrl({ title, url, pdfUrl, source }),
          source,
          downloaded: true,
          charsExtracted: result.charsExtracted,
          truncated: result.truncated,
          text: result.text,
        };
      },
    }),
  };
}
