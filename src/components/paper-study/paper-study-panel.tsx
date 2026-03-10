"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, AlertCircle, Sparkles, CheckSquare, Flame } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PaperSearchBar } from "./paper-search-bar";
import { ArticleCard } from "./article-card";
import { PaperSummarySection } from "./paper-summary-section";
import { PaperRoastSection } from "./paper-roast-section";
import type { Article, ArticleSource } from "@/lib/article-search/types";

/** Composite key for identifying an article across sources. */
const articleKey = (a: Article) => `${a.source}-${a.id}`;

interface PaperStudyPanelProps {
  workspaceId: string;
  onArticleSelect: (article: Article | null) => void;
  notesDir?: string;
}

export function PaperStudyPanel({
  workspaceId,
  onArticleSelect,
  notesDir,
}: PaperStudyPanelProps) {
  const t = useTranslations("paperStudy");

  // Search params
  const [keywords, setKeywords] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sources, setSources] = useState<ArticleSource[]>(["arxiv", "huggingface"]);

  // Results
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState("");
  const [searchErrors, setSearchErrors] = useState<Record<string, string> | undefined>();

  // Loading states
  const [isSearching, setIsSearching] = useState(false);
  const [isAISearching, setIsAISearching] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Abort controller for summarization
  const summarizeAbortRef = useRef<AbortController | null>(null);

  // Roast state
  const [roast, setRoast] = useState("");
  const [isRoasting, setIsRoasting] = useState(false);
  const roastAbortRef = useRef<AbortController | null>(null);

  /** Click card → preview in right panel. */
  const handleSelectArticle = useCallback(
    (article: Article) => {
      setSelectedArticle(article);
      onArticleSelect(article);
    },
    [onArticleSelect]
  );

  /** Checkbox toggle → add/remove from checked set. */
  const handleCheckChange = useCallback(
    (article: Article, checked: boolean) => {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        const key = articleKey(article);
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
    },
    []
  );

  /** Select / deselect all articles. */
  const handleToggleAll = useCallback(() => {
    if (checkedIds.size === articles.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(articles.map(articleKey)));
    }
  }, [articles, checkedIds.size]);

  /** Stop ongoing summarization. */
  const handleStopSummarize = useCallback(() => {
    summarizeAbortRef.current?.abort();
    summarizeAbortRef.current = null;
    setIsSummarizing(false);
  }, []);

  /** Summarize checked articles via the API. */
  const handleSummarize = useCallback(async () => {
    const toSummarize = articles.filter(
      (a) => checkedIds.has(articleKey(a))
    );
    if (toSummarize.length === 0) return;

    // Abort any previous summarization
    summarizeAbortRef.current?.abort();
    const controller = new AbortController();
    summarizeAbortRef.current = controller;

    setIsSummarizing(true);
    setSummary("");
    setSearchErrors(undefined);
    try {
      const sumRes = await fetch("/api/paper-study/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: toSummarize }),
        signal: controller.signal,
      });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData.summary || "");
      } else {
        const errData = await sumRes.json().catch(() => ({}));
        setSearchErrors({
          summarize: errData.error || t("summarizeError"),
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      if (summarizeAbortRef.current === controller) {
        summarizeAbortRef.current = null;
      }
      setIsSummarizing(false);
    }
  }, [articles, checkedIds, t]);

  /** Stop ongoing roast generation. */
  const handleStopRoast = useCallback(() => {
    roastAbortRef.current?.abort();
    roastAbortRef.current = null;
    setIsRoasting(false);
  }, []);

  /**
   * Generate sharp review (今日锐评).
   * If articles are already loaded and some are checked, roast checked articles.
   * Otherwise, auto-search today's papers (with keywords if set, or all HF daily papers),
   * then roast all results.
   */
  const handleRoast = useCallback(async () => {
    // Abort any previous roast
    roastAbortRef.current?.abort();
    const controller = new AbortController();
    roastAbortRef.current = controller;

    setIsRoasting(true);
    setRoast("");
    setSearchErrors(undefined);

    try {
      let papersToRoast: Article[];

      // If we have checked articles, use those
      if (checkedIds.size > 0 && articles.length > 0) {
        papersToRoast = articles.filter(
          (a) => checkedIds.has(`${a.source}-${a.id}`)
        );
      } else {
        // Auto-search: use keywords if set, otherwise fetch all HF daily papers
        const today = new Date().toISOString().slice(0, 10);
        const searchRes = await fetch("/api/paper-study/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords: keywords.length > 0 ? keywords : [],
            dateFrom: keywords.length > 0 ? (dateFrom || today) : undefined,
            dateTo: keywords.length > 0 ? (dateTo || today) : undefined,
            sources: keywords.length > 0 ? sources : ["huggingface"],
            maxResults: 20,
          }),
          signal: controller.signal,
        });

        if (!searchRes.ok) {
          const errData = await searchRes.json().catch(() => ({}));
          throw new Error(errData.error || "Search failed");
        }

        const searchResult = await searchRes.json();
        const fetchedArticles: Article[] = searchResult.articles || [];

        // Update the article list in the panel
        setArticles(fetchedArticles);
        setHasSearched(true);
        setCheckedIds(new Set(fetchedArticles.map((a) => `${a.source}-${a.id}`)));
        if (searchResult.errors) setSearchErrors(searchResult.errors);

        papersToRoast = fetchedArticles;
      }

      if (papersToRoast.length === 0) {
        setIsRoasting(false);
        return;
      }

      // Now generate the roast
      const res = await fetch("/api/paper-study/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: papersToRoast }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setRoast(data.roast || "");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSearchErrors({
        roast: err instanceof Error ? err.message : "Roast generation failed",
      });
    } finally {
      if (roastAbortRef.current === controller) {
        roastAbortRef.current = null;
      }
      setIsRoasting(false);
    }
  }, [articles, checkedIds, keywords, dateFrom, dateTo, sources]);

  /** Keyword-based search across arXiv / HuggingFace. */
  const handleSearch = useCallback(async () => {
    if (keywords.length === 0) return;

    setIsSearching(true);
    setArticles([]);
    setSummary("");
    setRoast("");
    setSearchErrors(undefined);
    setHasSearched(true);
    setSelectedArticle(null);
    setCheckedIds(new Set());
    onArticleSelect(null);

    try {
      const res = await fetch("/api/paper-study/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sources,
          maxResults: 10,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Search failed (${res.status})`);
      }

      const result = await res.json();
      const fetchedArticles = result.articles || [];
      setArticles(fetchedArticles);
      setSearchErrors(result.errors);
    } catch (error) {
      setSearchErrors({
        search: error instanceof Error ? error.message : "Search failed",
      });
    } finally {
      setIsSearching(false);
    }
  }, [keywords, dateFrom, dateTo, sources, onArticleSelect]);

  /** AI-powered search: expand keywords via LLM then search all sources. */
  const handleAISearch = useCallback(async (question: string) => {
    if (!question.trim()) return;

    setIsAISearching(true);
    setArticles([]);
    setSummary("");
    setSearchErrors(undefined);
    setHasSearched(true);
    setSelectedArticle(null);
    setCheckedIds(new Set());
    onArticleSelect(null);

    try {
      // Step 1: Expand query via AI
      const expandRes = await fetch("/api/paper-study/expand-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!expandRes.ok) {
        const errData = await expandRes.json().catch(() => ({}));
        throw new Error(errData.error || "Query expansion failed");
      }

      const { keywords: expandedKeywords } = await expandRes.json();

      // Update keywords in the UI so user can see what the AI produced
      setKeywords(expandedKeywords);

      // Step 2: Search all sources with expanded keywords
      const allSources: ArticleSource[] = ["arxiv", "huggingface", "semantic-scholar"];
      setSources(allSources);

      const searchRes = await fetch("/api/paper-study/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: expandedKeywords,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sources: allSources,
          maxResults: 10,
        }),
      });

      if (!searchRes.ok) {
        const data = await searchRes.json().catch(() => ({}));
        throw new Error(data.error || `Search failed (${searchRes.status})`);
      }

      const result = await searchRes.json();
      setArticles(result.articles || []);
      setSearchErrors(result.errors);
    } catch (error) {
      setSearchErrors({
        aiSearch: error instanceof Error ? error.message : "AI search failed",
      });
    } finally {
      setIsAISearching(false);
    }
  }, [dateFrom, dateTo, onArticleSelect]);

  /** Fetch articles by title/URL/ID, show candidates for user to select. */
  const handleFetchTitle = useCallback(async (title: string) => {
    setIsFetching(true);
    setArticles([]);
    setSummary("");
    setRoast("");
    setSearchErrors(undefined);
    setHasSearched(true);
    setSelectedArticle(null);
    setCheckedIds(new Set());
    onArticleSelect(null);

    try {
      const res = await fetch("/api/paper-study/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data.error;
        let msg: string;
        switch (code) {
          case "MISSING_INPUT":
            msg = t("fetchErrorMissingInput");
            break;
          case "NOT_FOUND":
            msg = t("fetchError");
            break;
          default:
            msg = t("fetchError");
            break;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      const fetchedArticles: Article[] = data.articles || [];
      setArticles(fetchedArticles);

      // Auto-select first article for preview when only one result
      if (fetchedArticles.length === 1) {
        setSelectedArticle(fetchedArticles[0]);
        onArticleSelect(fetchedArticles[0]);
        // Also auto-check it
        setCheckedIds(new Set([articleKey(fetchedArticles[0])]));
      }
    } catch (error) {
      setSearchErrors({
        fetch: error instanceof Error ? error.message : t("fetchError"),
      });
    } finally {
      setIsFetching(false);
    }
  }, [onArticleSelect, t]);

  const checkedCount = checkedIds.size;
  const allChecked = articles.length > 0 && checkedCount === articles.length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <GraduationCap className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>

      {/* Search bar */}
      <PaperSearchBar
        keywords={keywords}
        onKeywordsChange={setKeywords}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        sources={sources}
        onSourcesChange={setSources}
        onSearch={handleSearch}
        onAISearch={handleAISearch}
        onFetchTitle={handleFetchTitle}
        isSearching={isSearching}
        isAISearching={isAISearching}
        isFetching={isFetching}
      />

      {/* 今日锐评 — always visible */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <Button
          size="sm"
          variant="destructive"
          onClick={handleRoast}
          disabled={isRoasting}
          className="gap-1.5 text-xs"
        >
          <Flame className="h-3.5 w-3.5" />
          {isRoasting ? t("roasting") : keywords.length > 0
            ? t("roastSelected", { count: checkedIds.size > 0 ? checkedIds.size : "?" })
            : t("roastAll")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {keywords.length > 0
            ? t("roastHintKeywords")
            : t("roastHintAll")}
        </p>
      </div>

      {/* Results area */}
      <ScrollArea className="flex-1">
        {/* Error banner */}
        {searchErrors && (
          <div className="mx-3 mt-2 flex items-center gap-2 rounded border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{t("errors")}: {Object.values(searchErrors).join("; ")}</span>
          </div>
        )}

        {/* Empty state */}
        {!hasSearched && articles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {t("emptyState")}
            </p>
          </div>
        )}

        {/* No results */}
        {hasSearched && !isSearching && !isFetching && articles.length === 0 && !searchErrors && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          </div>
        )}

        {/* Result count + select all + summarize button */}
        {articles.length > 0 && (
          <div className="flex items-center justify-between px-3 pt-2">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {t("results", { count: articles.length })}
              </p>
              <Button
                variant="ghost"
                size="xs"
                onClick={handleToggleAll}
                className="gap-1 text-xs h-6"
              >
                <CheckSquare className="h-3 w-3" />
                {allChecked ? t("deselectAll") : t("selectAll")}
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                onClick={handleSummarize}
                disabled={checkedCount === 0 || isSummarizing}
                className="gap-1 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                {t("summarizeSelected", { count: checkedCount })}
              </Button>
            </div>
          </div>
        )}

        {/* Article cards */}
        {articles.length > 0 && (
          <div className="space-y-2 p-3">
            {articles.map((article) => {
              const key = articleKey(article);
              return (
                <ArticleCard
                  key={key}
                  article={article}
                  isSelected={selectedArticle != null && articleKey(selectedArticle) === key}
                  isChecked={checkedIds.has(key)}
                  onSelect={handleSelectArticle}
                  onCheckChange={handleCheckChange}
                />
              );
            })}
          </div>
        )}

        {/* AI Summary */}
        <PaperSummarySection
          summary={summary}
          isSummarizing={isSummarizing}
          workspaceId={workspaceId}
          notesDir={notesDir}
          onStop={handleStopSummarize}
        />

        {/* Sharp Review (今日锐评) */}
        <PaperRoastSection
          roast={roast}
          isRoasting={isRoasting}
          workspaceId={workspaceId}
          notesDir={notesDir}
          articles={articles}
          onArticleSelect={handleSelectArticle}
          onStop={handleStopRoast}
        />
      </ScrollArea>
    </div>
  );
}
