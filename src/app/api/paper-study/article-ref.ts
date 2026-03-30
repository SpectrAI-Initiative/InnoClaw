import type { ArticleSource } from "@/lib/article-search/types";

export interface PaperArticleRef {
  id?: string;
  url: string;
  source: ArticleSource;
  pdfUrl?: string;
  title?: string;
}
