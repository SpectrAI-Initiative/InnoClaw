"use client";

import { type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Article } from "@/lib/article-search/types";

interface ArticleCardProps {
  article: Article;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (article: Article) => void;
  onCheckChange: (article: Article, checked: boolean) => void;
}

export function ArticleCard({
  article,
  isSelected,
  isChecked,
  onSelect,
  onCheckChange,
}: ArticleCardProps) {
  const t = useTranslations("paperStudy");

  const truncatedAuthors =
    article.authors.length > 3
      ? article.authors.slice(0, 3).join(", ") + " et al."
      : article.authors.join(", ");

  const truncatedAbstract =
    article.abstract.length > 200
      ? article.abstract.slice(0, 200) + "..."
      : article.abstract;

  const date = article.publishedDate
    ? new Date(article.publishedDate).toLocaleDateString()
    : "";

  const pdfUrl =
    article.pdfUrl ||
    (article.source === "arxiv"
      ? article.url.replace("/abs/", "/pdf/")
      : null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(article);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/50 ${
        isSelected ? "border-primary bg-accent/30" : "border-border"
      }`}
      onClick={() => onSelect(article)}
      onKeyDown={handleKeyDown}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Checkbox
            checked={isChecked}
            onCheckedChange={(checked) => {
              onCheckChange(article, !!checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 shrink-0"
          />
          <h4 className="text-sm font-medium leading-tight">{article.title}</h4>
        </div>
        <div className="flex shrink-0 gap-1">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              title={t("downloadPdf")}
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
            title={t("openArticle")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="mb-1 ml-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0"
        >
          {article.source === "arxiv" ? t("sourceArxiv") : t("sourceHuggingFace")}
        </Badge>
        {date && <span>{date}</span>}
      </div>

      {truncatedAuthors && (
        <p className="mb-1 ml-6 text-xs text-muted-foreground">{truncatedAuthors}</p>
      )}

      <p className="ml-6 text-xs text-muted-foreground/80 leading-relaxed">
        {truncatedAbstract}
      </p>
    </div>
  );
}
