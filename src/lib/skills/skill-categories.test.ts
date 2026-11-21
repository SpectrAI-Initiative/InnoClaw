import { describe, expect, it } from "vitest";
import { categorizeSkill, filterSkills } from "./skill-categories";

function skill(slug: string, description: string | null = null, name = slug) {
  return { id: slug, slug, name, description };
}

describe("categorizeSkill", () => {
  it.each([
    ["researcher-plan-architect", "workflow"],
    ["pubmed-article-search", "literature"],
    ["toxicity-assessment", "drug"],
    ["pubchem-smiles-search", "chemistry"],
    ["uniprot-protein-retrieval", "protein"],
    ["variant-pathogenicity", "genomics"],
    ["rare-disease-genetics", "clinical"],
    ["wind-site-assessment", "earth"],
    ["unit-conversion-suite", "data"],
  ])("puts %s into %s", (slug, expected) => {
    expect(categorizeSkill(skill(slug))).toBe(expected);
  });

  it("lets the slug outweigh an incidental word in the description", () => {
    // Mentions PubMed in passing but is about virus genomics.
    expect(categorizeSkill(skill("virus-genomics", "Analyze virus genomics using NCBI and PubMed links"))).toBe(
      "genomics"
    );
  });

  it("falls back to other", () => {
    expect(categorizeSkill(skill("hello-world", "says hi"))).toBe("other");
  });
});

describe("filterSkills", () => {
  const skills = [
    skill("virtual-screening", "Search PubChem by substructure", "virtual_screening"),
    skill("wind-site-assessment", "Assess wind energy potential"),
    skill("variant-pathogenicity", "Assess variant pathogenicity"),
  ];

  it("matches every query word across name, slug and description", () => {
    expect(filterSkills(skills, { query: "assess wind" }).map((s) => s.slug)).toEqual(["wind-site-assessment"]);
    expect(filterSkills(skills, { query: "PUBCHEM" }).map((s) => s.slug)).toEqual(["virtual-screening"]);
  });

  it("searches translated text too", () => {
    const result = filterSkills(skills, { query: "风能", extraText: { "wind-site-assessment": "评估风能潜力" } });
    expect(result.map((s) => s.slug)).toEqual(["wind-site-assessment"]);
  });

  it("filters by category and combines with the query", () => {
    expect(filterSkills(skills, { category: "genomics" }).map((s) => s.slug)).toEqual(["variant-pathogenicity"]);
    expect(filterSkills(skills, { category: "genomics", query: "wind" })).toEqual([]);
    expect(filterSkills(skills, { category: "all", query: "" })).toHaveLength(3);
  });
});
