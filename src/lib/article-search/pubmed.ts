import type { Article, SearchParams } from "./types";

const PUBMED_ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_FETCH_IDS = 40;

type PubMedBackedSource = "pubmed" | "pubchem";

interface PubMedSearchResponse {
  esearchresult?: {
    idlist?: string[];
  };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function cleanXmlText(value: string): string {
  return decodeXmlEntities(stripTags(value)).replace(/\s+/g, " ").trim();
}

function extractFirst(entry: string, regex: RegExp): string {
  const match = entry.match(regex);
  return match ? cleanXmlText(match[1]) : "";
}

function extractArticleId(entry: string, idType: string): string {
  const regex = new RegExp(
    `<ArticleId[^>]*IdType="${idType}"[^>]*>([\\s\\S]*?)</ArticleId>`,
    "i",
  );
  return extractFirst(entry, regex);
}

function buildPubMedQuery(keywords: string[]): string {
  return keywords
    .map((keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) return "";
      const escaped = trimmed.includes(" ") ? `"${trimmed}"` : trimmed;
      return `${escaped}[Title/Abstract]`;
    })
    .filter(Boolean)
    .join(" AND ");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": "notebooklm-paper-study/1.0",
      Accept: "application/json, text/xml;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function parseMonth(value: string): number {
  const normalized = value.trim().toLowerCase();
  const monthMap: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  return monthMap[normalized] ?? (Number(normalized) || 1);
}

function buildIsoDateFromBlock(block: string): string {
  const year = extractFirst(block, /<Year>([\s\S]*?)<\/Year>/i);
  if (!year) return "";

  const month = parseMonth(extractFirst(block, /<Month>([\s\S]*?)<\/Month>/i) || "1");
  const day = Number(extractFirst(block, /<Day>([\s\S]*?)<\/Day>/i) || "1");

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractPublishedDate(entry: string): string {
  const articleDateMatch = entry.match(/<ArticleDate\b[\s\S]*?<\/ArticleDate>/i);
  if (articleDateMatch) {
    const articleDate = buildIsoDateFromBlock(articleDateMatch[0]);
    if (articleDate) return articleDate;
  }

  const pubDateMatch = entry.match(/<PubDate>([\s\S]*?)<\/PubDate>/i);
  if (pubDateMatch) {
    const pubDate = buildIsoDateFromBlock(pubDateMatch[1]);
    if (pubDate) return pubDate;

    const medlineDate = cleanXmlText(
      extractFirst(pubDateMatch[1], /<MedlineDate>([\s\S]*?)<\/MedlineDate>/i),
    );
    const yearMatch = medlineDate.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      return `${yearMatch[0]}-01-01`;
    }
  }

  return "";
}

function extractAuthors(entry: string): string[] {
  const matches = entry.match(/<Author\b[\s\S]*?<\/Author>/gi) ?? [];
  return matches
    .map((authorBlock) => {
      const collectiveName = extractFirst(
        authorBlock,
        /<CollectiveName>([\s\S]*?)<\/CollectiveName>/i,
      );
      if (collectiveName) return collectiveName;

      const lastName = extractFirst(authorBlock, /<LastName>([\s\S]*?)<\/LastName>/i);
      const foreName = extractFirst(authorBlock, /<ForeName>([\s\S]*?)<\/ForeName>/i);
      const initials = extractFirst(authorBlock, /<Initials>([\s\S]*?)<\/Initials>/i);
      const given = foreName || initials;
      return [given, lastName].filter(Boolean).join(" ").trim();
    })
    .filter(Boolean);
}

function extractAbstract(entry: string): string {
  const matches = Array.from(entry.matchAll(/<AbstractText\b([^>]*)>([\s\S]*?)<\/AbstractText>/gi));
  if (matches.length === 0) return "";

  return matches
    .map(([, attrs, body]) => {
      const labelMatch = attrs.match(/Label="([^"]+)"/i);
      const text = cleanXmlText(body);
      if (!text) return "";
      return labelMatch ? `${cleanXmlText(labelMatch[1])}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n\n");
}

function parsePubMedXml(xml: string, source: PubMedBackedSource): Article[] {
  const entries = xml.match(/<PubmedArticle\b[\s\S]*?<\/PubmedArticle>/gi) ?? [];
  const articles: Article[] = [];

  for (const entry of entries) {
    const pmid = extractFirst(entry, /<PMID\b[^>]*>([\s\S]*?)<\/PMID>/i);
    const title = extractFirst(entry, /<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/i);

    if (!pmid || !title) {
      continue;
    }

    const pmcid = extractArticleId(entry, "pmc");
    const article: Article = {
      id: pmid,
      title,
      authors: extractAuthors(entry),
      abstract: extractAbstract(entry),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      publishedDate: extractPublishedDate(entry),
      source,
    };

    if (pmcid) {
      article.pdfUrl = `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/pdf`;
    }

    articles.push(article);
  }

  return articles;
}

function filterArticlesByDate(
  articles: Article[],
  dateFrom?: string,
  dateTo?: string,
): Article[] {
  return articles.filter((article) => {
    const publishedTime = article.publishedDate ? new Date(article.publishedDate).getTime() : NaN;
    if (Number.isNaN(publishedTime)) return true;
    if (dateFrom && publishedTime < new Date(dateFrom).getTime()) return false;
    if (dateTo && publishedTime > new Date(dateTo).getTime()) return false;
    return true;
  });
}

export async function fetchPubMedArticlesByIds(
  ids: string[],
  source: PubMedBackedSource = "pubmed",
): Promise<Article[]> {
  const dedupedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_FETCH_IDS);
  if (dedupedIds.length === 0) return [];

  const url = new URL(PUBMED_EFETCH_URL);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", dedupedIds.join(","));
  url.searchParams.set("retmode", "xml");

  const res = await fetchWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`PubMed API error: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  return parsePubMedXml(xml, source);
}

export async function searchPubMed(params: SearchParams): Promise<Article[]> {
  const { keywords, maxResults = 10, dateFrom, dateTo } = params;

  if (keywords.length === 0) return [];

  const query = buildPubMedQuery(keywords);
  if (!query) return [];

  const url = new URL(PUBMED_ESEARCH_URL);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("retmode", "json");
  url.searchParams.set("retmax", String(Math.min(Math.max(maxResults * 3, maxResults), MAX_FETCH_IDS)));
  url.searchParams.set("sort", "pub date");
  url.searchParams.set("term", query);

  if (dateFrom) {
    url.searchParams.set("datetype", "pdat");
    url.searchParams.set("mindate", dateFrom);
  }

  if (dateTo) {
    url.searchParams.set("datetype", "pdat");
    url.searchParams.set("maxdate", dateTo);
  }

  const res = await fetchWithTimeout(url.toString());
  if (!res.ok) {
    throw new Error(`PubMed API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as PubMedSearchResponse;
  const ids = data.esearchresult?.idlist ?? [];

  if (ids.length === 0) {
    return [];
  }

  const articles = await fetchPubMedArticlesByIds(ids, "pubmed");
  return filterArticlesByDate(articles, dateFrom, dateTo).slice(0, maxResults);
}
