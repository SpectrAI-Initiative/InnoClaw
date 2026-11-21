import { describe, expect, it, vi } from "vitest";
import type { Article } from "./types";
import {
  buildArxivTitleQuery,
  lookupPapersByTitle,
  mergeAndRankByTitle,
  normalizeTitle,
  titleSimilarity,
} from "./title-lookup";

const TITLE = "The Long and Winding Pore: Tuning Porosity in Templated Nanoporous Carbons";

function article(overrides: Partial<Article>): Article {
  return {
    id: "id",
    title: "Untitled",
    authors: [],
    abstract: "",
    url: "",
    publishedDate: "",
    source: "arxiv",
    ...overrides,
  };
}

describe("normalizeTitle / titleSimilarity", () => {
  it("ignores case, punctuation and diacritics", () => {
    expect(normalizeTitle("  The Long & Winding Pore: Café!  ")).toBe("the long winding pore cafe");
  });

  it("scores an exact match as 1 and partial matches below 1", () => {
    expect(titleSimilarity(TITLE, TITLE.toUpperCase())).toBe(1);
    const partial = titleSimilarity(TITLE, "Tuning porosity of carbons");
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
    expect(titleSimilarity(TITLE, "")).toBe(0);
  });
});

describe("buildArxivTitleQuery", () => {
  it("ANDs significant title words in the title field without punctuation", () => {
    expect(buildArxivTitleQuery("Attention Is All You Need: a test")).toBe(
      "ti:attention AND ti:all AND ti:you AND ti:need AND ti:test"
    );
  });

  it("drops stop words that make arXiv return nothing (and/the/in)", () => {
    expect(buildArxivTitleQuery(TITLE)).toBe(
      "ti:long AND ti:winding AND ti:pore AND ti:tuning AND ti:porosity AND ti:templated AND ti:nanoporous AND ti:carbons"
    );
  });

  it("caps the number of terms and returns empty for blank input", () => {
    const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ");
    expect(buildArxivTitleQuery(long).split(" AND ")).toHaveLength(12);
    expect(buildArxivTitleQuery(" :: ")).toBe("");
  });
});

describe("mergeAndRankByTitle", () => {
  it("puts the exact title first and removes cross-source duplicates", () => {
    const s2 = [
      article({ id: "s2-a", title: "Porous carbon review", source: "semantic-scholar" }),
      article({ id: "2611.24707", title: TITLE, url: "https://arxiv.org/abs/2611.24707", source: "arxiv" }),
    ];
    const arxiv = [
      article({ id: "2611.24707v1", title: TITLE, url: "http://arxiv.org/abs/2611.24707v1" }),
      article({ id: "2601.00001", title: "Templated nanoporous carbons revisited", url: "http://arxiv.org/abs/2601.00001" }),
    ];

    const ranked = mergeAndRankByTitle(TITLE, s2, arxiv);

    expect(ranked.map((a) => a.title)).toEqual([
      TITLE,
      "Templated nanoporous carbons revisited",
      "Porous carbon review",
    ]);
  });
});

describe("lookupPapersByTitle", () => {
  it("still finds the paper when Semantic Scholar is rate limited", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await lookupPapersByTitle(TITLE, {
      searchSemanticScholar: async () => {
        throw new Error("Semantic Scholar rate limited (429)");
      },
      searchArxiv: async () => [article({ id: "2611.24707", title: TITLE })],
    });

    expect(result.articles.map((a) => a.title)).toEqual([TITLE]);
    expect(result.errors).toEqual({ "semantic-scholar": "Semantic Scholar rate limited (429)" });
    expect(result.allSourcesFailed).toBe(false);
  });

  it("reports allSourcesFailed instead of an empty 'not found' when every source errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fail = async () => {
      throw new Error("down");
    };
    const result = await lookupPapersByTitle(TITLE, { searchSemanticScholar: fail, searchArxiv: fail });

    expect(result.articles).toEqual([]);
    expect(result.allSourcesFailed).toBe(true);
  });

  it("returns an empty, non-failed result when sources answer with no matches", async () => {
    const none = async () => [];
    const result = await lookupPapersByTitle(TITLE, { searchSemanticScholar: none, searchArxiv: none });

    expect(result).toEqual({ articles: [], errors: undefined, allSourcesFailed: false });
  });
});
