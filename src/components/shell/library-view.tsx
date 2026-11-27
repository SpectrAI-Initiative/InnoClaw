"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2, Search as SearchIcon, FileText, X, ExternalLink, Sparkles,
  BookOpen, MessageSquareText, Download, Maximize2, ChevronsUpDown,
} from "lucide-react";
import { SEARCHABLE_ARTICLE_SOURCES, type Article, type SearchResult } from "@/lib/article-search/types";
import { useStorageScope, scopeKey } from "@/lib/hooks/use-storage-scope";

type LoadState = "idle" | "loading" | "error" | "ready";
type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; text: string }
  | { status: "error"; message: string; fallback: string };
type Insight = { heading: string; text?: string; bullets?: string[] };
type GenTurn = { stageId?: string; roleId?: string; content?: string; error?: boolean };
type GenState = { status: "idle" | "loading" | "done" | "error"; turns: GenTurn[]; error?: string };
/* 后端若在 Article 上补充结构化解读字段，这里会自动展示；没有则不渲染，不虚构内容。 */
type LibraryArticle = Article & { aiInsights?: Insight[] };

/* 文献库搜索会话本地持久化：刷新后保留上次的检索结果与检索条件 */
const LIBRARY_SEARCH_STORAGE_KEY = "innoscale:library-search-v1";
type PersistedLibrarySearch = {
  mode: "kw" | "title";
  query: string;
  nlQuery: string;
  activeTags: string[];
  sources: string[];
  dateFrom: string;
  dateTo: string;
  state: LoadState;
  articles: LibraryArticle[];
  error: string;
};

/* AI 总结独立持久化：切换 tab 导致组件卸载后仍能恢复进度与结果，直到用户手动清除。 */
const LIBRARY_SUMMARY_STORAGE_KEY = "innoscale:library-summary-v1";
type PersistedLibrarySummary = {
  summary: SummaryState;
  selected: string[];
  expanded: boolean;
};

const QUICK_TAGS = ["LLM", "transformer", "diffusion", "reinforcement learning", "multimodal", "RAG", "agent", "fine-tuning"];
/* 来源显示名对齐参考 demo：内部仍用 slug 调 API */
const SOURCE_LABELS: Record<string, string> = {
  arxiv: "arXiv",
  huggingface: "HuggingFace",
  "semantic-scholar": "Semantic Scholar",
  biorxiv: "bioRxiv",
  pubmed: "PubMed",
  pubchem: "PubChem",
};

const formatGenText = (text = "") =>
  text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/gm, "• ")
    .trim();

/* 标题模式严格过滤：
   后端多源聚合是 OR 语义，搜整句标题会返回大量只沾一两个词的文献。
   这里要求标题必须包含查询里的全部实词（忽略常见英文虚词），
   才保留，确保"标题搜索"只显示真正匹配的文献。 */
const TITLE_STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "for", "and", "or", "to", "with",
  "by", "from", "at", "as", "is", "are", "was", "were", "be", "been",
  "into", "via", "using", "towards", "toward", "effects", "effect",
]);
function significantWords(text: string): string[] {
  return Array.from(new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 1 && !TITLE_STOP_WORDS.has(w))
      .map((w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w)),
  ));
}
function filterArticlesByTitle(articles: LibraryArticle[], queryText: string): LibraryArticle[] {
  const words = significantWords(queryText);
  if (words.length === 0) return articles;
  return articles.filter((article) => {
    const titleWords = new Set(significantWords(article.title ?? ""));
    // 查询中的每个实词，标题里都要有（含简单复数归一）
    return words.every((w) => titleWords.has(w) || titleWords.has(`${w}s`));
  });
}

function SearchProgress({ sources }: { sources: string[] }) {
  const t = useTranslations("shell");
  const [elapsed, setElapsed] = useState(0);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
      setActive((c) => (sources.length === 0 ? 0 : (c + 1) % sources.length));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sources]);
  const source = sources[active] ?? sources[0];
  return (
    <div role="status" aria-live="polite" className="ps-progress">
      <Loader2 className="ps-spin-lg" />
      <p className="ps-progress-t">{t("searching")}</p>
      <p className="ps-progress-s">{t("searchWait", { seconds: elapsed })}</p>
      {source && <p className="ps-progress-src">{t("searchSource", { source })}</p>}
      <div className="ps-progress-bar"><i /></div>
    </div>
  );
}

