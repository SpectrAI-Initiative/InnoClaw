import type { Article, SearchParams } from "./types";
import { fetchPubMedArticlesByIds } from "./pubmed";

const PUBCHEM_API_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_TERM_LOOKUPS = 6;
const MAX_COMPOUNDS = 20;
const MAX_PMIDS = 40;

interface PubChemCidResponse {
  IdentifierList?: {
    CID?: number[];
  };
}

interface PubChemPubMedResponse {
  InformationList?: {
    Information?: Array<{
      PubMedID?: number[];
    }>;
  };
}

function buildLookupTerms(keywords: string[]): string[] {
  const normalized = keywords.map((keyword) => keyword.trim()).filter(Boolean);
  return [...new Set([normalized.join(" "), ...normalized].filter(Boolean))].slice(0, MAX_TERM_LOOKUPS);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "notebooklm-paper-study/1.0",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`PubChem API error: ${res.status} ${res.statusText}`);
  }

  return await res.json() as T;
}

async function fetchCompoundIdsForTerm(term: string): Promise<number[]> {
  const url = `${PUBCHEM_API_BASE}/compound/name/${encodeURIComponent(term)}/cids/JSON`;
  const data = await fetchJson<PubChemCidResponse>(url);
  return data?.IdentifierList?.CID ?? [];
}

async function fetchPubMedIdsForCompounds(cids: number[]): Promise<string[]> {
  if (cids.length === 0) return [];

  const url = `${PUBCHEM_API_BASE}/compound/cid/${cids.join(",")}/xrefs/PubMedID/JSON`;
  const data = await fetchJson<PubChemPubMedResponse>(url);
  const pmids = data?.InformationList?.Information?.flatMap((item) => item.PubMedID ?? []) ?? [];
  return [...new Set(pmids.map((pmid) => String(pmid)))];
}

function filterArticles(
  articles: Article[],
  keywords: string[],
  dateFrom?: string,
  dateTo?: string,
): Article[] {
  const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());

  return articles.filter((article) => {
    const haystack = `${article.title} ${article.abstract}`.toLowerCase();
    const keywordMatch = lowerKeywords.some((keyword) => haystack.includes(keyword));
    if (!keywordMatch) return false;

    const publishedTime = article.publishedDate ? new Date(article.publishedDate).getTime() : NaN;
    if (Number.isNaN(publishedTime)) return true;
    if (dateFrom && publishedTime < new Date(dateFrom).getTime()) return false;
    if (dateTo && publishedTime > new Date(dateTo).getTime()) return false;
    return true;
  });
}

export async function searchPubChem(params: SearchParams): Promise<Article[]> {
  const { keywords, maxResults = 10, dateFrom, dateTo } = params;

  if (keywords.length === 0) return [];

  const terms = buildLookupTerms(keywords);
  const cidResults = await Promise.all(terms.map((term) => fetchCompoundIdsForTerm(term)));
  const cids = [...new Set(cidResults.flat())].slice(0, MAX_COMPOUNDS);

  if (cids.length === 0) {
    return [];
  }

  const pmids = (await fetchPubMedIdsForCompounds(cids)).slice(0, MAX_PMIDS);
  if (pmids.length === 0) {
    return [];
  }

  const articles = await fetchPubMedArticlesByIds(pmids, "pubchem");
  return filterArticles(articles, keywords, dateFrom, dateTo).slice(0, maxResults);
}
