import { describe, expect, it } from "vitest";
import type { Article } from "./types";
import { buildQuery } from "./arxiv";
import { rankArticlesByKeywords, scoreArticleForKeywords } from "./index";

function article(title: string, abstract = "", source: Article["source"] = "arxiv"): Article {
  return { id: title, title, abstract, authors: [], url: "", publishedDate: "", source };
}

describe("arXiv buildQuery", () => {
  it("matches keywords in title or abstract instead of all fields", () => {
    expect(buildQuery(["lithium battery"])).toBe(
      "ti:%22lithium%20battery%22+OR+abs:%22lithium%20battery%22"
    );
  });

  it("ORs several keywords inside parentheses", () => {
    expect(buildQuery(["LLM", "agent"])).toBe("(ti:LLM+OR+abs:LLM+OR+ti:agent+OR+abs:agent)");
  });

  it("adds a submittedDate range when dates are given", () => {
    expect(buildQuery(["LLM"], "2026-11-01", "2026-11-19")).toBe(
      "(ti:LLM+OR+abs:LLM)+AND+submittedDate:%5B202611010000+TO+202611192359%5D"
    );
    expect(buildQuery(["LLM", "agent"], undefined, "2026-11-19")).toBe(
      "(ti:LLM+OR+abs:LLM+OR+ti:agent+OR+abs:agent)+AND+submittedDate:%5B199101010000+TO+202611192359%5D"
    );
  });

  it("ignores invalid dates and blank keywords", () => {
    expect(buildQuery([" ", "LLM"], "not-a-date")).toBe("ti:LLM+OR+abs:LLM");
  });
});

describe("rankArticlesByKeywords", () => {
  it("scores title matches above abstract-only matches", () => {
    const kws = ["lithium-ion battery"];
    expect(scoreArticleForKeywords(article("Lithium-ion battery aging"), kws)).toBeGreaterThan(
      scoreArticleForKeywords(article("Bayesian optimization", "applied to a lithium-ion battery"), kws)
    );
  });

  it("puts on-topic papers from later sources ahead of off-topic ones from earlier sources", () => {
    const ranked = rankArticlesByKeywords(
      [
        article("LLM-Assisted Multi-Fidelity Bayesian Optimization", "expert knowledge", "arxiv"),
        article("Laser processing", "mentions a lithium battery once", "arxiv"),
        article("Degradation of lithium-ion battery cathodes", "", "semantic-scholar"),
      ],
      ["lithium-ion battery", "battery degradation"]
    );
    expect(ranked.map((a) => a.title)).toEqual([
      "Degradation of lithium-ion battery cathodes",
      "Laser processing",
      "LLM-Assisted Multi-Fidelity Bayesian Optimization",
    ]);
  });

  it("matches plurals and hyphenated phrases in titles", () => {
    const ranked = rankArticlesByKeywords(
      [
        article("Laser Processing for Energy Applications", "used for a lithium-ion battery and a lithium battery"),
        article("Fast-Charging Control of Lithium-Ion Batteries", ""),
      ],
      ["lithium-ion battery", "lithium battery"]
    );
    expect(ranked[0].title).toBe("Fast-Charging Control of Lithium-Ion Batteries");
  });

  it("does not match keywords inside longer words", () => {
    expect(scoreArticleForKeywords(article("Agentic systems"), ["agent"])).toBe(0);
  });

  it("keeps the original order when there are no keywords", () => {
    const list = [article("B"), article("A")];
    expect(rankArticlesByKeywords(list, [])).toBe(list);
  });
});