export function LibraryView() {
  const t = useTranslations("shell");
  const { scope: storageScope, ready: scopeReady } = useStorageScope();
  const scopePrefix = storageScope ?? "anonymous";
  const searchKey = scopeKey(scopePrefix, LIBRARY_SEARCH_STORAGE_KEY);
  const summaryKey = scopeKey(scopePrefix, LIBRARY_SUMMARY_STORAGE_KEY);
  const [mode, setMode] = useState<"kw" | "title">("title");
  const [query, setQuery] = useState("");
  const [nlQuery, setNlQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([...SEARCHABLE_ARTICLE_SOURCES]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [state, setState] = useState<LoadState>("idle");
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<"abstract" | "idea" | "talk">("abstract");
  const [summary, setSummary] = useState<SummaryState>({ status: "idle" });
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [ideaSeed, setIdeaSeed] = useState("");
  const [talkSeed, setTalkSeed] = useState("");
  const [ideaState, setIdeaState] = useState<GenState>({ status: "idle", turns: [] });
  const [talkState, setTalkState] = useState<GenState>({ status: "idle", turns: [] });
  const genAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const resumeSummaryRef = useRef(false);
  const runSummaryRef = useRef<() => void>(() => {});

  // 首帧从当前账号的 localStorage 恢复检索结果与条件；账号变化时重置为空，
  // 防止 A 账号的文献记录出现在 B 账号。loading 中途刷新回退为 idle/ready，避免永久转圈。
  useEffect(() => {
    if (!scopeReady) return;
    setHydrated(false);
    // 先重置为初始态，避免新账号残留旧账号的条件/结果/选中项
    setMode("title");
    setQuery("");
    setNlQuery("");
    setActiveTags([]);
    setSources([...SEARCHABLE_ARTICLE_SOURCES]);
    setDateFrom("");
    setDateTo("");
    setArticles([]);
    setState("idle");
    setError("");
    setSelected([]);
    setOpenId(null);
    setSummary({ status: "idle" });
    setSummaryExpanded(false);
    resumeSummaryRef.current = false;
    try {
      const raw = window.localStorage.getItem(searchKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedLibrarySearch>;
        if (saved.mode === "kw" || saved.mode === "title") setMode(saved.mode);
        if (typeof saved.query === "string") setQuery(saved.query);
        if (typeof saved.nlQuery === "string") setNlQuery(saved.nlQuery);
        if (Array.isArray(saved.activeTags)) setActiveTags(saved.activeTags);
        if (Array.isArray(saved.sources) && saved.sources.length > 0) setSources(saved.sources);
        if (typeof saved.dateFrom === "string") setDateFrom(saved.dateFrom);
        if (typeof saved.dateTo === "string") setDateTo(saved.dateTo);
        if (Array.isArray(saved.articles)) {
          setArticles(saved.articles);
          setState(saved.state === "loading" ? (saved.articles.length > 0 ? "ready" : "idle") : (saved.state ?? "idle"));
        }
        if (typeof saved.error === "string") setError(saved.error);
      }
      // 恢复 AI 总结：结果与进度跨 tab 切换保留，直到用户手动清除。
      const sRaw = window.localStorage.getItem(summaryKey);
      if (sRaw) {
        const s = JSON.parse(sRaw) as Partial<PersistedLibrarySummary>;
        if (Array.isArray(s.selected)) setSelected(s.selected);
        if (typeof s.expanded === "boolean") setSummaryExpanded(s.expanded);
        if (s.summary && typeof s.summary === "object") {
          const st = s.summary;
          if (st.status === "loading") {
            // 请求随组件卸载已中断：恢复为 loading 并在挂载后自动重跑，避免永久转圈。
            resumeSummaryRef.current = true;
            setSummary({ status: "loading" });
          } else {
            setSummary(st);
          }
        }
      }
    } catch {
      // 缓存损坏则忽略，保持默认空态
    }
    setHydrated(true);
  }, [scopeReady, searchKey, summaryKey]);

  // hydrated 之后才写入，避免首帧默认值覆盖尚未恢复的缓存。
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedLibrarySearch = {
        mode, query, nlQuery, activeTags, sources, dateFrom, dateTo, state, articles, error,
      };
      window.localStorage.setItem(searchKey, JSON.stringify(payload));
    } catch {
      // localStorage 不可用或超出配额时静默失败，不影响功能
    }
  }, [hydrated, searchKey, mode, query, nlQuery, activeTags, sources, dateFrom, dateTo, state, articles, error]);

  // AI 总结独立持久化：切 tab 卸载后恢复进度与结果，直到用户点关闭/清空才删除。
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (summary.status === "idle") {
        window.localStorage.removeItem(summaryKey);
        return;
      }
      const payload: PersistedLibrarySummary = { summary, selected, expanded: summaryExpanded };
      window.localStorage.setItem(summaryKey, JSON.stringify(payload));
    } catch {
      // 忽略存储异常
    }
  }, [hydrated, summaryKey, summary, selected, summaryExpanded]);

  const articleKey = (a: Article) => `${a.source}-${a.id}`;

  const search = async (event?: FormEvent, explicitKeywords?: string[]) => {
    event?.preventDefault();
    // 普通搜索/“添加”后点“搜索”时使用；AI 搜索会把扩展后的词作为 explicitKeywords 传入
    const keywords = (explicitKeywords ?? [...(query.trim() || nlQuery.trim()).split(/\s+/), ...activeTags])
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setState("loading");
    setError("");
    setOpenId(null);
    setSelected([]);
    setSummary({ status: "idle" });
    setSummaryExpanded(false);
    try {
      const res = await fetch("/api/paper-study/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          sources,
          mode,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : t("searchFailed"));
      }
      const data = (await res.json()) as SearchResult;
      let list = (Array.isArray(data.articles) ? data.articles : []) as LibraryArticle[];
      // 标题模式（手动输入标题查找）：只保留标题真正包含查询实词的结果，
      // 剔除只沾边一两个词的不相关文献。AI 搜索传 explicitKeywords（语义扩展词），
      // 属于语义匹配，不做严格标题过滤。
      if (mode === "title" && !explicitKeywords) {
        list = filterArticlesByTitle(list, query.trim());
      }
      setArticles(list);
      setState("ready");
    } catch (err) {
      if (controller.signal.aborted) return;
      setArticles([]);
      setState("error");
      setError(err instanceof Error ? err.message : t("searchFailed"));
    } finally {
      if (searchAbortRef.current === controller) searchAbortRef.current = null;
    }
  };

  // “清空”：恢复所有检索条件与结果为初始状态，并同步清理 localStorage 持久化。
  const clearAll = () => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    genAbortRef.current?.abort();
    genAbortRef.current = null;
    setQuery("");
    setNlQuery("");
    setActiveTags([]);
    setSources([...SEARCHABLE_ARTICLE_SOURCES]);
    setDateFrom("");
    setDateTo("");
    setArticles([]);
    setSelected([]);
    setOpenId(null);
    setSummary({ status: "idle" });
    setSummaryExpanded(false);
    setIdeaSeed("");
    setTalkSeed("");
    setIdeaState({ status: "idle", turns: [] });
    setTalkState({ status: "idle", turns: [] });
    setError("");
    setState("idle");
  };

  // “+ 添加”：只把自然语言输入框里的词加成一个蓝色标签，不触发检索。
  const addNlTag = () => {
    const value = nlQuery.trim();
    if (!value) return;
    setActiveTags((cur) => (cur.includes(value) ? cur : [...cur, value]));
    setNlQuery("");
  };

  // “AI 搜索”：先用模型把自然语言问题扩展为优化搜索词，展示到标签栏，再开始检索。
  // 真实数据优先——扩展接口调用失败时退回用原问题作为关键词，保证检索依然可用。
  const aiSearch = async () => {
    const question = nlQuery.trim();
    if (!question && activeTags.length === 0) return;
    setState("loading");
    setError("");
    setOpenId(null);
    setSelected([]);
    setSummary({ status: "idle" });
    setSummaryExpanded(false);
    let expanded: string[] = [];
    if (question) {
      try {
        const res = await fetch("/api/paper-study/expand-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          keywords?: string[];
          error?: string;
        };
        if (!res.ok || !Array.isArray(data.keywords) || data.keywords.length === 0) {
          throw new Error(data.error || t("searchFailed"));
        }
        expanded = data.keywords.map((k) => k.trim()).filter(Boolean);
      } catch {
        // 接口调不通：兜底用原问题作为关键词，不虚构 AI 结果
        expanded = [question];
      }
    }
    const mergedTags = Array.from(new Set([...activeTags, ...expanded]));
    const keywords = mergedTags.length > 0 ? mergedTags : [question];
    setActiveTags(mergedTags);
    setNlQuery("");
    setState("idle");
    await search(undefined, keywords);
  };

  const toggleSource = (source: string) =>
    setSources((cur) => (cur.includes(source) ? cur.filter((i) => i !== source) : [...cur, source]));

  const toggleTag = (tag: string) =>
    setActiveTags((cur) => (cur.includes(tag) ? cur.filter((i) => i !== tag) : [...cur, tag]));

  const toggleSelected = (key: string) =>
    setSelected((cur) => (cur.includes(key) ? cur.filter((i) => i !== key) : [...cur, key]));

  const allSelected = articles.length > 0 && selected.length === articles.length;
  const toggleAll = () => setSelected(allSelected ? [] : articles.map(articleKey));

  const openArticle = (article: LibraryArticle) => {
    setOpenId(article.id);
    setTab("abstract");
  };

  const runSummary = async () => {
    if (selected.length === 0) {
      setSummary({ status: "error", message: "请先勾选要总结的文献", fallback: "" });
      return;
    }
    const chosen = articles.filter((article) => selected.includes(articleKey(article)));
    setSummaryExpanded(false);
    setSummary({ status: "loading" });
    try {
      const res = await fetch("/api/paper-study/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: chosen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "总结失败");
      if (typeof data.summary !== "string" || !data.summary.trim()) throw new Error("后端未返回总结内容");
      setSummary({ status: "done", text: data.summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : "总结失败";
      const fallback = chosen.map((article, i) => {
        const abstract = (article.abstract || "").split(/[。！？.!?]/)[0].trim();
        return `${i + 1}. ${article.title}${abstract ? ` — ${abstract.slice(0, 160)}` : ""}`;
      }).join("\n");
      setSummary({ status: "error", message, fallback });
    }
  };

  // 保持 ref 指向最新 runSummary，供“loading 中途切走再回来”自动重跑使用。
  runSummaryRef.current = runSummary;
  useEffect(() => {
    if (!hydrated || !resumeSummaryRef.current) return;
    if (articles.length === 0 || selected.length === 0) return;
    resumeSummaryRef.current = false;
    void runSummaryRef.current();
  }, [hydrated, articles, selected]);

  const current = articles.find((a) => a.id === openId) ?? null;

  const stopGeneration = () => genAbortRef.current?.abort();

  const runGeneration = async (kind: "idea" | "talk") => {
    if (!current) return;
    const setState = kind === "idea" ? setIdeaState : setTalkState;
    setState({ status: "loading", turns: [] });
    const controller = new AbortController();
    genAbortRef.current = controller;
    const endpoint = kind === "idea" ? "ideate" : "discuss";
    try {
      const res = await fetch(`/api/paper-study/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: current,
          mode: "quick",
          locale: "zh-CN",
          ...(kind === "idea" && ideaSeed.trim() ? { userSeed: ideaSeed.trim() } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("后端未返回内容流");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const turns: GenTurn[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as GenTurn & { type?: string };
            if (parsed.type === "paper_pages") continue;
            turns.push(parsed);
            setState({ status: "loading", turns: [...turns] });
          } catch {
            // 忽略非法行
          }
        }
      }
      setState({ status: "done", turns });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState({ status: "error", turns: [], error: (err as Error).message || "生成失败" });
      } else {
        setState({ status: "idle", turns: [] });
      }
    } finally {
      genAbortRef.current = null;
    }
  };

  return (
    <div className={`ps-app${current ? " ps-detail-on" : ""}`}>
      {/* 主区：检索 + 结果列表 */}
      <div className="ps-main">
        <div className="home">
          <div className="wrap">
            <form onSubmit={search} className="ps-searchwrap">
              <div className="ps-scard" data-mode={mode}>
                <div className="ps-row1">
                  <div className="ps-seg" role="group" aria-label="检索字段">
                    <button type="button" className={`ps-segb${mode === "kw" ? " ps-on" : ""}`} onClick={() => setMode("kw")}>关键词</button>
                    <button type="button" className={`ps-segb${mode === "title" ? " ps-on" : ""}`} onClick={() => setMode("title")}>标题</button>
                  </div>
                </div>
                {/* 标题模式：标题输入框 + 查找（对齐参考 demo 的简洁首屏） */}
                <div className="ps-titleblock">
                  <div className="ps-titlewrap">
                    <FileText />
                    <input className="ps-in" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入论文标题查找…" aria-label="论文标题" />
                  </div>
                  <button className="ps-btn" type="submit" disabled={state === "loading"}><SearchIcon />查找</button>
                </div>

                {/* 高级检索：与检索框同属一张卡片，行内紧凑对齐（参考文件 v12） */}
                <div className="ps-more" data-mode={mode}>
                  <div className="ps-daterow">
                    <span className="ps-lbl">开始日期</span>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={state === "loading"} aria-label="起始日期" />
                    <span>—</span>
                    <span className="ps-lbl">结束日期</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={state === "loading"} aria-label="结束日期" />
                    <button type="button" className="ps-nodate" onClick={() => { setDateFrom(""); setDateTo(""); }}>不限日期</button>
                  </div>

                  <div className="ps-nlrow">
                    <input value={nlQuery} onChange={(e) => setNlQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNlTag(); } }} placeholder="使用自然语言提问，例如「锂电池在低温下的衰减机制」" aria-label="自然语言提问" />
                    <button type="button" onClick={addNlTag}>+ 添加</button>
                  </div>

                  {activeTags.length > 0 && (
                    <div className="ps-tagbar" aria-label="已选标签">
                      {activeTags.map((tag) => (
                        <span key={tag} className="ps-tagchip">
                          {tag}
                          <button type="button" aria-label={`移除 ${tag}`} onClick={() => toggleTag(tag)}><X /></button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="ps-quickrow">
                    <span className="ps-lbl ps-lblq">快速标签：</span>
                    {QUICK_TAGS.map((tag) => (
                      <button key={tag} type="button" className={`qk${activeTags.includes(tag) ? " on" : ""}`} aria-pressed={activeTags.includes(tag)} onClick={() => toggleTag(tag)}>{tag}</button>
                    ))}
                  </div>

                  <div className="ps-srcrow">
                    {SEARCHABLE_ARTICLE_SOURCES.map((source) => (
                      <button
                        key={source}
                        type="button"
                        className={`ps-srcchip${sources.includes(source) ? "" : " off"}`}
                        disabled={state === "loading"}
                        onClick={() => toggleSource(source)}
                      >
                        {SOURCE_LABELS[source] ?? source}
                      </button>
                    ))}
                    <span className="ps-sp" />
                    <button type="button" className="ps-clearbtn" onClick={clearAll}>清空</button>
                    <button type="button" className="ps-aibtn" disabled={state === "loading"} onClick={() => void aiSearch()}><Sparkles /> AI 搜索</button>
                    <button type="button" className="ps-gobtn" disabled={state === "loading"} onClick={() => void search()}>
                      <SearchIcon />搜索
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="ps-rhead">
              <span>{state === "ready" ? `找到 ${articles.length} 篇论文` : "检索结果"}</span>
              <span className="ps-sp" />
              <label className="ps-allwrap"><input type="checkbox" className="ps-check" checked={allSelected} onChange={toggleAll} disabled={articles.length === 0} /><span>全选</span></label>
              <button type="button" className="ps-sumbtn" disabled={summary.status === "loading"} onClick={() => void runSummary()}>
                {summary.status === "loading" ? <Loader2 className="ps-spin-inline" /> : <Sparkles />}
                {summary.status === "loading" ? "总结中…" : `总结 (${selected.length})`}
              </button>
            </div>

            {summary.status !== "idle" && (
              <div className={`ps-summary-panel ps-summary-${summary.status}${summaryExpanded ? " ps-summary-expanded" : ""}`}>
                <div className="ps-summary-hd">
                  <span className="ps-summary-ttl">
                    {summary.status === "loading" ? "正在总结所选文献，请稍候" : summary.status === "error" ? "总结未完成" : "AI 总结"}
                  </span>
                  <div className="ps-summary-acts">
                    <button
                      type="button"
                      className="ps-summary-toggle"
                      aria-expanded={summaryExpanded}
                      onClick={() => setSummaryExpanded((v) => !v)}
                    >
                      <ChevronsUpDown />{summaryExpanded ? "收起" : "展开"}
                    </button>
                    <button type="button" className="ps-summary-close" aria-label="关闭总结" onClick={() => setSummary({ status: "idle" })}><X /></button>
                  </div>
                </div>
                {summary.status === "done" && <div className="ps-summary-text">{summary.text}</div>}
                {summary.status === "error" && (
                  <>
                    <p className="ps-summary-err">{summary.message}</p>
                    {summary.fallback && (
                      <div className="ps-summary-fallback">
                        <b>本地摘录（非 AI 生成）：</b>
                        <pre>{summary.fallback}</pre>
                      </div>
                    )}
                    <button type="button" className="ps-summary-retry" onClick={() => void runSummary()}>重试</button>
                  </>
                )}
              </div>
            )}

            <div className="ps-list">
              {state === "loading" && <SearchProgress sources={sources} />}
              {state === "error" && <p className="ps-empty">{error}</p>}
              {state === "idle" && <p className="ps-empty">{mode === "kw" ? "输入关键词后，检索相关文献。" : "输入论文标题，检索相关文献。"}</p>}
              {state === "ready" && articles.length === 0 && <p className="ps-empty">{t("searchEmpty")}</p>}
              {state === "ready" && articles.map((article, i) => {
                const key = articleKey(article);
                return (
                  <article key={key} className={`ps-paper${openId === article.id ? " ps-open" : ""}`} onClick={() => openArticle(article)}>
                    <div className="ps-prow">
                      <input
                        type="checkbox"
                        className="ps-check"
                        checked={selected.includes(key)}
                        onChange={() => toggleSelected(key)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`选择 ${article.title}`}
                      />
                      <span className="ps-num">{i + 1}.</span>
                      <div className="ps-grow">
                        <div className="ps-pt">{article.title}</div>
                        <div className="ps-pmeta">
                          <b>{SOURCE_LABELS[article.source] ?? article.source}</b>
                          <span>Published {article.publishedDate?.slice(0, 10)}</span>
                          {article.authors?.length > 0 && <span>{article.authors.slice(0, 3).join(", ")}{article.authors.length > 3 ? " et al." : ""}</span>}
                        </div>
                        <div className="ps-pa">{article.abstract || "（该来源未提供摘要）"}</div>
                      </div>
                      <div className="ps-pacts">
                        <Download aria-label="下载" />
                        <Maximize2 aria-label="展开" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="ps-lnote">检索结果来自 PubMed / arXiv / Crossref 等公开数据源 · 引用数仅供排序参考</div>
          </div>
        </div>
      </div>

      {/* 右侧详情栏 —— 摘要 / 研究构思 / 讨论 三 tab + 结构化解读 */}
      {current && (
        <aside className="ps-side">
          <div className="ps-shd">
            <span className="ps-sbar" aria-hidden="true" />
            <h3>{current.title}</h3>
            <button className="ps-x" type="button" aria-label="关闭" onClick={() => setOpenId(null)}><X /></button>
          </div>
          <div className="ps-tabs" role="tablist">
            <button className={`ps-tab${tab === "abstract" ? " ps-on" : ""}`} type="button" role="tab" aria-selected={tab === "abstract"} onClick={() => setTab("abstract")}><FileText className="ps-ti" />摘要</button>
            <button className={`ps-tab${tab === "idea" ? " ps-on" : ""}`} type="button" role="tab" aria-selected={tab === "idea"} onClick={() => setTab("idea")}><Sparkles className="ps-ti" />研究构思</button>
            <button className={`ps-tab${tab === "talk" ? " ps-on" : ""}`} type="button" role="tab" aria-selected={tab === "talk"} onClick={() => setTab("talk")}><MessageSquareText className="ps-ti" />讨论</button>
          </div>
          <div className="ps-sbody">
            <div className="ps-pcontent" style={{ display: tab === "abstract" ? "" : "none" }}>
              <div className="ps-abscard">
                <div className="ps-absrc">
                  <span className="ps-src">{current.source}</span>
                  <span className="ps-abdate">发表日期 {current.publishedDate?.slice(0, 10)}</span>
                </div>
                <div className="ps-absau">作者：{current.authors?.join(" · ") || "—"}</div>
                <div className="ps-abslabel">摘要</div>
                <p className="ps-abstext">{current.abstract || "（该来源未提供摘要）"}</p>
                {current.url && <a className="ps-srclink" href={current.url} target="_blank" rel="noreferrer"><ExternalLink />打开原文</a>}
              </div>
              {current.aiInsights && current.aiInsights.length > 0 && (
                <div className="ps-aicard">
                  <div className="ps-aihd"><b>AI 解读与要点</b><span className="ps-aistruct">结构化变更</span></div>
                  <div className="ps-aigrp">
                    {current.aiInsights.map((insight, i) => (
                      <div key={`${insight.heading}-${i}`}>
                        <div className="ps-aih">{insight.heading}</div>
                        {insight.text && <p className="ps-aip">{insight.text}</p>}
                        {insight.bullets && insight.bullets.length > 0 && (
                          <ul className="ps-aiul">{insight.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="ps-pcontent" style={{ display: tab === "idea" ? "" : "none" }}>
              <div className="ps-agidle">
                <BookOpen className="ps-ag-ic" />
                <p className="ps-ag-desc">基于这篇文献，让 Agent 帮你梳理研究构思：<br />空白点 · 可复现性 · 可延展的实验设计</p>
                <textarea className="ps-ag-ta" value={ideaSeed} onChange={(e) => setIdeaSeed(e.target.value)} placeholder="补充你的研究方向与约束，例如：我想在钙钛矿稳定性上做延拓…" />
                <div className="ps-ag-ctl">
                  <button className="ps-ag-go" type="button" disabled={ideaState.status === "loading"} onClick={() => void runGeneration("idea")}>
                    {ideaState.status === "loading" ? "生成中…" : "开始分析"}
                  </button>
                  {ideaState.status === "loading" && <button className="ps-ag-stop" type="button" onClick={stopGeneration}>停止</button>}
                </div>
                <div className="ps-genwrap">
                  {ideaState.status === "error" && <div className="ps-gen-error">{ideaState.error}</div>}
                  {ideaState.status === "loading" && ideaState.turns.length === 0 && <div className="ps-gen-loading">正在连接模型并生成研究构思…</div>}
                  {ideaState.turns.map((turn, i) => (
                    <div className="ps-gen-card" key={`${turn.stageId ?? "turn"}-${i}`}>
                      {turn.stageId && <div className="ps-gen-stage">{turn.stageId}</div>}
                      <div className="ps-gen-text">{formatGenText(turn.content)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="ps-pcontent" style={{ display: tab === "talk" ? "" : "none" }}>
              <div className="ps-agidle">
                <MessageSquareText className="ps-ag-ic" />
                <p className="ps-ag-desc">围绕这篇文献与 Agent 讨论：<br />方法细节 · 数据可靠性 · 与你的课题如何结合</p>
                <textarea className="ps-ag-ta" value={talkSeed} onChange={(e) => setTalkSeed(e.target.value)} placeholder="输入你的问题或讨论方向…" />
                <div className="ps-ag-ctl">
                  <button className="ps-ag-go" type="button" disabled={talkState.status === "loading"} onClick={() => void runGeneration("talk")}>
                    {talkState.status === "loading" ? "生成中…" : (talkState.turns.length > 0 ? "重新生成" : "发送")}
                  </button>
                  {talkState.status === "loading" && <button className="ps-ag-stop" type="button" onClick={stopGeneration}>停止</button>}
                </div>
                <div className="ps-genwrap">
                  {talkState.status === "error" && <div className="ps-gen-error">{talkState.error}</div>}
                  {talkState.status === "loading" && talkState.turns.length === 0 && <div className="ps-gen-loading">正在连接模型并生成讨论…</div>}
                  {talkState.turns.map((turn, i) => (
                    <div className="ps-gen-card" key={`${turn.stageId ?? "turn"}-${i}`}>
                      {turn.stageId && <div className="ps-gen-stage">{turn.stageId}</div>}
                      <div className="ps-gen-text">{formatGenText(turn.content)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
