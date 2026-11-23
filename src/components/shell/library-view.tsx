"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEARCHABLE_ARTICLE_SOURCES, type Article, type SearchResult } from "@/lib/article-search/types";

interface LibraryViewProps {
  onInsertCitation: (text: string) => void;
}

type LoadState = "idle" | "loading" | "error" | "ready";

function SearchProgress({ sources }: { sources: string[] }) {
  const t = useTranslations("shell");
  const [elapsed, setElapsed] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
      setActive((current) => (sources.length === 0 ? 0 : (current + 1) % sources.length));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sources]);

  const source = sources[active] ?? sources[0];

  return (
    <div role="status" aria-live="polite" className="px-1 py-8">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#1B5561]" />
        <p className="mt-3 text-sm font-medium text-[#1e1e1c]">{t("searching")}</p>
        <p className="mt-1 text-[12px] leading-5 text-[#8c8c85]">{t("searchWait", { seconds: elapsed })}</p>
        {source && <p className="mt-2 text-[12px] text-[#1B5561]">{t("searchSource", { source })}</p>}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[#ecece6]">
          <div className="h-full w-1/3 animate-[library-slide_1.2s_ease-in-out_infinite] rounded-full bg-[#1B5561]" />
        </div>
      </div>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="animate-pulse space-y-2">
            <div className="h-3.5 rounded bg-[#ecece6]" style={{ width: `${88 - index * 8}%` }} />
            <div className="h-2.5 w-24 rounded bg-[#f1f1ec]" />
          </div>
        ))}
      </div>
      <style>{`@keyframes library-slide { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }`}</style>
    </div>
  );
}

export function LibraryView({ onInsertCitation }: LibraryViewProps) {
  const t = useTranslations("shell");
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<string[]>([...SEARCHABLE_ARTICLE_SOURCES]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [state, setState] = useState<LoadState>("idle");
  const [articles, setArticles] = useState<Article[]>([]);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    const keywords = query.trim().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return;
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/paper-study/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          sources,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : t("searchFailed"));
      }
      const data = (await res.json()) as SearchResult;
      setArticles(Array.isArray(data.articles) ? data.articles : []);
      setState("ready");
    } catch (err) {
      setArticles([]);
      setState("error");
      setError(err instanceof Error ? err.message : t("searchFailed"));
    }
  };

  const toggleSource = (source: string) => {
    setSources((current) => current.includes(source)
      ? current.filter((item) => item !== source)
      : [...current, source]);
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col px-6 py-4">
      <form onSubmit={search} className="flex items-center gap-2 rounded-xl border border-[#e2e2da] bg-white px-3 py-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="sm" disabled={state === "loading" || !query.trim()}>
          {state === "loading" ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("searching")}
            </span>
          ) : t("search")}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SEARCHABLE_ARTICLE_SOURCES.map((source) => {
          const on = sources.includes(source);
          return (
            <button
              key={source}
              type="button"
              onClick={() => toggleSource(source)}
              disabled={state === "loading"}
              className={`rounded-md border px-2 py-1 text-[11px] ${on ? "border-[#d0d0c5] bg-[#f1f1ec] text-[#1e1e1c]" : "border-[#e7e7e8] text-[#8c8c85]"}`}
            >
              {source}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#8c8c85]">
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} disabled={state === "loading"} className="rounded-md border border-[#e7e7e8] px-1 py-0.5 disabled:opacity-60" />
        <span>—</span>
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} disabled={state === "loading"} className="rounded-md border border-[#e7e7e8] px-1 py-0.5 disabled:opacity-60" />
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {state === "loading" && <SearchProgress sources={sources} />}
        {state === "error" && <p className="py-10 text-center text-sm text-red-700">{error}</p>}
        {state === "ready" && articles.length === 0 && <p className="py-10 text-center text-sm text-[#8c8c85]">{t("searchEmpty")}</p>}
        {state === "idle" && <p className="py-10 text-center text-sm text-[#8c8c85]">{t("searchIdle")}</p>}
        {state === "ready" && articles.map((article) => {
          const open = openId === article.id;
          return (
            <article key={`${article.source}-${article.id}`} className="border-b border-[#e7e7e8] py-3">
              <button type="button" className="text-left" onClick={() => setOpenId(open ? null : article.id)}>
                <h3 className="text-[13px] font-medium leading-6">{article.title}</h3>
                <p className="mt-1 text-[11px] text-[#8c8c85]">{article.source} · {article.publishedDate?.slice(0, 10)}</p>
              </button>
              {open && (
                <div className="mt-2 space-y-2">
                  <p className="text-[12px] leading-6 text-[#57574f]">{article.abstract}</p>
                  <div className="flex gap-2">
                    {article.url && (
                      <a className="text-[11px] underline" href={article.url} target="_blank" rel="noreferrer">{t("openSource")}</a>
                    )}
                    <button
                      type="button"
                      className="text-[11px] underline"
                      onClick={() => onInsertCitation(`${article.title}\n${article.url}`)}
                    >
                      {t("insertCitation")}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
