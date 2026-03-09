"use client";

import { useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Search, X, Loader2, FileText, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArticleSource } from "@/lib/article-search/types";

const PRESET_KEYWORDS = [
  "LLM",
  "transformer",
  "diffusion",
  "reinforcement learning",
  "multimodal",
  "RAG",
  "agent",
  "fine-tuning",
];

interface PaperSearchBarProps {
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  sources: ArticleSource[];
  onSourcesChange: (sources: ArticleSource[]) => void;
  onSearch: () => void;
  onFetchTitle: (title: string) => void;
  isSearching: boolean;
  isFetching: boolean;
}

export function PaperSearchBar({
  keywords,
  onKeywordsChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  sources,
  onSourcesChange,
  onSearch,
  onFetchTitle,
  isSearching,
  isFetching,
}: PaperSearchBarProps) {
  const t = useTranslations("paperStudy");
  const [keywordInput, setKeywordInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (trimmed && !keywords.includes(trimmed)) {
      onKeywordsChange([...keywords, trimmed]);
    }
  };

  const removeKeyword = (kw: string) => {
    onKeywordsChange(keywords.filter((k) => k !== kw));
  };

  const togglePreset = (preset: string) => {
    if (keywords.includes(preset)) {
      removeKeyword(preset);
    } else {
      addKeyword(preset);
    }
  };

  const handleAddKeyword = () => {
    if (keywordInput.trim()) {
      addKeyword(keywordInput);
      setKeywordInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && keywordInput.trim()) {
      e.preventDefault();
      addKeyword(keywordInput);
      setKeywordInput("");
    }
  };

  const handleTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && titleInput.trim()) {
      e.preventDefault();
      onFetchTitle(titleInput.trim());
      setTitleInput("");
    }
  };

  const handleFetchClick = () => {
    if (titleInput.trim()) {
      onFetchTitle(titleInput.trim());
      setTitleInput("");
    }
  };

  const toggleSource = (source: ArticleSource) => {
    if (sources.includes(source)) {
      if (sources.length > 1) {
        onSourcesChange(sources.filter((s) => s !== source));
      }
    } else {
      onSourcesChange([...sources, source]);
    }
  };

  const clearDates = () => {
    onDateFromChange("");
    onDateToChange("");
  };

  return (
    <div className="space-y-2.5 border-b p-3">
      {/* Direct paper title input */}
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          type="text"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder={t("titlePlaceholder")}
          className="h-7 flex-1 text-xs"
        />
        <Button
          size="xs"
          variant="outline"
          onClick={handleFetchClick}
          disabled={isFetching || !titleInput.trim()}
          className="gap-1 text-xs shrink-0"
        >
          {isFetching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Search className="h-3 w-3" />
          )}
          {isFetching ? t("fetching") : t("fetch")}
        </Button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t" />
        <span className="text-[10px] text-muted-foreground">or</span>
        <div className="flex-1 border-t" />
      </div>

      {/* Date row */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground shrink-0">
          {t("dateFrom")}
        </label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-7 w-[130px] text-xs"
        />
        <label className="text-xs font-medium text-muted-foreground shrink-0">
          {t("dateTo")}
        </label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-7 w-[130px] text-xs"
        />
        <Button
          variant="ghost"
          size="xs"
          onClick={clearDates}
          className="text-xs"
        >
          {t("dateAll")}
        </Button>
      </div>

      {/* Keyword input + Add button + active keywords */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="text"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("keywordPlaceholder")}
          className="h-7 w-[200px] text-xs"
        />
        <Button
          variant="outline"
          size="xs"
          onClick={handleAddKeyword}
          disabled={!keywordInput.trim()}
          className="gap-1 text-xs h-7"
        >
          <Plus className="h-3 w-3" />
          {t("addKeyword")}
        </Button>
        {keywords.map((kw) => (
          <Badge
            key={kw}
            variant="default"
            className="gap-1 text-xs cursor-pointer"
            onClick={() => removeKeyword(kw)}
          >
            {kw}
            <X className="h-2.5 w-2.5" />
          </Badge>
        ))}
      </div>

      {/* Preset keywords */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] text-muted-foreground mr-1">
          {t("presetKeywords")}:
        </span>
        {PRESET_KEYWORDS.map((preset) => (
          <Badge
            key={preset}
            variant={keywords.includes(preset) ? "default" : "outline"}
            className="cursor-pointer text-[10px] px-1.5 py-0"
            onClick={() => togglePreset(preset)}
          >
            {preset}
          </Badge>
        ))}
      </div>

      {/* Source toggles + search button */}
      <div className="flex items-center gap-2">
        <Button
          variant={sources.includes("arxiv") ? "default" : "outline"}
          size="xs"
          onClick={() => toggleSource("arxiv")}
          className="text-xs"
        >
          {t("sourceArxiv")}
        </Button>
        <Button
          variant={sources.includes("huggingface") ? "default" : "outline"}
          size="xs"
          onClick={() => toggleSource("huggingface")}
          className="text-xs"
        >
          {t("sourceHuggingFace")}
        </Button>

        <div className="flex-1" />

        <Button
          size="sm"
          onClick={onSearch}
          disabled={isSearching || keywords.length === 0}
          className="gap-1"
        >
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {isSearching ? t("searching") : t("search")}
        </Button>
      </div>
    </div>
  );
}
